<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { formatTimeWithAbsolute, formatTimeDisplay } from '$lib/utils/time';
	import Pagination from '$components/Pagination.svelte';
	import EmptyState from '$components/EmptyState.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let searchQuery = $state('');
	$effect(() => { searchQuery = data.search; });

	function handleSearch(e: Event) {
		const form = (e.target as HTMLFormElement).closest('form');
		if (form) form.submit();
	}

	function confirmDelete(): boolean {
		return confirm(
			'Permanently delete this post?\n\n' +
			'The content will be irreversibly deleted. The post stub will remain for quotes/links, but content cannot be recovered.\n\n' +
			'This action cannot be undone.'
		);
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString();
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header -->
	<div class="flex items-center gap-4 mb-8">
		<div>
			<a href="/user/{data.profileUser.handle}" class="text-sm text-[rgb(var(--color-primary))] hover:underline mb-2 block">
				← Back to profile
			</a>
			<h1 class="page-title">Manage Posts</h1>
			<p class="text-sm text-[rgb(var(--color-text-muted))]">
				{data.totalPosts} total {data.totalPosts === 1 ? 'post' : 'posts'}
			</p>
		</div>
	</div>

	<!-- Search bar -->
	<form method="GET" class="mb-6">
		<div class="flex gap-2">
			<input
				type="text"
				name="search"
				bind:value={searchQuery}
				placeholder="Search your posts..."
				class="flex-1 form-control"
				onchange={handleSearch}
			/>
			<button type="submit" class="btn btn-primary">Search</button>
			{#if data.search}
				<a href="?page=1" class="btn btn-secondary">Clear</a>
			{/if}
		</div>
	</form>

	<!-- Messages -->
	{#if form?.error}
		<div class="alert alert-error mb-4 text-sm">
			<p>{form.error}</p>
		</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success mb-4 text-sm">
			<p>✓ Action completed successfully</p>
		</div>
	{/if}

	<!-- Top pagination -->
	{#if data.totalPages > 1}
		<Pagination
			page={data.currentPage}
			totalPages={data.totalPages}
			total={data.totalPosts}
			buildUrl={(p) => `?page=${p}${data.search ? `&search=${encodeURIComponent(data.search)}` : ''}`}
		/>
	{/if}

	<!-- No posts -->
	{#if data.userPosts.length === 0}
		<EmptyState
			message={data.search
				? `No posts found matching "${data.search}"`
				: 'No posts yet'}
		/>
	{:else}
		<!-- Posts list -->
		<div class="space-y-4 mb-8">
			{#each data.userPosts as post (post.id)}
				<div class="box border-l-4" class:border-l-amber-500={post.status !== 'active'}>
					<!-- Header -->
					<div class="flex items-start justify-between mb-3">
						<div class="flex-1">
							<h3 class="font-semibold mb-1">
								<a href="/f/{post.forumSlug}/t/{post.threadSlug}" class="link hover:underline">
									{post.threadTitle}
								</a>
							</h3>
							<p class="text-xs text-[rgb(var(--color-text-muted))]" title={formatTimeWithAbsolute(post.createdAt).absolute}>
								in <span class="font-mono">{post.forumName}</span> • {formatTimeWithAbsolute(post.createdAt).relative}
								{#if post.editedAt}
									• edited
								{/if}
								{#if post.status !== 'active'}
									• <span class="font-semibold text-amber-600">{post.status.toUpperCase()}</span>
								{/if}
							</p>
						</div>
					</div>

					<!-- Preview -->
					<p class="text-sm text-[rgb(var(--color-text-secondary))] line-clamp-3 mb-4">
						{post.bodyPreview}
					</p>

					<!-- Actions -->
					<div class="flex gap-2">
						<a
							href="/f/{post.forumSlug}/t/{post.threadSlug}#post-{post.id}"
							class="text-xs btn btn-secondary"
						>
							View post
						</a>

						{#if post.status === 'active'}
							<form method="POST" action="?/hidePost" class="inline">
								<input type="hidden" name="postId" value={post.id} />
								<button type="submit" class="text-xs btn btn-secondary">
									Hide
								</button>
							</form>

							<form method="POST" action="?/deletePost" class="inline" onsubmit={confirmDelete}>
								<input type="hidden" name="postId" value={post.id} />
								<button type="submit" class="text-xs btn btn-danger">
									Delete permanently
								</button>
							</form>
						{:else}
							<form method="POST" action="?/restorePost" class="inline">
								<input type="hidden" name="postId" value={post.id} />
								<button type="submit" class="text-xs btn btn-secondary">
									Restore
								</button>
							</form>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<Pagination
				page={data.currentPage}
				totalPages={data.totalPages}
				total={data.totalPosts}
				buildUrl={(p) => `?page=${p}${data.search ? `&search=${encodeURIComponent(data.search)}` : ''}`}
			/>
		{/if}
	{/if}
</div>
