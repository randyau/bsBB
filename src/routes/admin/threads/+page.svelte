<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { goto } from '$app/navigation';
	import { formatTimeDisplay } from '$lib/utils/time';
	import TableSearch from '$components/TableSearch.svelte';
	import AdminPageShell from '$components/AdminPageShell.svelte';
	import Pagination from '$components/Pagination.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let forumVal = $state('');
	let periodVal = $state('');
	let moveThreadId: string | null = $state(null);
	let moveDestForumId: string = $state('');

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

<AdminPageShell title="Thread Management" {form}>
	<div class="space-y-6">
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

			<label for="forumFilter" class="sr-only">Filter by forum</label>
			<select
				id="forumFilter"
				bind:value={forumVal}
				onchange={navigate}
				class="form-control text-sm select-w-md"
			>
				<option value="">All forums</option>
				{#each data.forums as forum}
					<option value={forum.slug}>{forum.name}</option>
				{/each}
			</select>

			<label for="periodFilter" class="sr-only">Filter by time period</label>
			<select
				id="periodFilter"
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

		<!-- Top pagination -->
		{#if data.totalPages > 1}
			<Pagination
				page={data.page}
				totalPages={data.totalPages}
				total={data.total}
				buildUrl={(p) => {
					const params = new URLSearchParams();
					params.set('page', String(p));
					if (data.q) params.set('q', data.q);
					if (data.forumFilter) params.set('forum', data.forumFilter);
					if (data.period && data.period !== 'all') params.set('period', data.period);
					return '?' + params.toString();
				}}
			/>
		{/if}

		<div class="table-container">
			<table class="w-full text-sm">
				<thead class="table-thead">
					<tr>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Forum</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Thread</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Author</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Posts</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Last Activity</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Status</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Actions</th>
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
								<span>{formatTimeDisplay(thread.lastPostAt)}</span>
							</td>
							<td class="px-4 py-3 space-x-1">
								{#if thread.isLocked}
									<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-800">Locked</span>
								{/if}
								{#if thread.isPinned}
									<span class="inline-block px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">Pinned</span>
								{/if}
							</td>
							<td class="px-4 py-3 space-x-2 flex gap-1 flex-wrap">
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

								<button
									type="button"
									onclick={() => {
										moveThreadId = thread.id;
										moveDestForumId = thread.forumSlug;
									}}
									class="text-xs text-blue-600 hover:underline font-semibold"
								>
									Move
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Pagination
			page={data.page}
			totalPages={totalPages}
			total={data.total}
			buildUrl={pageUrl}
		/>

		<!-- Move thread modal -->
		{#if moveThreadId}
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="move-thread-title"
				tabindex="-1"
				class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
				onclick={() => { moveThreadId = null; }}
				onkeydown={(e) => { if (e.key === 'Escape') moveThreadId = null; }}
			>
				<div role="none" class="bg-[rgb(var(--color-bg))] rounded-lg p-6 max-w-sm w-full mx-4 border border-[rgb(var(--color-border))]" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
					<h2 id="move-thread-title" class="section-title mb-4">Move Thread to Forum</h2>
					<form method="POST" action="?/moveThread" onsubmit={() => { moveThreadId = null; }}>
						<input type="hidden" name="threadId" value={moveThreadId} />
						<div class="form-group mb-4">
							<label for="destForum" class="form-label">Destination Forum:</label>
							<select
								id="destForum"
								name="destForumId"
								bind:value={moveDestForumId}
								class="form-control"
							>
								<option value="">Select a forum...</option>
								{#each data.forums as forum}
									<option value={forum.id}>{forum.name}</option>
								{/each}
							</select>
						</div>
						<div class="flex gap-3">
							<button
								type="submit"
								disabled={!moveDestForumId}
								class="btn btn-primary text-sm flex-1"
							>
								Move Thread
							</button>
							<button
								type="button"
								onclick={() => { moveThreadId = null; }}
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
</AdminPageShell>
