<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);
	let deleteReason: Record<string, string> = $state({});
	let showDeleteReason: Record<string, boolean> = $state({});
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">Post Management</h1>

	{#if form?.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 text-sm">
			✓ Post action completed: {form.action}
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="bg-gray-100 border-b border-gray-200">
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
						class={`border-b border-gray-200 ${post.isDeleted ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'}`}
					>
						<td class="px-4 py-3">
							<a
								href="/f/general/t/{post.threadId}/{post.threadSlug}"
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-600 hover:underline"
							>
								{post.threadTitle}
							</a>
						</td>
						<td class="px-4 py-3 font-mono text-xs">{post.authorHandle}</td>
						<td class="px-4 py-3 text-xs text-gray-500">
							{new Date(post.createdAt).toLocaleDateString()}{' '}
							{new Date(post.createdAt).toLocaleTimeString()}
						</td>
						<td class="px-4 py-3 text-xs font-mono text-gray-700 max-w-xs truncate">
							{post.bodyMarkdown.substring(0, 50)}
							{post.bodyMarkdown.length > 50 ? '…' : ''}
						</td>
						<td class="px-4 py-3">
							{#if post.isDeleted}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800"
									>🗑️ Deleted</span
								>
							{:else}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800"
									>✓ Active</span
								>
							{/if}
						</td>
						<td class="px-4 py-3 space-x-2 flex flex-wrap gap-1">
							{#if post.isDeleted}
								<form method="POST" action="?/restore" class="inline">
									<input type="hidden" name="postId" value={post.id} />
									<button type="submit" class="text-xs text-green-600 hover:underline font-semibold"
										>Restore</button
									>
								</form>
							{:else}
								<div class="flex gap-1">
									{#if showDeleteReason[post.id]}
										<form method="POST" action="?/delete" class="inline">
											<input type="hidden" name="postId" value={post.id} />
											<input type="hidden" name="reason" value={deleteReason[post.id] || ''} />
											<button
												type="submit"
												class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
											>
												Delete
											</button>
										</form>
										<input
											type="text"
											placeholder="Reason..."
											bind:value={deleteReason[post.id]}
											class="text-xs px-2 py-1 border border-gray-300 rounded w-32"
										/>
										<button
											onclick={() => (showDeleteReason[post.id] = false)}
											class="text-xs text-gray-600 hover:text-gray-800"
										>
											✕
										</button>
									{:else}
										<button
											onclick={() => (showDeleteReason[post.id] = true)}
											class="text-xs text-red-600 hover:underline"
										>
											Delete
										</button>
									{/if}
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-xs text-gray-500">Showing last 200 posts (including deleted)</p>
</div>
