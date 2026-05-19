<script lang="ts">
	import type { PageData } from './$types';
	import { formatTimeDisplay } from '$lib/utils/time';
	import Pagination from '$components/Pagination.svelte';
	import EmptyState from '$components/EmptyState.svelte';

	let { data }: { data: PageData } = $props();

	const pageDescription = data.forum.description || `${data.stats.totalThreads} threads in the ${data.forum.name} forum.`;
	const pageUrl = data.baseUrl + `/f/${data.forum.slug}`;
	const pageTitle = `${data.forum.name} — ${data.siteName}`;
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={data.siteName} />
	<meta property="og:title" content={data.forum.name} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={pageUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={data.forum.name} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

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
		<div class="mx-4 md:mx-8">
			<EmptyState message="No threads yet.">
				{#if data.user}
					<a href="/f/{data.forum.slug}/new" class="text-[rgb(var(--color-primary))] hover:underline">Start a new discussion</a>
				{/if}
			</EmptyState>
		</div>
	{:else}
		<table class="w-full border-t border-[rgb(var(--color-border))]">
			<tbody>
				{#each data.threads as thread (thread.id)}
					<tr class="border-b border-[rgb(var(--color-border))]">
						<td class="py-3 px-4 align-top">
							<div class="flex items-center gap-2 flex-wrap mb-1">
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
							<p class="text-sm text-[rgb(var(--color-text-secondary))]">
								Started by <strong>{thread.authorDisplayName || thread.authorHandle}</strong>
							</p>
						</td>
						<td class="py-3 px-4 align-top text-right whitespace-nowrap">
							<p class="text-sm font-semibold">{thread.postCount} post{thread.postCount !== 1 ? 's' : ''}</p>
							<p class="text-xs text-[rgb(var(--color-text-muted))]">{formatTimeDisplay(thread.lastPostAt)}</p>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="px-4 md:px-8">
			<Pagination
				page={data.currentPage}
				totalPages={data.totalPages}
				total={data.totalThreads}
				buildUrl={(p) => `?page=${p}`}
			/>
		</div>
	{/if}
</div>
