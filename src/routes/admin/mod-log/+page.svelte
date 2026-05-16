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
					class="px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
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
		<div class="rounded-lg border border-[rgb(var(--color-border))] overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="bg-[rgb(var(--color-bg-tertiary))] border-b border-[rgb(var(--color-border))]">
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
						<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
							<td class="px-4 py-3 text-xs text-[rgb(var(--color-text-secondary))]">
								{new Date(entry.createdAt).toLocaleDateString()}{' '}
								{new Date(entry.createdAt).toLocaleTimeString()}
							</td>
							<td class="px-4 py-3 font-mono text-xs">{entry.moderatorHandle}</td>
							<td class="px-4 py-3">
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-primary))]">
									{entry.action}
								</span>
							</td>
							<td class="px-4 py-3 text-sm">
								{#if entry.targetUserHandle}
									<span class="font-mono">@{entry.targetUserHandle}</span>
								{:else if entry.targetThreadTitle}
									<span class="text-[rgb(var(--color-text))]">{entry.targetThreadTitle}</span>
								{:else if entry.targetPostId}
									<span class="font-mono text-xs">post:{entry.targetPostId}</span>
								{:else}
									<span class="text-[rgb(var(--color-text-muted))]">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-[rgb(var(--color-text-secondary))] max-w-xs truncate">
								{entry.reason || '—'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-xs text-[rgb(var(--color-text-muted))]">
			Showing {data.entries.length} of last 200 entries{data.currentFilter ? ` (filtered by: ${data.currentFilter})` : ''}
		</p>
	{:else}
		<div class="rounded-lg bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] p-8 text-center">
			<p class="text-sm text-[rgb(var(--color-text-secondary))]">No moderation actions found{data.currentFilter ? ` for action: ${data.currentFilter}` : ''}.</p>
		</div>
	{/if}
</div>
