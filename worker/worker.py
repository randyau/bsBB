# -*- coding: utf-8 -*-
"""
bsBB notification worker - runs as a separate process/container from the web tier.

Polls the database every 60 seconds and processes:
  - Bluesky DM notifications (reply, quote, new_reply_in_thread, welcome_dm)
  - Moderator email alerts
  - Profile sync requests
  - Stale post auto-approval (every 10 minutes)
  - Expired session cleanup (every hour)

Schema dependency
-----------------
This worker queries the database directly using raw SQL. If any of the
following tables or columns change, review this file for required updates:

  notification_queue  id, recipient_did, type, payload, status,
                      created_at, sent_at, error, retry_count
  users               did, handle, notify_via_bluesky, notification_type,
                      notification_frequency, display_name, avatar_url,
                      last_profile_sync
  posts               id, thread_id, is_approved, status, created_at
  threads             id, last_post_at
  mod_log             moderator_did, action, target_post_id, reason
  sessions            id, expires_at
  worker_log          level, message, context, created_at
  instance_settings   key, value
"""

import json
import logging
import os
import re
import signal
import smtplib
import sys
import time
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
import psycopg
from psycopg.rows import dict_row

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="[worker:%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("worker")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ["DATABASE_URL"]
ATPROTO_SERVICE_HANDLE = os.environ.get("ATPROTO_SERVICE_HANDLE", "")
ATPROTO_SERVICE_APP_PASSWORD = os.environ.get("ATPROTO_SERVICE_APP_PASSWORD", "")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL") or os.environ.get("SMTP_FROM", "")
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "")

POLL_INTERVAL = 60          # seconds between notification polls
APPROVE_INTERVAL = 600      # 10 minutes
CLEANUP_INTERVAL = 3600     # 1 hour
BATCH_SIZE = 10

ATPROTO_BSKY_SOCIAL = "https://bsky.social"
ATPROTO_CHAT_PROXY = "did:web:api.bsky.chat#bsky_chat"

# Frequency throttle windows in seconds
FREQUENCY_WINDOWS = {
    "immediate": 10 * 60,
    "hourly": 60 * 60,
    "daily": 24 * 60 * 60,
}

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_conn() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def wlog(conn: psycopg.Connection, level: str, message: str, context: dict | None = None) -> None:
    """Structured log: stdout + persistent DB record for warn/error."""
    getattr(log, level if level != "warn" else "warning")(message, extra={"context": context})
    if level in ("warn", "error"):
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO worker_log (level, message, context) VALUES (%s, %s, %s)",
                    (level, message, json.dumps(context) if context else None),
                )
            conn.commit()
        except Exception:
            pass  # never let logging crash the worker


def get_setting(conn: psycopg.Connection, key: str, default: str = "") -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM instance_settings WHERE key = %s", (key,))
        row = cur.fetchone()
    return row["value"] if row else default


# ---------------------------------------------------------------------------
# ATproto DM
# ---------------------------------------------------------------------------

def _atproto_login(client: httpx.Client) -> tuple[str, str, str]:
    """Login with App Password. Returns (access_jwt, service_did, pds_url).

    pds_url is the account's actual PDS endpoint from the didDoc service list.
    This may differ from bsky.social (e.g. a Bluesky-hosted shard like
    https://puffball.us-east.host.bsky.network). The atproto-proxy header is
    only honoured by the account's own PDS, not by bsky.social's entrypoint.
    """
    if not ATPROTO_SERVICE_HANDLE or not ATPROTO_SERVICE_APP_PASSWORD:
        raise RuntimeError("ATPROTO_SERVICE_HANDLE and ATPROTO_SERVICE_APP_PASSWORD must be set")
    resp = client.post(
        f"{ATPROTO_BSKY_SOCIAL}/xrpc/com.atproto.server.createSession",
        json={"identifier": ATPROTO_SERVICE_HANDLE, "password": ATPROTO_SERVICE_APP_PASSWORD},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    # Extract the PDS URL from the didDoc returned by createSession.
    # Fall back to bsky.social if absent (shouldn't happen for normal accounts).
    pds_url = ATPROTO_BSKY_SOCIAL
    did_doc = data.get("didDoc", {})
    for svc in did_doc.get("service", []):
        if svc.get("id") in ("#atproto_pds", "atproto_pds"):
            pds_url = svc["serviceEndpoint"].rstrip("/")
            break

    return data["accessJwt"], data["did"], pds_url


class DMBlockedError(Exception):
    """Raised when the PDS returns 501 for chat.bsky.convo.getConvoForMembers.

    The Bluesky chat lexicon uses HTTP 501 to signal recipient-side blocks:
    MessagesDisabled, NotFollowedBySender, BlockedActor, or AccountSuspended.
    This is a permanent failure for this recipient — do not retry.

    Note: an earlier version of this worker sent chat requests to the
    bsky.social entrypoint (hardcoded) rather than the account's actual PDS
    shard. That also produced 501 (MethodNotImplemented) because bsky.social's
    load balancer does not honour the atproto-proxy header. The fix is in
    _atproto_login: it now extracts the real PDS URL from the didDoc returned
    by createSession and uses that for all subsequent chat calls.
    """


_URL_RE = re.compile(r"https?://\S+")


def _build_facets(text: str) -> list[dict]:
    """Return app.bsky.richtext.facet link facets for every URL found in text.

    ATproto facet byte offsets are UTF-8 byte positions, not character indices.
    """
    encoded = text.encode("utf-8")
    facets = []
    for m in _URL_RE.finditer(text):
        byte_start = len(text[: m.start()].encode("utf-8"))
        byte_end = len(text[: m.end()].encode("utf-8"))
        facets.append(
            {
                "index": {"byteStart": byte_start, "byteEnd": byte_end},
                "features": [{"$type": "app.bsky.richtext.facet#link", "uri": m.group()}],
            }
        )
    return facets


def send_dm(recipient_did: str, text: str) -> None:
    """
    Send a Bluesky DM from the service account to recipient_did.

    HTTP call sequence:

    1. POST https://bsky.social/xrpc/com.atproto.server.createSession
       No auth. Body: {identifier, password}
       Response: {accessJwt, did, ...}

    2. GET <pds_url>/xrpc/chat.bsky.convo.getConvoForMembers
          ?members=<recipient_did>&members=<service_did>
       Headers: Authorization: Bearer <accessJwt>
                atproto-proxy: did:web:api.bsky.chat#bsky_chat
                atproto-accept-labelers: did:plc:ar7c4by46qjdydhdevvrndac;redact
       Note: pds_url comes from the didDoc in the createSession response, NOT
       hardcoded bsky.social. The atproto-proxy header is only honoured by the
       account's own PDS shard; bsky.social's entrypoint returns MethodNotImplemented.

    3. POST <pds_url>/xrpc/chat.bsky.convo.sendMessage
       Same headers as step 2.
       Body: {convoId: <id from step 2>, message: {text: <text>, facets: [...]}}
       Facets mark URL byte ranges so Bluesky clients render them as clickable links.

    If Bluesky changes their chat API, verify _atproto_login still extracts the
    correct PDS URL from the didDoc returned by createSession.
"""
    facets = _build_facets(text)
    message: dict = {"text": text}
    if facets:
        message["facets"] = facets

    with httpx.Client() as client:
        access_jwt, service_did, pds_url = _atproto_login(client)
        auth_headers = {
            "Authorization": f"Bearer {access_jwt}",
            "atproto-proxy": ATPROTO_CHAT_PROXY,
            "atproto-accept-labelers": "did:plc:ar7c4by46qjdydhdevvrndac;redact",
        }

        resp = client.get(
            f"{pds_url}/xrpc/chat.bsky.convo.getConvoForMembers",
            params={"members": [recipient_did, service_did]},
            headers=auth_headers,
            timeout=10,
        )
        if resp.status_code == 501:
            body = resp.text
            raise DMBlockedError(
                f"Recipient {recipient_did} cannot receive DMs from this account "
                f"(MessagesDisabled, NotFollowedBySender, BlockedActor, or AccountSuspended) — "
                f"response body: {body}"
            )
        resp.raise_for_status()
        convo_id = resp.json()["convo"]["id"]

        resp = client.post(
            f"{pds_url}/xrpc/chat.bsky.convo.sendMessage",
            json={"convoId": convo_id, "message": message},
            headers=auth_headers,
            timeout=10,
        )
        resp.raise_for_status()


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

def send_email(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        if SMTP_USER and SMTP_PASS:
            server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_FROM, to, msg.as_string())


# ---------------------------------------------------------------------------
# Notification handlers
# ---------------------------------------------------------------------------

def _build_dm_message(ntype: str, thread_title: str, author_handle: str,
                       site_name: str, thread_link: str, settings_url: str) -> str:
    footer = f"\n\nTo stop these messages, disable notifications at {settings_url}"
    if ntype == "reply":
        return f"[{site_name}] @{author_handle} replied to your thread \"{thread_title}\"{thread_link}{footer}"
    if ntype == "quote":
        return f"[{site_name}] @{author_handle} quoted your post in \"{thread_title}\"{thread_link}{footer}"
    if ntype == "new_reply_in_thread":
        return f"[{site_name}] New reply in \"{thread_title}\"{thread_link}{footer}"
    return f"[{site_name}] You have a new forum notification{footer}"


def handle_dm_notification(conn: psycopg.Connection, recipient_did: str, payload: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT notify_via_bluesky, notification_type, notification_frequency "
            "FROM users WHERE did = %s",
            (recipient_did,),
        )
        user = cur.fetchone()

    if not user:
        raise RuntimeError(f"Recipient user not found: {recipient_did}")
    if not user["notify_via_bluesky"]:
        log.info("skipped (Bluesky DMs disabled): %s", recipient_did)
        return

    ntype = payload.get("notificationType", "")
    if (user["notification_type"] == "replies" and ntype == "quote") or \
       (user["notification_type"] == "quotes" and ntype == "reply"):
        log.info("skipped (type filtered): %s type=%s", recipient_did, ntype)
        return

    site_name = get_setting(conn, "site_name", "bsBB")
    thread_slug = payload.get("threadSlug", "")
    forum_slug = payload.get("forumSlug", "")
    thread_link = f"\n{PUBLIC_BASE_URL}/f/{forum_slug}/t/{thread_slug}" if thread_slug and forum_slug else ""
    settings_url = f"{PUBLIC_BASE_URL}/settings"

    text = _build_dm_message(
        ntype,
        payload.get("threadTitle", ""),
        payload.get("replyAuthorHandle", ""),
        site_name,
        thread_link,
        settings_url,
    )
    send_dm(recipient_did, text)
    log.info("dm_notification sent to %s", recipient_did)


def handle_moderator_alert(conn: psycopg.Connection, recipient_did: str, payload: dict) -> None:
    if not ADMIN_EMAIL:
        raise RuntimeError("ADMIN_EMAIL or SMTP_FROM must be set to receive moderator alerts")

    action = payload.get("action", "")
    target_type = payload.get("targetType", "")
    target_label = payload.get("targetLabel", "")
    moderator_handle = payload.get("moderatorHandle", "")
    reason = payload.get("reason", "")

    subject = f"[Forum Alert] {action} - {target_label}"
    reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
    html = f"""
        <h2>Moderation Alert</h2>
        <p><strong>Action:</strong> {action}</p>
        <p><strong>Target:</strong> {target_type} - {target_label}</p>
        <p><strong>Moderator:</strong> @{moderator_handle}</p>
        {reason_html}
        <p><small>This is an automated alert from your forum.</small></p>
    """
    send_email(ADMIN_EMAIL, subject, html)
    log.info("moderator_alert sent to %s", ADMIN_EMAIL)


def handle_welcome_dm(conn: psycopg.Connection, recipient_did: str, payload: dict) -> None:
    site_name = payload.get("siteName", get_setting(conn, "site_name", "bsBB"))
    settings_url = payload.get("settingsUrl", f"{PUBLIC_BASE_URL}/settings")
    text = (
        f"[{site_name}] You've enabled Bluesky DM notifications for {site_name}.\n\n"
        f"You'll receive a message here when someone replies to your threads or quotes your posts.\n\n"
        f"To change your preferences or disable notifications at any time, visit:\n{settings_url}"
    )
    send_dm(recipient_did, text)
    log.info("welcome_dm sent to %s", recipient_did)


def handle_profile_sync(conn: psycopg.Connection, recipient_did: str, _payload: dict) -> None:
    resp = httpx.get(
        "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile",
        params={"actor": recipient_did},
        timeout=5,
    )
    resp.raise_for_status()
    profile = resp.json()

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET handle = %s, display_name = %s, avatar_url = %s, "
            "last_profile_sync = now() WHERE did = %s",
            (profile["handle"], profile.get("displayName"), profile.get("avatar"), recipient_did),
        )
    conn.commit()
    log.info("profile_sync updated %s (%s)", profile["handle"], recipient_did)


# ---------------------------------------------------------------------------
# Frequency throttle
# ---------------------------------------------------------------------------

def _get_last_dm_sent(conn: psycopg.Connection, recipient_did: str) -> datetime | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT sent_at FROM notification_queue "
            "WHERE recipient_did = %s AND type = 'dm_notification' AND status = 'sent' "
            "ORDER BY sent_at DESC LIMIT 1",
            (recipient_did,),
        )
        row = cur.fetchone()
    return row["sent_at"] if row else None


def _is_throttled(conn: psycopg.Connection, recipient_did: str, frequency: str) -> bool:
    last = _get_last_dm_sent(conn, recipient_did)
    if not last:
        return False
    window = FREQUENCY_WINDOWS.get(frequency, FREQUENCY_WINDOWS["immediate"])
    now = datetime.now(timezone.utc)
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return (now - last).total_seconds() < window


# ---------------------------------------------------------------------------
# Main notification poll
# ---------------------------------------------------------------------------

def process_notifications(conn: psycopg.Connection) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, recipient_did, type, payload, created_at
                FROM notification_queue
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT %s
                FOR UPDATE SKIP LOCKED
            """, (BATCH_SIZE,))
            rows = cur.fetchall()

            if not rows:
                return

            ids = [r["id"] for r in rows]
            cur.execute(
                "UPDATE notification_queue SET status = 'processing' WHERE id = ANY(%s)",
                (ids,),
            )
        conn.commit()

        log.info("processing %d notifications", len(rows))

        for row in rows:
            notif_id = row["id"]
            recipient_did = row["recipient_did"]
            ntype = row["type"]
            payload = row["payload"] if isinstance(row["payload"], dict) else json.loads(row["payload"] or "{}")

            try:
                if ntype == "dm_notification":
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT notification_frequency FROM users WHERE did = %s",
                            (recipient_did,),
                        )
                        user = cur.fetchone()
                    if user and _is_throttled(conn, recipient_did, user["notification_frequency"]):
                        log.info("deferred (frequency throttled): %s", recipient_did)
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE notification_queue SET status = 'pending' WHERE id = %s",
                                (notif_id,),
                            )
                        conn.commit()
                        continue

                if ntype == "moderator_alert":
                    handle_moderator_alert(conn, recipient_did, payload)
                elif ntype == "dm_notification":
                    handle_dm_notification(conn, recipient_did, payload)
                elif ntype == "welcome_dm":
                    handle_welcome_dm(conn, recipient_did, payload)
                elif ntype == "profile_sync":
                    handle_profile_sync(conn, recipient_did, payload)
                else:
                    wlog(conn, "warn", f"Unknown notification type: {ntype}",
                         {"notif_id": str(notif_id), "type": ntype})

                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE notification_queue SET status = 'sent', sent_at = now(), error = NULL "
                        "WHERE id = %s",
                        (notif_id,),
                    )
                conn.commit()
                log.info("sent notification %s (%s) to %s", notif_id, ntype, recipient_did)

            except DMBlockedError as exc:
                log.info("skipped (recipient cannot receive DMs): %s", recipient_did)
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE notification_queue SET status = 'skipped', error = %s, "
                            "sent_at = now() WHERE id = %s",
                            (str(exc), notif_id),
                        )
                    conn.commit()
                except Exception:
                    conn.rollback()

            except Exception as exc:
                error_msg = str(exc)
                wlog(conn, "error", f"Failed to process notification {notif_id}",
                     {"notif_id": str(notif_id), "recipient_did": recipient_did,
                      "type": ntype, "error": error_msg})
                try:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE notification_queue SET status = 'failed', error = %s, "
                            "retry_count = retry_count + 1 WHERE id = %s",
                            (error_msg, notif_id),
                        )
                    conn.commit()
                except Exception:
                    conn.rollback()

    except Exception as exc:
        wlog(conn, "error", "Unhandled error in process_notifications", {"error": str(exc)})
        try:
            conn.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Periodic tasks
# ---------------------------------------------------------------------------

def auto_approve_stale_posts(conn: psycopg.Connection) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, thread_id FROM posts
                WHERE is_approved = false
                  AND status = 'active'
                  AND created_at < now() - interval '24 hours'
            """)
            stale = cur.fetchall()

        if not stale:
            return

        log.info("auto-approving %d stale pending posts", len(stale))
        for post in stale:
            with conn.cursor() as cur:
                cur.execute("UPDATE posts SET is_approved = true WHERE id = %s", (post["id"],))
                cur.execute("UPDATE threads SET last_post_at = now() WHERE id = %s", (post["thread_id"],))
                cur.execute(
                    "INSERT INTO mod_log (moderator_did, action, target_post_id, reason) "
                    "VALUES (%s, %s, %s, %s)",
                    ("did:system:worker", "auto_approve_stale", post["id"],
                     "Automatically approved after 24 hours in the approval queue"),
                )
            conn.commit()

        log.info("auto-approved %d posts", len(stale))
    except Exception as exc:
        wlog(conn, "error", "Auto-approve stale posts failed", {"error": str(exc)})
        try:
            conn.rollback()
        except Exception:
            pass


def cleanup_expired_sessions(conn: psycopg.Connection) -> None:
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM sessions WHERE expires_at < now()")
        conn.commit()
        log.info("session cleanup complete")
    except Exception as exc:
        wlog(conn, "error", "Session cleanup failed", {"error": str(exc)})
        try:
            conn.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    log.info("initializing...")

    if not DATABASE_URL:
        log.error("DATABASE_URL is required")
        sys.exit(1)

    conn = get_conn()
    wlog(conn, "info", "Notification worker started")

    last_approve = 0.0
    last_cleanup = 0.0

    # Graceful shutdown
    def _shutdown(signum, frame):
        log.info("SIGTERM received, shutting down gracefully")
        conn.close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)

    log.info("ready - polling every %ds", POLL_INTERVAL)

    while True:
        now = time.monotonic()

        process_notifications(conn)

        if now - last_approve >= APPROVE_INTERVAL:
            auto_approve_stale_posts(conn)
            last_approve = now

        if now - last_cleanup >= CLEANUP_INTERVAL:
            cleanup_expired_sessions(conn)
            last_cleanup = now

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
