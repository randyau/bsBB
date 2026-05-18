<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let searchInput = $state(data.query);
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

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
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
				placeholder="Search posts..."
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
		<div class="card-secondary text-center text-secondary p-8">
			Enter a search term to find posts
		</div>
	{:else if data.results.length === 0}
		<div class="card-secondary text-center text-secondary p-8">
			No results found for "{data.query}"
		</div>
	{:else}
		<!-- Results Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold mb-2">Search Results</h1>
			<p class="text-secondary">
				Found {data.total} result{data.total === 1 ? '' : 's'} for "<strong>{data.query}</strong>"
			</p>
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
				<a href="/f/{result.forumSlug}/t/{result.threadSlug}" class="block card">
					<div class="flex items-start justify-between gap-4 mb-2">
						<div>
							<h3 class="font-semibold hover:underline text-primary">
								{result.threadTitle}
							</h3>
							<p class="text-sm text-secondary">
								by <span class="font-mono">@{result.authorHandle}</span> in <span class="italic">{result.forumSlug}</span>
							</p>
						</div>
						<div class="text-right text-xs text-muted whitespace-nowrap">
							{formatDate(result.createdAt)}
						</div>
					</div>

					<!-- Preview -->
					<p class="text-sm line-clamp-3">
						{result.bodyPreview || '[no preview available]'}
					</p>

					<!-- Relevance Badge -->
					{#if result.relevance > 0}
						<div class="mt-2 flex items-center gap-2">
							<span class="badge badge-primary">
								{(result.relevance * 100).toFixed(0)}% match
							</span>
						</div>
					{/if}
				</a>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="flex justify-center gap-2">
				{#if data.page > 1}
					<a
						href="/search?q={encodeURIComponent(data.query)}&page={data.page - 1}"
						class="px-4 py-2 border rounded hover:bg-tertiary"
					>
						← Previous
					</a>
				{/if}

				{#each Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
					const startPage = Math.max(1, data.page - 2);
					return startPage + i;
				}) as pageNum}
					<a
						href="/search?q={encodeURIComponent(data.query)}&page={pageNum}"
						class="px-4 py-2 rounded border {pageNum === data.page
							? 'btn-primary text-white'
							: 'hover:bg-tertiary'}"
					>
						{pageNum}
					</a>
				{/each}

				{#if data.page < data.totalPages}
					<a
						href="/search?q={encodeURIComponent(data.query)}&page={data.page + 1}"
						class="px-4 py-2 border rounded hover:bg-tertiary"
					>
						Next →
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>
