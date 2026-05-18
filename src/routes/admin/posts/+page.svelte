<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { formatTimeDisplay } from '$lib/utils/time';
	import TableSearch from '$components/TableSearch.svelte';
	import AdminPageShell from '$components/AdminPageShell.svelte';
	import Pagination from '$components/Pagination.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let movePostId: string | null = $state(null);
	let moveDestThreadId: string = $state('');

	let selectedPostIds: Set<string> = $state(new Set());
	let bulkActionType: string | null = $state(null);
	let bulkActionConfirming = $state(false);

	function confirmHide(): boolean {
		return confirm('Hide this post? It will be removed from view but content is preserved and it can be restored.');
	}

	function confirmPermanentlyDelete(): boolean {
		return confirm(
			'Permanently delete this post?\n\nThis will irreversibly clear all content. The post stub will remain for quotes/links, but content cannot be recovered.\n\nThis action cannot be undone.'
		);
	}

	function toggleSelectAll() {
		if (selectedPostIds.size === data.posts.length) {
			selectedPostIds = new Set();
		} else {
			selectedPostIds = new Set(data.posts.map(p => p.id));
		}
	}

	function togglePostSelection(postId: string) {
		if (selectedPostIds.has(postId)) {
			selectedPostIds.delete(postId);
		} else {
			selectedPostIds.add(postId);
		}
		selectedPostIds = new Set(selectedPostIds);
	}

	function confirmBulkAction(action: string) {
		bulkActionType = action;
		bulkActionConfirming = true;
	}

	function cancelBulkAction() {
		bulkActionType = null;
		bulkActionConfirming = false;
	}

	function executeBulkAction(action: string) {
		const postIdList = Array.from(selectedPostIds).join(',');
		const formEl = document.createElement('form');
		formEl.method = 'POST';
		formEl.action = `?/bulkAction`;

		const actionInput = document.createElement('input');
		actionInput.type = 'hidden';
		actionInput.name = 'action';
		actionInput.value = action;

		const idsInput = document.createElement('input');
		idsInput.type = 'hidden';
		idsInput.name = 'postIds';
		idsInput.value = postIdList;

		formEl.appendChild(actionInput);
		formEl.appendChild(idsInput);
		document.body.appendChild(formEl);
		formEl.submit();

		cancelBulkAction();
	}
</script>

<AdminPageShell title="Post Management" {form}>
	<div class="space-y-6">
		<div class="flex flex-wrap items-center gap-3">
			<TableSearch
				value={data.q}
				placeholder="Search by author handle or thread title..."
				clearHref="/admin/posts"
			/>
		</div>

		<!-- Bulk actions bar -->
		{#if selectedPostIds.size > 0}
			<div class="bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] rounded p-4 flex items-center justify-between">
				<span class="text-sm font-semibold">{selectedPostIds.size} post{selectedPostIds.size !== 1 ? 's' : ''} selected</span>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => confirmBulkAction('hide')}
						class="btn btn-sm btn-secondary text-xs"
					>
						Hide selected
					</button>
					<button
						type="button"
						onclick={() => confirmBulkAction('restore')}
						class="btn btn-sm btn-secondary text-xs"
					>
						Restore selected
					</button>
					<button
						type="button"
						onclick={() => { selectedPostIds = new Set(); }}
						class="btn btn-sm btn-secondary text-xs"
					>
						Clear selection
					</button>
				</div>
			</div>
		{/if}

		<!-- Top pagination -->
		{#if data.totalPages > 1}
			<Pagination
				page={data.page}
				totalPages={data.totalPages}
				total={data.totalPosts}
				buildUrl={(p) => `?page=${p}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`}
			/>
		{/if}

		<div class="table-container">
			<table class="w-full text-sm">
				<thead class="table-thead">
					<tr>
						<th class="px-4 py-3 text-left">
							<input
								type="checkbox"
								checked={selectedPostIds.size === data.posts.length && data.posts.length > 0}
								onchange={toggleSelectAll}
								title="Select all posts"
								aria-label="Select all posts on this page"
							/>
						</th>
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
								<input
									type="checkbox"
									checked={selectedPostIds.has(post.id)}
									onchange={() => togglePostSelection(post.id)}
									aria-label="Select post"
								/>
							</td>
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
								<span>{formatTimeDisplay(post.createdAt)}</span>
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
			Showing {data.posts.length} posts{data.q ? ` matching "${data.q}"` : ', most recent first'}
		</p>

		<Pagination
			page={data.page}
			totalPages={data.totalPages}
			total={data.total}
			buildUrl={(p) => `?page=${p}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`}
		/>

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
				<div role="none" class="bg-[rgb(var(--color-bg))] rounded-lg p-6 max-w-sm w-full mx-4 border border-[rgb(var(--color-border))]" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
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

		<!-- Bulk action confirmation modal -->
		{#if bulkActionConfirming && bulkActionType}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="bulk-action-title"
				tabindex="-1"
				class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
				onclick={cancelBulkAction}
				onkeydown={(e) => { if (e.key === 'Escape') cancelBulkAction(); }}
			>
				<div role="none" class="bg-[rgb(var(--color-bg))] rounded-lg p-6 max-w-sm w-full mx-4 border border-[rgb(var(--color-border))]" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
					<h2 id="bulk-action-title" class="section-title mb-4">Confirm Bulk Action</h2>
					<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
						{#if bulkActionType === 'hide'}
							Hide {selectedPostIds.size} post{selectedPostIds.size !== 1 ? 's' : ''}?
							<br /><br />
							Posts will be removed from view but content is preserved and can be restored.
						{:else if bulkActionType === 'restore'}
							Restore {selectedPostIds.size} post{selectedPostIds.size !== 1 ? 's' : ''}?
							<br /><br />
							Hidden posts will be made visible again.
						{/if}
					</p>
					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => executeBulkAction(bulkActionType ?? '')}
							class="btn btn-primary text-sm flex-1"
						>
							Confirm
						</button>
						<button
							type="button"
							onclick={cancelBulkAction}
							class="btn btn-secondary text-sm flex-1"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</AdminPageShell>
