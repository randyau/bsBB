<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let searchInput = $state(data.query);

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
		<div class="flex gap-2">
			<input
				type="text"
				bind:value={searchInput}
				placeholder="Search posts..."
				class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
			<button
				type="submit"
				class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
			>
				Search
			</button>
		</div>
	</form>

	{#if data.error}
		<div class="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 mb-6">
			{data.error}
		</div>
	{:else if !data.query}
		<div class="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center text-gray-600">
			Enter a search term to find posts
		</div>
	{:else if data.results.length === 0}
		<div class="rounded-lg bg-gray-50 border border-gray-200 p-8 text-center text-gray-600">
			No results found for "{data.query}"
		</div>
	{:else}
		<!-- Results Header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold mb-2">Search Results</h1>
			<p class="text-gray-600">
				Found {data.total} result{data.total === 1 ? '' : 's'} for "<strong>{data.query}</strong>"
			</p>
		</div>

		<!-- Results List -->
		<div class="space-y-4 mb-8">
			{#each data.results as result (result.postId)}
				<a
					href="/f/{result.forumSlug}/t/{result.threadSlug}"
					class="rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition"
				>
					<div class="flex items-start justify-between gap-4 mb-2">
						<div>
							<h3 class="font-semibold text-blue-600 hover:underline">
								{result.threadTitle}
							</h3>
							<p class="text-sm text-gray-600">
								by <span class="font-mono">@{result.authorHandle}</span> in <span class="italic">{result.forumSlug}</span>
							</p>
						</div>
						<div class="text-right text-xs text-gray-500 whitespace-nowrap">
							{formatDate(result.createdAt)}
						</div>
					</div>

					<!-- Preview -->
					<p class="text-sm text-gray-700 line-clamp-3">
						{result.bodyPreview || '[no preview available]'}
					</p>

					<!-- Relevance Badge -->
					{#if result.relevance > 0}
						<div class="mt-2 flex items-center gap-2">
							<div class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
								{(result.relevance * 100).toFixed(0)}% match
							</div>
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
						class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
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
							? 'bg-blue-600 text-white border-blue-600'
							: 'border-gray-300 hover:bg-gray-50'}"
					>
						{pageNum}
					</a>
				{/each}

				{#if data.page < data.totalPages}
					<a
						href="/search?q={encodeURIComponent(data.query)}&page={data.page + 1}"
						class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
					>
						Next →
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>
