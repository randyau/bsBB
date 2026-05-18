<script lang="ts">
	import type { PageData } from './$types';
	import Breadcrumb from '$components/Breadcrumb.svelte';
	import EmptyState from '$components/EmptyState.svelte';
	import { formatTimeDisplay } from '$lib/utils/time';

	let { data }: { data: PageData } = $props();

	type Notif = typeof data.notifications[0];

	function notifLabel(n: Notif): string {
		const p = n.payload as Record<string, string>;
		switch (n.type) {
			case 'reply':
				return `@${p.replyAuthorHandle} replied in "${p.threadTitle}"`;
			case 'quote':
				return `@${p.replyAuthorHandle} quoted your post in "${p.threadTitle}"`;
			case 'new_reply_in_thread':
				return `New reply in "${p.threadTitle}" (thread you follow)`;
			case 'post_rejected':
				return `Your post was rejected by a moderator${p.reason ? `: ${p.reason}` : ''}`;
			default:
				return 'New notification';
		}
	}

	function notifLink(n: Notif): string | null {
		const p = n.payload as Record<string, string>;
		if (p.forumSlug && p.threadSlug) {
			return `/f/${p.forumSlug}/t/${p.threadSlug}`;
		}
		return null;
	}

	function notifIcon(type: string): string {
		switch (type) {
			case 'reply': return '↩';
			case 'quote': return '"';
			case 'new_reply_in_thread': return '💬';
			case 'post_rejected': return '✗';
			default: return '•';
		}
	}
</script>

<div class="space-y-6 py-8">
	<div>
		<div class="mb-4">
			<Breadcrumb crumbs={[{ label: 'Forums', href: '/' }]} />
		</div>
		<div class="flex items-center justify-between gap-4">
			<h1 class="page-title">Notifications</h1>
			{#if data.notifications.length > 0}
				<div class="flex gap-2">
					<form method="POST" action="?/deleteAll">
						<button
							type="submit"
							class="btn btn-secondary btn-sm"
							onclick={(e) => { if (!confirm('Clear all notifications?')) e.preventDefault(); }}
						>
							Clear all
						</button>
					</form>
				</div>
			{/if}
		</div>
		<p class="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
			Notifications are kept for 30 days (last 100).
			All are marked as read when you open this page.
		</p>
	</div>

	{#if data.notifications.length === 0}
		<EmptyState message="No notifications yet." />
	{:else}
		<div class="box divide-y divide-[rgb(var(--color-border))]">
			{#each data.notifications as notif (notif.id)}
				{@const link = notifLink(notif)}
				<div class="flex items-start gap-3 px-4 py-3{!notif.isRead ? ' bg-[rgb(var(--color-primary))]/5' : ''}">
					<span class="text-base mt-0.5 text-[rgb(var(--color-text-secondary))] w-5 text-center shrink-0" aria-hidden="true">
						{notifIcon(notif.type)}
					</span>
					<div class="flex-1 min-w-0">
						{#if link}
							<a href={link} class="text-sm link leading-snug">
								{notifLabel(notif)}
							</a>
						{:else}
							<p class="text-sm leading-snug">{notifLabel(notif)}</p>
						{/if}
						<p class="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
							{formatTimeDisplay(notif.createdAt)}
						</p>
					</div>
					{#if !notif.isRead}
						<span class="shrink-0 w-2 h-2 rounded-full bg-[rgb(var(--color-primary))] mt-1.5" aria-label="Unread"></span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
