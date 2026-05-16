<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">Thread Management</h1>

	{#if form?.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 text-sm">
			✓ Thread action completed: {form.action}
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="bg-gray-100 border-b border-gray-200">
				<tr>
					<th class="px-4 py-3 text-left font-semibold">Forum</th>
					<th class="px-4 py-3 text-left font-semibold">Thread</th>
					<th class="px-4 py-3 text-left font-semibold">Author</th>
					<th class="px-4 py-3 text-left font-semibold">Posts</th>
					<th class="px-4 py-3 text-left font-semibold">Last Activity</th>
					<th class="px-4 py-3 text-left font-semibold">Status</th>
					<th class="px-4 py-3 text-left font-semibold">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.threads as thread (thread.id)}
					<tr class="border-b border-gray-200 hover:bg-gray-50">
						<td class="px-4 py-3 font-mono text-xs">{thread.forumName}</td>
						<td class="px-4 py-3">
							<a
								href="/f/{thread.forumSlug}/t/{thread.id}/{thread.slug}"
								target="_blank"
								rel="noopener noreferrer"
								class="text-blue-600 hover:underline"
							>
								{thread.title}
							</a>
						</td>
						<td class="px-4 py-3 font-mono text-xs">{thread.authorHandle}</td>
						<td class="px-4 py-3 text-center">{thread.postCount}</td>
						<td class="px-4 py-3 text-xs text-gray-500">
							{new Date(thread.lastPostAt).toLocaleDateString()}{' '}
							{new Date(thread.lastPostAt).toLocaleTimeString()}
						</td>
						<td class="px-4 py-3 space-x-1">
							{#if thread.isLocked}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800"
									>🔒 Locked</span
								>
							{/if}
							{#if thread.isPinned}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800"
									>📌 Pinned</span
								>
							{/if}
						</td>
						<td class="px-4 py-3 space-x-2 flex flex-wrap gap-1">
							{#if thread.isLocked}
								<form method="POST" action="?/unlock" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button
										type="submit"
										class="text-xs text-green-600 hover:underline font-semibold"
									>
										Unlock
									</button>
								</form>
							{:else}
								<form method="POST" action="?/lock" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button
										type="submit"
										class="text-xs text-orange-600 hover:underline font-semibold"
									>
										Lock
									</button>
								</form>
							{/if}

							{#if thread.isPinned}
								<form method="POST" action="?/unpin" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button
										type="submit"
										class="text-xs text-purple-600 hover:underline font-semibold"
									>
										Unpin
									</button>
								</form>
							{:else}
								<form method="POST" action="?/pin" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button
										type="submit"
										class="text-xs text-purple-600 hover:underline font-semibold"
									>
										Pin
									</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-xs text-gray-500">Total threads: {data.threads.length}</p>
</div>
