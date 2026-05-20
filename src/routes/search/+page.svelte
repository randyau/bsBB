<script lang="ts">
	import type { PageData } from './$types';
	import { formatTimeDisplay } from '$lib/utils/time';
	import Pagination from '$components/Pagination.svelte';
	import EmptyState from '$components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();
	let searchInput = $state('');
	$effect(() => { searchInput = data.query; });
	let sortBy = $state('relevance');
	let sortedResults = $derived.by(() => {
		const results = [...data.results];
		switch (sortBy) {
			case 'newest':
				return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			case 'oldest':
				return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
			case 'relevance':
			default:
				return results.sort((a, b) => b.relevance - a.relevance);
		}
	});

	function handleSearch(e: Event) {
		e.preventDefault();
		if (searchInput.trim()) {
			window.location.href = `/search?q=${encodeURIComponent(searchInput)}&page=1`;
		}
	}
</script>

<div class="max-w-4xl mx-auto py-8 px-4">
	<!-- Search Bar -->
	<form onsubmit={handleSearch} class="mb-8">
		<label for="search-input" class="sr-only">Search posts</label>
		<div class="flex gap-2">
			<input
				id="search-input"
				type="text"
				bind:value={searchInput}
				placeholder="Search posts... (tip: author:handle to filter by user)"
				class="flex-1 px-4 py-3 border rounded-lg"
			/>
			<button
				type="submit"
				class="px-6 py-3 btn-primary rounded-lg"
			>
				Search
			</button>
		</div>
	</form>

	{#if data.error}
		<div class="card-secondary text-error mb-6">
			{data.error}
		</div>
	{:else if !data.query}
		<EmptyState message="Enter a search term to find posts">
			<p class="text-xs text-muted mt-2">Tip: use <code class="font-mono bg-[rgb(var(--color-bg-tertiary))] px-1 rounded">author:handle</code> to find posts by a specific user</p>
		</EmptyState>
	{:else if data.results.length === 0}
		<EmptyState
			message={data.authorFilter
				? `No posts found by @${data.authorFilter}${data.contentQuery ? ` containing "${data.contentQuery}"` : ''}`
				: `No results found for "${data.contentQuery}"`}
		/>
	{:else}
		<!-- Results Header -->
		<div class="mb-6">
			<h1 class="page-title mb-2">Search Results</h1>
			{#if data.authorFilter}
				<p class="text-secondary">
					{#if data.contentQuery}
						Found {data.total} result{data.total === 1 ? '' : 's'} by <a href="/user/{data.authorFilter}" class="link font-mono">@{data.authorFilter}</a> matching "<strong>{data.contentQuery}</strong>"
					{:else}
						Showing all {data.total} post{data.total === 1 ? '' : 's'} by <a href="/user/{data.authorFilter}" class="link font-mono">@{data.authorFilter}</a>
					{/if}
					<a href="/search?q={encodeURIComponent(data.contentQuery)}" class="ml-2 text-xs text-muted hover:underline">× clear author filter</a>
				</p>
			{:else}
				<p class="text-secondary">
					Found {data.total} result{data.total === 1 ? '' : 's'} for "<strong>{data.contentQuery}</strong>"
				</p>
			{/if}
		</div>

		<!-- Sort Controls -->
		<div class="mb-6 flex items-center gap-4">
			<label for="sort" class="text-sm text-secondary">Sort by:</label>
			<select id="sort" bind:value={sortBy} class="px-3 py-2 border rounded">
				<option value="relevance">Relevance</option>
				<option value="newest">Newest First</option>
				<option value="oldest">Oldest First</option>
			</select>
			<span class="text-xs text-muted">
				{sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
			</span>
		</div>

		<!-- Results List -->
		<div class="space-y-4 mb-8">
			{#each sortedResults as result (result.postId)}
				<div class="card">
					<div class="flex items-start justify-between gap-4 mb-2">
						<div>
							<a href="/f/{result.forumSlug}/t/{result.threadSlug}" class="font-semibold hover:underline text-primary">
								{result.threadTitle}
							</a>
							<p class="text-sm text-secondary">
								by <a
									href="/search?q=author:{encodeURIComponent(result.authorHandle)}"
									class="link font-mono hover:underline"
								>@{result.authorHandle}</a> in <span class="italic">{result.forumSlug}</span>
							</p>
						</div>
						<div class="text-right text-xs text-muted whitespace-nowrap">
							<span>{formatTimeDisplay(result.createdAt, data.user?.timezone)}</span>
						</div>
					</div>

					<!-- Preview -->
					<p class="text-sm line-clamp-3">
						{result.bodyPreview || '[no preview available]'}
					</p>

					<!-- Relevance Badge -->
					{#if result.relevance > 0 && !data.authorFilter}
						<div class="mt-2 flex items-center gap-2">
							<span class="badge badge-primary">
								{(result.relevance * 100).toFixed(0)}% match
							</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<Pagination
			page={data.page}
			totalPages={data.totalPages}
			total={data.total}
			buildUrl={(p) => `/search?q=${encodeURIComponent(data.query)}&page=${p}`}
		/>
	{/if}
</div>
