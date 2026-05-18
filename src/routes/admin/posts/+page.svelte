<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let movePostId: string | null = $state(null);
	let moveDestThreadId: string = $state('');

	function confirmHide(): boolean {
		return confirm('Hide this post? It will be removed from view but content is preserved and it can be restored.');
	}

	function confirmPermanentlyDelete(): boolean {
		return confirm(
			'Permanently delete this post?\n\nThis will irreversibly clear all content. The post stub will remain for quotes/links, but content cannot be recovered.\n\nThis action cannot be undone.'
		);
	}
</script>

<div class="space-y-6">
	<h1 class="page-title">Post Management</h1>

	{#if form?.error}
		<div class="alert alert-error text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success text-sm">
			✓ Post action completed: {form.action}
		</div>
	{/if}

	<TableSearch
		value={data.q}
		placeholder="Search by author handle or thread title..."
		clearHref="/admin/posts"
	/>

	<div class="table-container">
		<table class="w-full text-sm">
			<thead class="bg-[rgb(var(--color-bg-tertiary))] border-b border-[rgb(var(--color-border))]">
				<tr>
					<th class="px-4 py-3 text-left font-semibold">Thread</th>
					<th class="px-4 py-3 text-left font-semibold">Author</th>
					<th class="px-4 py-3 text-left font-semibold">Posted</th>
					<th class="px-4 py-3 text-left font-semibold">Preview</th>
					<th class="px-4 py-3 text-left font-semibold">Status</th>
					<th class="px-4 py-3 text-left font-semibold">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.posts as post (post.id)}
					<tr
						class={`border-b border-[rgb(var(--color-border))] ${post.status !== 'active' ? 'bg-[rgb(var(--color-bg-tertiary))] opacity-60' : 'hover:bg-[rgb(var(--color-bg-secondary))]'}`}
					>
						<td class="px-4 py-3">
							<a
								href="/f/general/t/{post.threadId}/{post.threadSlug}"
								target="_blank"
								rel="noopener noreferrer"
								class="text-[rgb(var(--color-primary))] hover:underline"
							>
								{post.threadTitle}
							</a>
						</td>
						<td class="px-4 py-3 font-mono text-xs">
							<a href="/user/{post.authorHandle}" class="link hover:underline">{post.authorHandle}</a>
						</td>
						<td class="px-4 py-3 text-xs text-[rgb(var(--color-text-muted))]">
							{new Date(post.createdAt).toLocaleDateString()}{' '}
							{new Date(post.createdAt).toLocaleTimeString()}
						</td>
						<td class="px-4 py-3 text-xs font-mono text-[rgb(var(--color-text))] max-w-xs truncate">
							{post.bodyMarkdown.substring(0, 50)}{post.bodyMarkdown.length > 50 ? '…' : ''}
						</td>
						<td class="px-4 py-3">
							{#if post.status === 'active'}
								<span class="badge bg-green-50 text-green-700 border border-green-200">Active</span>
							{:else if post.status === 'hidden'}
								<span class="badge bg-gray-100 text-gray-700 border border-gray-300">Hidden</span>
							{:else if post.status === 'archived'}
								<span class="badge bg-blue-50 text-blue-700 border border-blue-200">Archived</span>
							{:else if post.status === 'deleted'}
								<span class="badge bg-red-50 text-red-700 border border-red-200">Permanently Deleted</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							{#if post.status === 'active'}
								<div class="space-y-2 mb-3">
									<button
										type="button"
										onclick={() => {
											movePostId = post.id;
											moveDestThreadId = post.threadId;
										}}
										class="block w-full text-xs text-blue-600 hover:underline text-left font-semibold"
									>
										Move to thread
									</button>
								</div>
								<form method="POST" action="?/hide" class="flex flex-col gap-1" onsubmit={confirmHide}>
									<input type="hidden" name="postId" value={post.id} />
									<label for="hide-reason-{post.id}" class="text-xs text-[rgb(var(--color-text-muted))]">Reason (optional)</label>
									<input
										type="text"
										id="hide-reason-{post.id}"
										name="reason"
										placeholder="Reason..."
										class="form-control text-xs"
									/>
									<button type="submit" class="text-xs text-[rgb(var(--color-error))] hover:underline text-left font-semibold">Hide post</button>
								</form>
							{:else if post.status === 'hidden'}
								<div class="space-y-2">
									<form method="POST" action="?/restore" class="inline">
										<input type="hidden" name="postId" value={post.id} />
										<button type="submit" class="text-xs text-[rgb(var(--color-success))] hover:underline font-semibold">Restore</button>
									</form>
									<form method="POST" action="?/permanentlyDelete" class="flex flex-col gap-1" onsubmit={confirmPermanentlyDelete}>
										<input type="hidden" name="postId" value={post.id} />
										<label for="delete-reason-{post.id}" class="text-xs text-[rgb(var(--color-text-muted))]">Delete reason</label>
										<input
											type="text"
											id="delete-reason-{post.id}"
											name="reason"
											placeholder="Reason..."
											class="form-control text-xs"
										/>
										<button type="submit" class="text-xs text-[rgb(var(--color-error))] hover:underline text-left font-semibold">Permanently delete</button>
									</form>
								</div>
							{:else if post.status === 'deleted'}
								<span class="text-xs text-[rgb(var(--color-text-muted))] italic">No actions available</span>
							{:else if post.status === 'archived'}
								<form method="POST" action="?/restore" class="inline">
									<input type="hidden" name="postId" value={post.id} />
									<button type="submit" class="text-xs text-[rgb(var(--color-success))] hover:underline font-semibold">Reactivate</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-xs text-[rgb(var(--color-text-muted))]">
		Showing {data.posts.length} posts (max 200){data.q ? ` matching "${data.q}"` : ', most recent first'}
	</p>

	<!-- Move post modal -->
	{#if movePostId}
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="move-post-title"
			tabindex="-1"
			class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			onclick={() => { movePostId = null; }}
			onkeydown={(e) => { if (e.key === 'Escape') movePostId = null; }}
		>
			<div class="bg-[rgb(var(--color-bg))] rounded-lg p-6 max-w-sm w-full mx-4 border border-[rgb(var(--color-border))]" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
				<h2 id="move-post-title" class="section-title mb-4">Move Post to Thread</h2>
				<form method="POST" action="?/movePost" onsubmit={() => { movePostId = null; }}>
					<input type="hidden" name="postId" value={movePostId} />
					<div class="form-group mb-4">
						<label for="destThread" class="form-label">Destination Thread:</label>
						<select
							id="destThread"
							name="destThreadId"
							bind:value={moveDestThreadId}
							class="form-control"
						>
							<option value="">Select a thread...</option>
							{#each data.threads as thread}
								<option value={thread.id}>{thread.title} ({thread.forumSlug})</option>
							{/each}
						</select>
					</div>
					<div class="flex gap-3">
						<button
							type="submit"
							disabled={!moveDestThreadId}
							class="btn btn-primary text-sm flex-1"
						>
							Move Post
						</button>
						<button
							type="button"
							onclick={() => { movePostId = null; }}
							class="btn btn-secondary text-sm flex-1"
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
