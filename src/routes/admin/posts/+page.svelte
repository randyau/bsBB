<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">Post Management</h1>

	{#if form?.error}
		<div class="rounded-lg border border-[rgb(var(--color-error))] bg-[rgb(var(--color-bg-secondary))] p-4 text-[rgb(var(--color-error))] text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg border border-[rgb(var(--color-success))] bg-[rgb(var(--color-bg-secondary))] p-4 text-[rgb(var(--color-success))] text-sm">
			✓ Post action completed: {form.action}
		</div>
	{/if}

	<TableSearch
		value={data.q}
		placeholder="Search by author handle or thread title..."
		clearHref="/admin/posts"
	/>

	<div class="rounded-lg border border-[rgb(var(--color-border))] overflow-x-auto">
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
						class={`border-b border-[rgb(var(--color-border))] ${post.isDeleted ? 'bg-[rgb(var(--color-bg-tertiary))] opacity-60' : 'hover:bg-[rgb(var(--color-bg-secondary))]'}`}
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
							{#if post.isDeleted}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-error))]">Deleted</span>
							{:else}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-success))]">Active</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							{#if post.isDeleted}
								<form method="POST" action="?/restore" class="inline">
									<input type="hidden" name="postId" value={post.id} />
									<button type="submit" class="text-xs text-[rgb(var(--color-success))] hover:underline font-semibold">Restore</button>
								</form>
							{:else}
								<form method="POST" action="?/delete" class="flex gap-1 items-center">
									<input type="hidden" name="postId" value={post.id} />
									<input
										type="text"
										name="reason"
										placeholder="Reason..."
										class="form-control text-xs px-1 w-24 input-inline"
									/>
									<button type="submit" class="text-xs text-[rgb(var(--color-error))] hover:underline whitespace-nowrap">Delete</button>
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
</div>
