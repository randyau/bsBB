<script>
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
	<!-- Breadcrumb & Header -->
	<div>
		<div class="text-sm mb-4">
			<a href="/" class="text-blue-600 hover:underline">Forums</a>
			<span class="text-gray-400"> / </span>
			<a href="/f/{data.forum.slug}" class="text-blue-600 hover:underline">{data.forum.name}</a>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<h1 class="text-3xl font-bold">{data.thread.title}</h1>
			{#if data.thread.isPinned}
				<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">pinned</span>
			{/if}
			{#if data.thread.isLocked}
				<span class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">locked</span>
			{/if}
		</div>

		<p class="mt-2 text-sm text-gray-600">
			Started by <strong>{data.threadAuthor?.displayName || data.threadAuthor?.handle || 'Unknown'}</strong>
			{#if data.threadAuthor?.handle}
				(<code class="text-xs bg-gray-100 px-1 rounded">{data.threadAuthor.handle}</code>)
			{/if}
		</p>
	</div>

	<!-- Posts -->
	{#if data.posts.length === 0}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-600">
			<p>No posts yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.posts as post (post.id)}
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<!-- Post Header -->
					<div class="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
						<div class="flex items-center gap-3">
							{#if post.authorAvatarUrl}
								<img
									src={post.authorAvatarUrl}
									alt={post.authorHandle}
									class="w-10 h-10 rounded-full"
								/>
							{:else}
								<div class="w-10 h-10 rounded-full bg-gray-300" />
							{/if}

							<div>
								<p class="font-semibold">
									{post.authorDisplayName || post.authorHandle}
								</p>
								<p class="text-xs text-gray-500">{post.authorHandle}</p>
							</div>
						</div>

						<div class="text-sm text-gray-500 text-right">
							<p>{formatTime(post.createdAt)}</p>
							{#if post.editedAt}
								<p class="text-xs italic">edited {formatTime(post.editedAt)}</p>
							{/if}
						</div>
					</div>

					<!-- Quoted Post (if reply) -->
					{#if post.quotedPost}
						<div class="mb-4 pl-4 border-l-4 border-gray-300 bg-gray-50 p-3 text-sm">
							<p class="font-semibold text-gray-700">{post.quotedPost.authorHandle}</p>
							<div class="mt-1 text-gray-600 line-clamp-3">
								{@html post.quotedPost.bodyPreview}
							</div>
						</div>
					{/if}

					<!-- Post Body -->
					{#if post.isDeleted}
						<p class="italic text-gray-500">[post deleted]</p>
					{:else}
						<div class="prose prose-sm max-w-none">
							{@html post.bodyHtml}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Reply Prompt -->
	{#if !data.thread.isLocked}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
			{#if data.user}
				<p class="text-gray-600">
					<a href="/f/{data.forum.slug}/new" class="text-blue-600 hover:underline">Reply to this thread</a>
				</p>
			{:else}
				<p class="text-gray-600">
					<a href="/login" class="text-blue-600 hover:underline">Sign in</a> to reply
				</p>
			{/if}
		</div>
	{/if}
</div>