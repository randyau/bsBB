<script lang="ts">
	import { enhance } from "$app/forms";
	import type { PageData, ActionData } from './$types';
	import AdminPageShell from '$components/AdminPageShell.svelte';
	import EmptyState from '$components/EmptyState.svelte';
	import { formatTimeDisplay } from '$lib/utils/time';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let rejectingPostId: string | null = $state(null);
	let rejectReason: string = $state('');

	function startReject(postId: string) {
		rejectingPostId = postId;
		rejectReason = '';
	}

	function cancelReject() {
		rejectingPostId = null;
		rejectReason = '';
	}
</script>

<AdminPageShell title="Approval Queue">
	{#if data.pendingPosts.length === 0}
		<EmptyState message="No posts pending approval." />
	{:else}
		<p class="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
			{data.pendingPosts.length} post{data.pendingPosts.length === 1 ? '' : 's'} awaiting approval.
			Posts are auto-approved after 24 hours if not reviewed.
		</p>

		<div class="space-y-4">
			{#each data.pendingPosts as post (post.id)}
				<div class="box space-y-3">
					<!-- Context -->
					<div class="flex items-start justify-between gap-4">
						<div class="text-sm">
							<span class="font-semibold">
								<a href="/user/{post.authorHandle}" class="link">{post.authorDisplayName || post.authorHandle}</a>
							</span>
							<span class="text-[rgb(var(--color-text-muted))] font-mono text-xs ml-1">@{post.authorHandle}</span>
							<span class="text-[rgb(var(--color-text-muted))] mx-2">in</span>
							<a href="/f/{post.forumSlug}/t/{post.threadSlug}" class="link font-medium">{post.threadTitle}</a>
							<span class="text-[rgb(var(--color-text-muted))] mx-1">({post.forumName})</span>
						</div>
						<div class="text-xs text-[rgb(var(--color-text-muted))] whitespace-nowrap">
							{formatTimeDisplay(post.createdAt, data.user?.timezone)}
						</div>
					</div>

					<!-- Post body preview -->
					<div class="bg-[rgb(var(--color-bg-secondary))] rounded p-3 text-sm prose prose-sm max-w-none max-h-48 overflow-y-auto">
						{@html post.bodyHtml}
					</div>

					<!-- Actions -->
					{#if rejectingPostId === post.id}
						<form method="POST" use:enhance action="?/reject" class="space-y-2">
							<input type="hidden" name="postId" value={post.id} />
							<div>
								<label for="reason-{post.id}" class="form-label text-sm">Rejection reason (sent to author)</label>
								<textarea
									id="reason-{post.id}"
									name="reason"
									bind:value={rejectReason}
									class="form-control text-sm"
									rows="2"
									placeholder="Explain why this post was rejected..."
									required
								></textarea>
							</div>
							<div class="flex gap-2">
								<button type="submit" class="btn btn-danger btn-sm" disabled={!rejectReason.trim()}>
									Confirm Reject
								</button>
								<button type="button" class="btn btn-secondary btn-sm" onclick={cancelReject}>
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<div class="flex gap-2">
							<form method="POST" use:enhance action="?/approve">
								<input type="hidden" name="postId" value={post.id} />
								<button type="submit" class="btn btn-primary btn-sm">Approve</button>
							</form>
							<button
								type="button"
								class="btn btn-danger btn-sm"
								onclick={() => startReject(post.id)}
							>
								Reject
							</button>
							<a
								href="/f/{post.forumSlug}/t/{post.threadSlug}"
								class="btn btn-secondary btn-sm"
								target="_blank"
								rel="noopener"
							>
								View thread ↁE							</a>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</AdminPageShell>

