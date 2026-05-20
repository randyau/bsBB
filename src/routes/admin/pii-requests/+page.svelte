<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { formatTimeDisplay } from '$lib/utils/time';
	import AdminPageShell from '$components/AdminPageShell.svelte';
	import EmptyState from '$components/EmptyState.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let dismissingId: string | null = $state(null);
	let dismissReason: string = $state('');
	let submitting: boolean = $state(false);
</script>

<AdminPageShell title="PII Removal Requests">
	<p class="text-[rgb(var(--color-text-muted))] text-sm mb-4">
		Requests to permanently erase post content and full edit history due to personally identifiable information. These requests do not expire.
	</p>

	{#if form?.error}
		<div class="alert alert-error text-sm">{form.error}</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success text-sm">
			{form.action === 'piiWipe' ? 'Post content and revision history permanently erased.' : 'Request dismissed.'}
		</div>
	{/if}

	{#if data.requests.length === 0}
		<EmptyState message="No pending PII removal requests." />
	{:else}
		<div class="space-y-4">
			{#each data.requests as req (req.id)}
				<div class="box space-y-3">
					<!-- Post location -->
					<div class="text-sm text-[rgb(var(--color-text-muted))]">
						<a
							href="/f/{req.forumSlug}/t/{req.threadSlug}"
							class="link font-medium text-[rgb(var(--color-text))]"
						>{req.threadTitle}</a>
						<span class="mx-1">·</span>
						{req.forumName}
						<span class="mx-1">·</span>
						post by <span class="font-medium">{req.authorDisplayName || req.authorHandle}</span>
						<span class="mx-1">·</span>
						posted {formatTimeDisplay(req.postCreatedAt, data.user?.timezone)}
					</div>

					<!-- Request metadata -->
					<div class="text-sm">
						<span class="text-[rgb(var(--color-text-muted))]">Requested by</span>
						<span class="font-medium">{req.requesterHandle}</span>
						<span class="text-[rgb(var(--color-text-muted))] mx-1">·</span>
						<span class="text-[rgb(var(--color-text-muted))]">{formatTimeDisplay(req.createdAt, data.user?.timezone)}</span>
					</div>

					<!-- Requester's stated reason -->
					<div class="bg-[rgb(var(--color-bg-secondary))] rounded p-3 text-sm">
						<p class="text-xs font-medium text-[rgb(var(--color-text-muted))] uppercase tracking-wide mb-1">Reason</p>
						<p class="text-[rgb(var(--color-text))]">{req.reason}</p>
					</div>

					<!-- Post content preview (if not already deleted) -->
					{#if req.postStatus !== 'deleted'}
						<details class="text-sm">
							<summary class="cursor-pointer text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]">
								Preview post content
							</summary>
							<div class="mt-2 bg-[rgb(var(--color-bg-secondary))] rounded p-3 text-[rgb(var(--color-text-muted))] whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-xs">
								{req.postBodyMarkdown}
							</div>
						</details>
					{:else}
						<p class="text-sm italic text-[rgb(var(--color-text-muted))]">Post content already wiped.</p>
					{/if}

					<!-- Actions -->
					<div class="flex gap-3 pt-1">
						{#if req.postStatus !== 'deleted'}
							<form
								method="POST"
								action="?/piiWipe"
								use:enhance={() => {
									submitting = true;
									return async ({ update }) => { await update(); submitting = false; };
								}}
								onsubmit={(e) => {
									if (!confirm(
										'Permanently erase this post content and all revision history?\n\n' +
										'This will irreversibly wipe the body markdown, rendered HTML, and every saved edit. ' +
										'The post stub remains so quotes and links are not broken.\n\n' +
										'This cannot be undone.'
									)) e.preventDefault();
								}}
							>
								<input type="hidden" name="requestId" value={req.id} />
								<button type="submit" disabled={submitting} class="btn btn-danger text-sm">
									PII Wipe
								</button>
							</form>
						{/if}

						{#if dismissingId !== req.id}
							<button
								type="button"
								onclick={() => { dismissingId = req.id; dismissReason = ''; }}
								class="btn btn-secondary text-sm"
							>
								Dismiss
							</button>
						{:else}
							<form
								method="POST"
								action="?/dismiss"
								class="flex gap-2 items-start flex-wrap"
								use:enhance={() => {
									submitting = true;
									return async ({ update }) => { await update(); submitting = false; dismissingId = null; };
								}}
							>
								<input type="hidden" name="requestId" value={req.id} />
								<input
									type="text"
									name="dismissReason"
									bind:value={dismissReason}
									placeholder="Reason for dismissing…"
									required
									maxlength="500"
									class="form-control text-sm"
								/>
								<button type="submit" disabled={submitting || !dismissReason.trim()} class="btn btn-secondary text-sm">
									Confirm dismiss
								</button>
								<button
									type="button"
									onclick={() => { dismissingId = null; dismissReason = ''; }}
									class="btn btn-secondary text-sm"
								>
									Cancel
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</AdminPageShell>
