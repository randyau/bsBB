<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let selectedAction: string = $state(data.currentFilter || '');

	function handleFilterChange() {
		if (selectedAction) {
			window.location.href = `?action=${encodeURIComponent(selectedAction)}`;
		} else {
			window.location.href = '.';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">Moderation Log</h1>
		{#if data.actionTypes.length > 0}
			<div class="flex items-center gap-2">
				<label for="actionFilter" class="text-sm font-semibold">Filter by action:</label>
				<select
					id="actionFilter"
					bind:value={selectedAction}
					onchange={handleFilterChange}
					class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value="">All actions</option>
					{#each data.actionTypes as action}
						<option value={action}>{action}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>

	{#if data.entries.length > 0}
		<div class="rounded-lg border border-gray-200 overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-gray-100 border-b border-gray-200">
					<tr>
						<th class="px-4 py-3 text-left font-semibold">Timestamp</th>
						<th class="px-4 py-3 text-left font-semibold">Moderator</th>
						<th class="px-4 py-3 text-left font-semibold">Action</th>
						<th class="px-4 py-3 text-left font-semibold">Target</th>
						<th class="px-4 py-3 text-left font-semibold">Reason</th>
					</tr>
				</thead>
				<tbody>
					{#each data.entries as entry (entry.id)}
						<tr class="border-b border-gray-200 hover:bg-gray-50">
							<td class="px-4 py-3 text-xs text-gray-600">
								{new Date(entry.createdAt).toLocaleDateString()}{' '}
								{new Date(entry.createdAt).toLocaleTimeString()}
							</td>
							<td class="px-4 py-3 font-mono text-xs">{entry.moderatorHandle}</td>
							<td class="px-4 py-3">
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
									{entry.action}
								</span>
							</td>
							<td class="px-4 py-3 text-sm">
								{#if entry.targetUserHandle}
									<span class="font-mono">@{entry.targetUserHandle}</span>
								{:else if entry.targetThreadTitle}
									<span class="text-gray-700">{entry.targetThreadTitle}</span>
								{:else if entry.targetPostId}
									<span class="font-mono text-xs">post:{entry.targetPostId}</span>
								{:else}
									<span class="text-gray-400">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
								{entry.reason || '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-xs text-gray-500">
			Showing {data.entries.length} of last 200 entries{data.currentFilter ? ` (filtered by: ${data.currentFilter})` : ''}
		</p>
	{:else}
		<div class="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center">
			<p class="text-sm text-gray-600">No moderation actions found{data.currentFilter ? ` for action: ${data.currentFilter}` : ''}.</p>
		</div>
	{/if}
</div>
