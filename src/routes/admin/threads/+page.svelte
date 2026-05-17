<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { goto } from '$app/navigation';
	import TableSearch from '$components/TableSearch.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let forumVal = $state(data.forumFilter);
	let periodVal = $state(data.period);

	$effect(() => {
		forumVal = data.forumFilter;
		periodVal = data.period;
	});

	function navigate() {
		const params = new URLSearchParams();
		if (forumVal) params.set('forum', forumVal);
		if (periodVal && periodVal !== 'all') params.set('period', periodVal);
		if (data.q) params.set('q', data.q);
		goto('?' + params.toString());
	}

	const totalPages = $derived(Math.ceil(data.total / data.pageSize));

	function pageUrl(p: number) {
		const params = new URLSearchParams();
		if (data.forumFilter) params.set('forum', data.forumFilter);
		if (data.period && data.period !== 'all') params.set('period', data.period);
		if (data.q) params.set('q', data.q);
		params.set('page', String(p));
		return '?' + params.toString();
	}

	const start = $derived((data.page - 1) * data.pageSize + 1);
	const end = $derived(Math.min(data.page * data.pageSize, data.total));
</script>

<div class="space-y-6">
	<h1 class="page-title">Thread Management</h1>

	{#if form?.error}
		<div class="alert alert-error text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success text-sm">
			✓ Thread action completed: {form.action}
		</div>
	{/if}

	<!-- Filter bar -->
	<div class="flex flex-wrap gap-3 items-center">
		<TableSearch
			value={data.q}
			placeholder="Search title or author..."
			clearHref={(() => {
				const p = new URLSearchParams();
				if (data.forumFilter) p.set('forum', data.forumFilter);
				if (data.period && data.period !== 'all') p.set('period', data.period);
				return '?' + p.toString();
			})()}
			extraParams={{
				...(data.forumFilter ? { forum: data.forumFilter } : {}),
				...(data.period && data.period !== 'all' ? { period: data.period } : {})
			}}
		/>

		<select
			bind:value={forumVal}
			onchange={navigate}
			class="form-control text-sm select-w-md"
		>
			<option value="">All forums</option>
			{#each data.forums as forum}
				<option value={forum.slug}>{forum.name}</option>
			{/each}
		</select>

		<select
			bind:value={periodVal}
			onchange={navigate}
			class="form-control text-sm select-w-sm"
		>
			<option value="all">All time</option>
			<option value="week">Past week</option>
			<option value="month">Past month</option>
			<option value="year">Past year</option>
		</select>

		{#if data.forumFilter || (data.period && data.period !== 'all') || data.q}
			<a href="?" class="btn btn-sm btn-secondary">Clear all</a>
		{/if}

		<span class="text-xs text-[rgb(var(--color-text-muted))]">
			{#if data.total > 0}
				Showing {start}–{end} of {data.total} threads
			{:else}
				No threads found
			{/if}
		</span>
	</div>

	<div class="table-container">
		<table class="w-full text-sm">
			<thead class="bg-[rgb(var(--color-bg-tertiary))] border-b border-[rgb(var(--color-border))]">
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
					<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
						<td class="px-4 py-3 font-mono text-xs">{thread.forumName}</td>
						<td class="px-4 py-3">
							<a
								href="/f/{thread.forumSlug}/t/{thread.id}/{thread.slug}"
								target="_blank"
								rel="noopener noreferrer"
								class="text-[rgb(var(--color-primary))] hover:underline"
							>
								{thread.title}
							</a>
						</td>
						<td class="px-4 py-3 font-mono text-xs">
							<a href="/user/{thread.authorHandle}" class="link hover:underline">{thread.authorHandle}</a>
						</td>
						<td class="px-4 py-3 text-center">{thread.postCount}</td>
						<td class="px-4 py-3 text-xs text-[rgb(var(--color-text-muted))]">
							{new Date(thread.lastPostAt).toLocaleDateString()}{' '}
							{new Date(thread.lastPostAt).toLocaleTimeString()}
						</td>
						<td class="px-4 py-3 space-x-1">
							{#if thread.isLocked}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800">Locked</span>
							{/if}
							{#if thread.isPinned}
								<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">Pinned</span>
							{/if}
						</td>
						<td class="px-4 py-3 space-x-2 flex gap-1">
							{#if thread.isLocked}
								<form method="POST" action="?/unlock" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button type="submit" class="text-xs text-[rgb(var(--color-success))] hover:underline font-semibold">Unlock</button>
								</form>
							{:else}
								<form method="POST" action="?/lock" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button type="submit" class="text-xs text-orange-600 hover:underline font-semibold">Lock</button>
								</form>
							{/if}

							{#if thread.isPinned}
								<form method="POST" action="?/unpin" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button type="submit" class="text-xs text-purple-600 hover:underline font-semibold">Unpin</button>
								</form>
							{:else}
								<form method="POST" action="?/pin" class="inline">
									<input type="hidden" name="threadId" value={thread.id} />
									<button type="submit" class="text-xs text-purple-600 hover:underline font-semibold">Pin</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div class="flex items-center gap-4 text-sm">
			{#if data.page > 1}
				<a href={pageUrl(data.page - 1)} class="btn btn-sm btn-secondary">← Prev</a>
			{:else}
				<span class="btn btn-sm btn-secondary opacity-40 cursor-not-allowed">← Prev</span>
			{/if}

			<span class="text-[rgb(var(--color-text-muted))]">Page {data.page} of {totalPages}</span>

			{#if data.page < totalPages}
				<a href={pageUrl(data.page + 1)} class="btn btn-sm btn-secondary">Next →</a>
			{:else}
				<span class="btn btn-sm btn-secondary opacity-40 cursor-not-allowed">Next →</span>
			{/if}
		</div>
	{/if}
</div>
