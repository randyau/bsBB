<script lang="ts">
	import type { PageData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';

	let { data }: { data: PageData } = $props();
	let selectedAction = $state(data.currentFilter || '');

	$effect(() => {
		selectedAction = data.currentFilter || '';
	});

	function handleActionChange() {
		const params = new URLSearchParams();
		if (selectedAction) params.set('action', selectedAction);
		if (data.q) params.set('q', data.q);
		window.location.href = '?' + params.toString();
	}
</script>

<div class="space-y-6">
	<h1 class="page-title">Moderation Log</h1>

	<div class="flex flex-wrap items-center gap-3">
		<TableSearch
			value={data.q}
			placeholder="Search by moderator handle..."
			clearHref={data.currentFilter ? `?action=${data.currentFilter}` : '/admin/mod-log'}
			extraParams={data.currentFilter ? { action: data.currentFilter } : {}}
		/>

		{#if data.actionTypes.length > 0}
			<select
				bind:value={selectedAction}
				onchange={handleActionChange}
				class="form-control text-sm select-w-md"
			>
				<option value="">All actions</option>
				{#each data.actionTypes as action}
					<option value={action}>{action}</option>
				{/each}
			</select>
		{/if}

		{#if data.currentFilter || data.q}
			<a
				href="/admin/mod-log"
				class="btn btn-sm btn-secondary"
			>
				Clear filters
			</a>
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
							<td class="px-4 py-3 font-mono text-xs">
								<a href="/user/{entry.moderatorHandle}" class="link hover:underline">{entry.moderatorHandle}</a>
							</td>
							<td class="px-4 py-3">
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-primary))]">
									{entry.action}
								</span>
							</td>
							<td class="px-4 py-3 text-sm">
								{#if entry.targetUserHandle}
									<a href="/user/{entry.targetUserHandle}" class="link font-mono hover:underline">@{entry.targetUserHandle}</a>
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
			Showing {data.entries.length} of last 200 entries
			{#if data.currentFilter || data.q}
				(filtered{data.currentFilter ? ` by action: ${data.currentFilter}` : ''}{data.q ? ` by moderator: ${data.q}` : ''})
			{/if}
		</p>
	{:else}
		<div class="rounded-lg bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] p-8 text-center">
			<p class="text-sm text-[rgb(var(--color-text-secondary))]">
				No moderation actions found
				{#if data.currentFilter || data.q}
					matching current filters
				{/if}.
			</p>
		</div>
	{/if}
</div>
