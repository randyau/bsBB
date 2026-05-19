# User Guide — bsBB Forum

Everything you need to know about using bsBB as a member.

---

## Signing In

bsBB uses your **Bluesky identity** for sign-in — no separate password required.

1. Click **Sign in with Bluesky** on any page
2. Enter your Bluesky handle (e.g., `yourname.bsky.social`) or the URL of your PDS
3. You'll be redirected to authorize the forum on your Bluesky account
4. After approving, you're returned to the forum and logged in

Your display name, avatar, and handle are pulled automatically from your Bluesky profile. They stay in sync — if you update your profile on Bluesky, the forum will refresh your info when you next post.

> **Why Bluesky?** bsBB doesn't store passwords or emails for regular users. Your Bluesky account *is* your forum account. If you don't have one, sign up at [bsky.app](https://bsky.app).

---

## Reading the Forum

### Browsing Forums

The forum index shows all top-level forums and their sub-forums. Each entry shows:
- Forum name and description
- Thread count and post count
- Most recent post timestamp

Click any forum to see its threads.

### Reading Threads

Threads are displayed in flat chronological order — all replies in the order they were posted, not nested. This is intentional: nested replies become unreadable at scale.

If someone replied to a specific post, you'll see a "Replying to [quote excerpt]" link that lets you jump to the quoted post.

### Unread Indicators

Once you're logged in, threads you haven't read (or threads with new posts since you last visited) are marked in the forum listing. Visit the thread to clear the indicator.

---

## Posting

### Creating a New Thread

1. Navigate to the forum where you want to post
2. Click **New Thread**
3. Enter a title and your post content
4. Click **Post Thread**

### Replying to a Thread

1. Open the thread
2. Scroll to the reply box at the bottom
3. Write your reply and click **Post Reply**

### Quoting a Post

To quote a specific post in your reply:
1. Click the **Quote** button on any post
2. The post content is inserted into your reply box as a markdown quote
3. Add your response below the quote and post

### Markdown Formatting

Posts use Markdown. A live preview updates as you type. Common formatting:

```
**bold text**
*italic text*
`inline code`

```code block```

> quoted text

# Heading
## Sub-heading

- bullet list
- item

1. numbered list
2. item

[link text](https://example.com)
```

### Link Previews

If your post contains a URL on its own line, the forum automatically fetches that page's title and preview image and displays it as a card. This happens once when you post — there's no ongoing tracking.

---

## Managing Your Posts

### Editing a Post

Click the **Edit** button on any of your own posts. Edits are saved as revisions — the edit history is visible to you and to moderators.

### Hiding Your Own Posts

You can hide a post to remove it from public view:
1. Click the menu on your post → **Hide**

Hidden posts still exist in the database and are visible to moderators. You can restore them later.

### Deleting Your Own Posts

Deleting a post clears its content permanently. A stub remains (to preserve quote links in other posts). **This cannot be undone.**

To delete: click the menu on your post → **Delete**, then confirm.

### Managing All Your Posts

Visit `/user/yourhandle/manage-posts` to see all your posts with bulk hide/delete options.

---

## Your Profile

Your profile page is at `/user/yourhandle`. It shows:
- Your Bluesky display name and avatar
- Custom roles assigned to you by admins
- Your recent posts

Other users can visit your profile to see your post history.

---

## Settings

Visit `/settings` to configure:

### Notification Preferences

Control when and how you're notified about activity:

| Setting | Options |
|---|---|
| **Notify me about** | Replies to my posts / Quotes of my posts / Both |
| **Notification frequency** | Immediately (within 10 min) / Hourly digest / Daily digest |

Notifications are sent as **Bluesky DMs** from the forum's notification bot account. You must opt in — nothing is sent by default.

### Thread-Level Overrides

On any thread, you can set an override that takes precedence over your global settings:

- **Follow** — always notify me about new activity in this thread
- **Mute** — never notify me about this thread
- **Default** — use my global notification settings

Set it via the subscription button in the thread header.

### Account Management

At the bottom of Settings is a **Danger Zone** with two options:

- **Anonymize account** — Removes your handle and display name from all posts, replacing them with "[deleted]". Your posts remain, but they're no longer attributed to you.
- **Delete all post content** — Permanently clears the text of all your posts. Post stubs remain for quote links.

Both actions are **irreversible**. Confirm carefully before proceeding.

---

## Search

The search page is at `/search`.

### Basic Search

Type any words to search post content across all forums you have access to.

### Author Filter

Narrow results to posts by a specific user:

```
author:theirhandle.bsky.social your search terms
```

Or just search by author alone:

```
author:theirhandle.bsky.social
```

### Search Tips

- Search uses full-text matching — it finds the words, not just exact phrases
- Short words (under 3 characters) may be ignored
- If you're not finding what you expect, try fewer, more specific words

---

## Privacy

- Your Bluesky handle, display name, and avatar are publicly visible on all your posts
- Your email is never collected or stored
- The forum does not store your Bluesky OAuth tokens beyond what is needed to establish your session
- Notification DMs are sent from the forum's bot account — your DMs with it are between you and the bot

---

## Account Troubleshooting

### "You've been banned"

If you see a ban message when logging in, your account has been suspended by a moderator or admin. The ban reason (if provided) should be visible on the ban page. Contact the forum admins to appeal.

### My handle changed on Bluesky, but the forum still shows the old one

Your profile syncs automatically when you post. Make a post and the forum will fetch your updated Bluesky profile.

### Notifications aren't arriving

1. Check your **Settings** — notifications must be enabled and a notification type selected
2. Check that the forum's bot account hasn't been blocked in your Bluesky DMs
3. Bluesky DMs from new accounts may land in your "Message Requests" folder

### The dev login page shows up instead of Bluesky login

This forum instance is running in development mode. This is normal for local testing; production deployments use real Bluesky login.
