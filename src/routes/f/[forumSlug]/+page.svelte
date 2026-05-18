<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatTime(date: Date) {
		const now = new Date();
		const diffMs = now.getTime() - new Date(date).getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return new Date(date).toLocaleDateString();
	}
</script>

<div class="space-y-6 py-8">
	<!-- Forum Header -->
	<div class="flex items-start justify-between gap-4 px-4 md:px-8">
		<div class="flex-1">
			<h1 class="page-title">{data.forum.name}</h1>
			{#if data.forum.description}
				<p class="mt-2 text-secondary">{data.forum.description}</p>
			{/if}
			<div class="mt-3 flex flex-wrap gap-4 text-sm text-muted">
				<span>{data.stats.totalThreads} thread{data.stats.totalThreads !== 1 ? 's' : ''}</span>
				<span>{data.stats.totalPosts} post{data.stats.totalPosts !== 1 ? 's' : ''}</span>
				<span>{data.stats.totalMembers} contributor{data.stats.totalMembers !== 1 ? 's' : ''}</span>
				{#if data.stats.postsThisMonth > 0}
					<span>{data.stats.postsThisMonth} post{data.stats.postsThisMonth !== 1 ? 's' : ''} this month</span>
				{/if}
			</div>
		</div>
		{#if data.user}
			<a
				href="/f/{data.forum.slug}/new"
				class="inline-block px-4 py-2 btn-primary rounded-lg font-semibold flex-shrink-0"
			>
				New Thread
			</a>
		{/if}
	</div>

	<!-- Thread List -->
	{#if data.threads.length === 0}
		<div class="card-secondary text-center text-[rgb(var(--color-text-muted))] mx-4 md:mx-8">
			<p>No threads yet.</p>
			{#if data.user}
				<p class="mt-2 text-sm">
					<a href="/f/{data.forum.slug}/new" class="text-[rgb(var(--color-primary))] hover:underline">Start a new discussion</a>
				</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-2 border-t border-[rgb(var(--color-border))] px-4 md:px-8">
			{#each data.threads as thread (thread.id)}
				<div class="thread-item border-b border-[rgb(var(--color-border))] py-3 px-4 -mx-4">
					<div class="flex items-start justify-between gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								{#if thread.hasUnread}
										<div class="unread-dot"><span class="sr-only">Unread</span></div>
									{/if}
									<h3 class={thread.hasUnread ? 'font-bold' : 'font-semibold'}>
									<a href="/f/{data.forum.slug}/t/{thread.slug}" class="thread-title break-words">
										{thread.title}
									</a>
								</h3>
								{#if thread.isPinned}
									<span class="text-xs bg-[rgb(var(--color-warning))] text-[rgb(var(--color-bg))] px-2 py-1 rounded">pinned</span>
								{/if}
								{#if thread.isLocked}
									<span class="text-xs bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] px-2 py-1 rounded">locked</span>
								{/if}
							</div>
							<p class="thread-meta mt-1">
								by <strong>{thread.authorDisplayName || thread.authorHandle}</strong>
							</p>
						</div>
						<div class="thread-stats flex-shrink-0">
							<p><strong>{thread.postCount}</strong> post{thread.postCount !== 1 ? 's' : ''}</p>
							<p class="text-xs">{formatTime(thread.lastPostAt)}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-6 px-4 md:px-8">
				{#if data.currentPage > 1}
					<a href="?page={data.currentPage - 1}" class="px-3 py-2 rounded border border-[rgb(var(--color-border))] text-sm hover:bg-[rgb(var(--color-bg-secondary))]" aria-label="Previous page">
						← Previous
					</a>
				{/if}

				<span class="text-sm text-[rgb(var(--color-text-secondary))]">
					Page {data.currentPage} of {data.totalPages}
				</span>

				{#if data.currentPage < data.totalPages}
					<a href="?page={data.currentPage + 1}" class="px-3 py-2 rounded border border-[rgb(var(--color-border))] text-sm hover:bg-[rgb(var(--color-bg-secondary))]" aria-label="Next page">
						Next →
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>