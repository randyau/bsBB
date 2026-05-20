# -*- coding: utf-8 -*-
"""
HTTP parity test for the Python worker's Bluesky DM flow.

Intercepts all outbound HTTP calls from send_dm() and records them as a
normalized request log. Run this alongside an equivalent capture from the
TypeScript worker to verify both workers make identical API calls.

Usage:
    python test_parity.py

Output: prints each intercepted request as a JSON block so it can be
diff'd against the TypeScript worker's request log.

To capture the TypeScript worker's requests, run the TS worker with a
local proxy (e.g. mitmproxy on port 8080):
    HTTPS_PROXY=http://localhost:8080 NODE_EXTRA_CA_CERTS=~/.mitmproxy/mitmproxy-ca-cert.pem \
        npx tsx src/worker.ts

Or add a console.log in sendDm() in src/worker.ts before each API call.
"""

import json
import sys
import httpx

# ---------------------------------------------------------------------------
# Request capture transport
# ---------------------------------------------------------------------------

CAPTURED = []

class CapturingTransport(httpx.BaseTransport):
    """Records every request then returns a synthetic response."""

    def __init__(self, responses: list[dict]):
        self._responses = iter(responses)

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        body = request.content.decode() if request.content else None
        entry = {
            "method": request.method,
            "url": str(request.url),
            "headers": {
                k: v for k, v in request.headers.items()
                # strip host/content-length, they vary and aren't meaningful
                if k.lower() not in ("host", "content-length", "user-agent", "accept-encoding", "connection")
            },
            "body": json.loads(body) if body else None,
        }
        CAPTURED.append(entry)

        response = next(self._responses)
        return httpx.Response(
            status_code=response.get("status", 200),
            json=response.get("json", {}),
            headers={"content-type": "application/json"},
        )


# ---------------------------------------------------------------------------
# Synthetic API responses (what bsky.social would return)
# ---------------------------------------------------------------------------

MOCK_PDS_URL = "https://testpds.us-east.host.bsky.network"

MOCK_RESPONSES = [
    # 1. createSession — includes didDoc so _atproto_login extracts the PDS URL.
    # The PDS URL is a per-account shard, NOT bsky.social. Chat requests must
    # go to this URL; bsky.social's entrypoint returns MethodNotImplemented.
    {
        "json": {
            "accessJwt": "test-access-jwt",
            "refreshJwt": "test-refresh-jwt",
            "handle": "notifications.test.bsky.social",
            "did": "did:plc:serviceaccount",
            "didDoc": {
                "@context": ["https://www.w3.org/ns/did/v1"],
                "id": "did:plc:serviceaccount",
                "service": [
                    {
                        "id": "#atproto_pds",
                        "type": "AtprotoPersonalDataServer",
                        "serviceEndpoint": MOCK_PDS_URL,
                    }
                ],
            },
        }
    },
    # 2. getConvoForMembers
    {
        "json": {
            "convo": {
                "id": "convo-abc-123",
                "rev": "1",
                "members": [],
                "muted": False,
                "unreadCount": 0,
            }
        }
    },
    # 3. sendMessage
    {
        "json": {
            "id": "msg-xyz-456",
            "rev": "1",
            "text": "test message",
            "sender": {"did": "did:plc:serviceaccount"},
            "sentAt": "2026-01-01T00:00:00Z",
        }
    },
]

# ---------------------------------------------------------------------------
# Run the capture
# ---------------------------------------------------------------------------

def main():
    # Patch the worker's httpx.Client to use our capturing transport
    import worker
    import unittest.mock as mock

    recipient_did = "did:plc:recipienttest"
    message_text = "[bsBB] @someone replied to your thread \"Test Thread\"\nhttp://localhost:5173/f/general/t/test-thread\n\nTo stop these messages, disable notifications at http://localhost:5173/settings"

    original_client = httpx.Client

    def patched_client(*args, **kwargs):
        kwargs["transport"] = CapturingTransport(MOCK_RESPONSES[:])
        return original_client(*args, **kwargs)

    with mock.patch("worker.httpx.Client", patched_client):
        try:
            worker.send_dm(recipient_did, message_text)
        except Exception as exc:
            # A failure here means the mock response shape is wrong,
            # not a parity issue with Bluesky's real API.
            print(f"ERROR during send_dm: {exc}", file=sys.stderr)
            sys.exit(1)

    # ---------------------------------------------------------------------------
    # Print captured requests
    # ---------------------------------------------------------------------------

    print("=" * 72)
    print("CAPTURED REQUESTS (Python worker)")
    print("=" * 72)
    print()

    for i, req in enumerate(CAPTURED, 1):
        print(f"--- Request {i}: {req['method']} {req['url']}")
        print(json.dumps(req, indent=2))
        print()

    print("=" * 72)
    print(f"Total requests: {len(CAPTURED)}")
    print()
    print("Expected sequence:")
    print("  1. POST https://bsky.social/xrpc/com.atproto.server.createSession")
    print("     body: {identifier, password}")
    print(f"  2. GET  {MOCK_PDS_URL}/xrpc/chat.bsky.convo.getConvoForMembers")
    print("     headers: Authorization: Bearer ..., atproto-proxy: did:web:api.bsky.chat#bsky_chat")
    print("     params: members repeated for recipient + service account")
    print("     NOTE: URL uses PDS shard from didDoc, NOT bsky.social")
    print(f"  3. POST {MOCK_PDS_URL}/xrpc/chat.bsky.convo.sendMessage")
    print("     headers: Authorization: Bearer ..., atproto-proxy: did:web:api.bsky.chat#bsky_chat")
    print("     body: {convoId, message: {text}}")

    # Assertions on the captured structure
    errors = []

    if len(CAPTURED) != 3:
        errors.append(f"Expected 3 requests, got {len(CAPTURED)}")
    else:
        r1, r2, r3 = CAPTURED

        # Request 1: createSession
        if r1["method"] != "POST":
            errors.append(f"Request 1: expected POST, got {r1['method']}")
        if "com.atproto.server.createSession" not in r1["url"]:
            errors.append(f"Request 1: wrong URL: {r1['url']}")
        if r1["body"] and "identifier" not in r1["body"]:
            errors.append("Request 1: body missing 'identifier'")
        if r1["body"] and "password" not in r1["body"]:
            errors.append("Request 1: body missing 'password'")
        if "authorization" in r1["headers"]:
            errors.append("Request 1 (createSession) should NOT have Authorization header")

        # Request 2: getConvoForMembers — must target the PDS shard, not bsky.social
        if r2["method"] != "GET":
            errors.append(f"Request 2: expected GET, got {r2['method']}")
        if "chat.bsky.convo.getConvoForMembers" not in r2["url"]:
            errors.append(f"Request 2: wrong URL: {r2['url']}")
        if not r2["url"].startswith(MOCK_PDS_URL):
            errors.append(f"Request 2: URL must use PDS shard ({MOCK_PDS_URL}), got: {r2['url']}")
        if "authorization" not in r2["headers"]:
            errors.append("Request 2: missing Authorization header")
        elif not r2["headers"]["authorization"].startswith("Bearer "):
            errors.append("Request 2: Authorization must be Bearer token")
        if r2["headers"].get("atproto-proxy") != "did:web:api.bsky.chat#bsky_chat":
            errors.append(f"Request 2: wrong atproto-proxy: {r2['headers'].get('atproto-proxy')}")
        from urllib.parse import unquote
        decoded_url = unquote(r2["url"])
        if recipient_did not in decoded_url:
            errors.append(f"Request 2: recipient DID not in URL params: {decoded_url}")
        if "did:plc:serviceaccount" not in decoded_url:
            errors.append(f"Request 2: service account DID not in URL params: {decoded_url}")

        # Request 3: sendMessage — must also target the PDS shard
        if r3["method"] != "POST":
            errors.append(f"Request 3: expected POST, got {r3['method']}")
        if "chat.bsky.convo.sendMessage" not in r3["url"]:
            errors.append(f"Request 3: wrong URL: {r3['url']}")
        if not r3["url"].startswith(MOCK_PDS_URL):
            errors.append(f"Request 3: URL must use PDS shard ({MOCK_PDS_URL}), got: {r3['url']}")
        if "authorization" not in r3["headers"]:
            errors.append("Request 3: missing Authorization header")
        if r3["headers"].get("atproto-proxy") != "did:web:api.bsky.chat#bsky_chat":
            errors.append(f"Request 3: wrong atproto-proxy: {r3['headers'].get('atproto-proxy')}")
        if r3["body"] and "convoId" not in r3["body"]:
            errors.append("Request 3: body missing 'convoId'")
        if r3["body"] and "message" not in r3["body"]:
            errors.append("Request 3: body missing 'message'")
        if r3["body"] and r3["body"].get("message", {}).get("text") != message_text:
            errors.append("Request 3: message text does not match")

    print()
    if errors:
        print("FAILURES:")
        for e in errors:
            print(f"  FAIL: {e}")
        sys.exit(1)
    else:
        print("All assertions passed.")


if __name__ == "__main__":
    # Set required env vars so worker.py module-level config doesn't error
    import os
    os.environ.setdefault("DATABASE_URL", "postgresql://forum:forum@localhost:5432/forum")
    os.environ.setdefault("ATPROTO_SERVICE_HANDLE", "notifications.test.bsky.social")
    os.environ.setdefault("ATPROTO_SERVICE_APP_PASSWORD", "test-app-password")
    os.environ.setdefault("PUBLIC_BASE_URL", "http://localhost:5173")

    main()
