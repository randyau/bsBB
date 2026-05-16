<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { renderMarkdownClient } from '$lib/markdown/client';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);

	let previewHtml: string = $state('');
	let replyBody: string = $state('');
	let quotedPostId: string | null = $state(null);
	let editingPostId: string | null = $state(null);
	let editBody: string = $state('');
	let editPreviewHtml: string = $state('');
	let isEditSaving: boolean = $state(false);

	function updateReplyPreview() {
		previewHtml = renderMarkdownClient(replyBody);
	}

	function updateEditPreview() {
		editPreviewHtml = renderMarkdownClient(editBody);
	}

	$effect(() => {
		updateReplyPreview();
	});

	$effect(() => {
		updateEditPreview();
	});

	function setQuoteTarget(postId: string) {
		const post = data.posts.find(p => p.id === postId);
		if (!post) return;

		if (quotedPostId === postId) {
			// Already quoted, clicking again clears it
			quotedPostId = null;
			// Remove the quoted text from the body
			const lines = replyBody.split('\n');
			const quoteLines = post.bodyMarkdown.split('\n').map((line: string) => `> ${line}`);
			let newBody = replyBody;
			for (const quoteLine of quoteLines) {
				newBody = newBody.replace(quoteLine + '\n', '').replace(quoteLine, '');
			}
			replyBody = newBody.trim();
		} else {
			quotedPostId = postId;
			// Insert the quoted text as a blockquote at the start
			const quotedText = post.bodyMarkdown
				.split('\n')
				.map((line: string) => `> ${line}`)
				.join('\n');
			replyBody = quotedText + (replyBody ? '\n\n' + replyBody : '');
		}

		document.querySelector('textarea[name="body"]')?.focus();
	}

	function startEdit(postId: string) {
		const post = data.posts.find(p => p.id === postId);
		if (!post) return;
		editingPostId = postId;
		editBody = post.bodyMarkdown;
	}

	async function saveEdit(postId: string) {
		if (!editBody.trim()) {
			alert('Body cannot be empty');
			return;
		}

		isEditSaving = true;
		try {
			const response = await fetch(`/f/${data.forum.slug}/t/${data.thread.slug}/post/${postId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body: editBody })
			});

			if (!response.ok) {
				const err = await response.json();
				alert(err.error || 'Failed to save edit');
				return;
			}

			const result = await response.json();
			if (result.success) {
				const post = data.posts.find(p => p.id === postId);
				if (post) {
					post.bodyMarkdown = editBody;
					post.bodyHtml = result.post.bodyHtml;
					post.editedAt = new Date(result.post.editedAt);
				}
				editingPostId = null;
			}
		} catch (err) {
			console.error('Edit error:', err);
			alert('Failed to save edit');
		} finally {
			isEditSaving = false;
		}
	}

	function cancelEdit() {
		editingPostId = null;
		editBody = '';
	}

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
			<a href="/" class="text-[rgb(var(--color-primary))] hover:underline">Forums</a>
			<span class="text-[rgb(var(--color-text-muted))]"> / </span>
			<a href="/f/{data.forum.slug}" class="text-[rgb(var(--color-primary))] hover:underline">{data.forum.name}</a>
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<h1 class="text-3xl font-bold">{data.thread.title}</h1>
			{#if data.thread.isPinned}
				<span class="text-xs bg-[rgb(var(--color-warning))] text-[rgb(var(--color-bg))] px-2 py-1 rounded">pinned</span>
			{/if}
			{#if data.thread.isLocked}
				<span class="text-xs bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] px-2 py-1 rounded">locked</span>
			{/if}

			{#if data.canModerate}
				<details class="relative ml-auto">
					<summary class="cursor-pointer text-xs bg-[rgb(var(--color-bg-tertiary))] hover:bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] px-3 py-1 rounded list-none select-none">
						Thread actions ▾
					</summary>
					<div class="absolute right-0 mt-1 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded shadow-lg z-10 min-w-[160px]">
						{#if data.thread.isLocked}
							<form method="POST" action="?/unlockThread">
								<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Unlock thread</button>
							</form>
						{:else}
							<form method="POST" action="?/lockThread">
								<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Lock thread</button>
							</form>
						{/if}
						{#if data.user?.globalRole === 'admin'}
							{#if data.thread.isPinned}
								<form method="POST" action="?/unpinThread">
									<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Unpin thread</button>
								</form>
							{:else}
								<form method="POST" action="?/pinThread">
									<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Pin thread</button>
								</form>
							{/if}
						{/if}
					</div>
				</details>
			{/if}
		</div>

		<p class="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">
			Started by <strong>{data.threadAuthor?.displayName || data.threadAuthor?.handle || 'Unknown'}</strong>
			{#if data.threadAuthor?.handle}
				(<code class="text-xs bg-[rgb(var(--color-bg-tertiary))] px-1 rounded">{data.threadAuthor.handle}</code>)
			{/if}
		</p>
	</div>

	<!-- Posts -->
	{#if data.posts.length === 0}
		<div class="box-secondary text-center">
			<p>No posts yet.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.posts as post (post.id)}
				<div class="post">
					<!-- Post Header -->
					<div class="post-header">
						<div class="post-author">
							{#if post.authorAvatarUrl}
								<img
									src={post.authorAvatarUrl}
									alt={post.authorHandle}
									class="post-avatar"
								/>
							{:else}
								<div class="post-avatar"></div>
							{/if}

							<div>
								<p class="font-semibold">
									{post.authorDisplayName || post.authorHandle}
								</p>
								<p class="text-xs text-[rgb(var(--color-text-muted))]">{post.authorHandle}</p>
							</div>
						</div>

						<div class="flex flex-col items-end gap-2">
							<div class="text-sm text-[rgb(var(--color-text-muted))] text-right">
								<p>{formatTime(post.createdAt)}</p>
								{#if post.editedAt}
									<a
										href="/f/{data.forum.slug}/t/{data.thread.slug}/post/{post.id}/revisions"
										class="text-xs italic text-blue-600 hover:underline"
									>
										edited {formatTime(post.editedAt)} (history)
									</a>
								{/if}
							</div>

							{#if data.user && data.canPost && !data.thread.isLocked && !post.isDeleted}
								<button
									type="button"
									onclick={() => setQuoteTarget(post.id)}
									class="text-xs {quotedPostId === post.id
										? 'text-blue-600 font-semibold underline'
										: 'text-blue-600 hover:underline'}"
								>
									{quotedPostId === post.id ? '✓ Quoted' : 'Quote'}
								</button>
							{/if}

							{#if data.user && (post.authorDid === data.user.did || data.user.globalRole === 'admin') && !post.isDeleted}
								<button
									type="button"
									onclick={() => startEdit(post.id)}
									class="text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] hover:underline"
								>
									Edit
								</button>
							{/if}

							{#if data.canModerate}
								<details class="relative">
									<summary class="cursor-pointer text-xs bg-[rgb(var(--color-bg-tertiary))] hover:bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] px-2 py-1 rounded list-none select-none">
										⋯
									</summary>
									<div class="absolute right-0 mt-1 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded shadow-lg z-10 min-w-[140px]">
										{#if post.isDeleted}
											<form method="POST" action="?/restorePost">
												<input type="hidden" name="postId" value={post.id} />
												<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Restore post</button>
											</form>
										{:else}
											<form method="POST" action="?/deletePost" onsubmit={(e) => { const reason = prompt('Reason (optional):'); if (reason !== null) { const el = e.currentTarget.querySelector('input[name=reason]'); if (el) (el as HTMLInputElement).value = reason; } else e.preventDefault(); }}>
												<input type="hidden" name="postId" value={post.id} />
												<input type="hidden" name="reason" value="" />
												<button type="submit" class="w-full text-left px-4 py-2 text-sm text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-bg-secondary))]">Delete post</button>
											</form>
										{/if}
									</div>
								</details>
							{/if}
						</div>
					</div>

					<!-- Quoted Post (if reply) -->
					{#if post.quotedPost}
						<div class="quoted-post">
							<p class="font-semibold">{post.quotedPost.authorHandle}</p>
							<div class="mt-1 line-clamp-3">
								{@html post.quotedPost.bodyPreview}
							</div>
						</div>
					{/if}

					<!-- Post Body -->
					{#if editingPostId === post.id}
						<div class="space-y-2">
							<textarea
								bind:value={editBody}
								class="w-full h-32 p-3 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
								placeholder="Edit your post..."
							></textarea>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={() => saveEdit(post.id)}
									disabled={isEditSaving}
									class="px-4 py-2 bg-[rgb(var(--color-primary))] text-white rounded hover:bg-[rgb(var(--color-primary-dark))] disabled:opacity-50"
								>
									{isEditSaving ? 'Saving...' : 'Save'}
								</button>
								<button
									type="button"
									onclick={cancelEdit}
									disabled={isEditSaving}
									class="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] rounded hover:bg-[rgb(var(--color-border))] disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</div>
					{:else if post.isDeleted}
						<p class="italic text-[rgb(var(--color-text-muted))]">[post deleted]</p>
					{:else}
						<div class="prose-content">
							{@html post.bodyHtml}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Reply Form -->
	{#if !data.thread.isLocked}
		<div class="box">
			{#if !data.user}
				<p class="text-center text-secondary">
					<a href="/login" class="text-[rgb(var(--color-primary))] hover:underline">Sign in</a> to reply
				</p>
			{:else if !data.canPost}
				<p class="text-center text-secondary">You do not have permission to post in this forum.</p>
			{:else}
				<h3 class="text-lg font-semibold mb-4">Reply to this thread</h3>

				{#if form?.error}
					<div class="rounded-lg border border-[rgb(var(--color-error))] bg-[rgb(var(--color-bg-secondary))] p-3 text-[rgb(var(--color-error))] mb-4 text-sm">
						<p>{form.error}</p>
					</div>
				{/if}

				{#if quotedPostId}
					<button
						type="button"
						onclick={() => setQuoteTarget(quotedPostId!)}
						class="text-xs text-[rgb(var(--color-primary))] mb-3 italic hover:bg-[rgb(var(--color-bg-secondary))] px-2 py-1 rounded cursor-pointer block w-full text-left transition"
					>
						💬 Quoted @{data.posts.find(p => p.id === quotedPostId)?.authorHandle} — click to remove, or edit the blockquote below
					</button>
				{/if}

				<form method="POST" action="?/reply" class="space-y-4">
					<!-- Hidden reply target -->
					<input type="hidden" name="replyToPostId" value={quotedPostId || ''} />

					<!-- Body textarea/preview -->
					<div>
						<label for="reply-body" class="block text-sm font-semibold mb-2">Your reply (Markdown)</label>

						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<!-- Editor -->
							<div>
								<label for="reply-body" class="text-xs text-[rgb(var(--color-text-muted))] font-medium block mb-2">Write</label>
								<textarea
									id="reply-body"
									name="body"
									maxlength="50000"
									required
									placeholder="Write your reply..."
									bind:value={replyBody}
									rows="6"
									class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] font-mono text-sm"
								></textarea>
								<p class="text-xs text-[rgb(var(--color-text-muted))] mt-1">
									{replyBody.length} / 50,000 characters
									{#if replyBody.length > 45000}
										<span class="text-[rgb(var(--color-warning))] font-semibold">(approaching limit)</span>
									{/if}
								</p>
							</div>

							<!-- Live Preview -->
							<div>
								<label class="text-xs text-[rgb(var(--color-text-muted))] font-medium block mb-2">Preview</label>
								<div
									class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg bg-[rgb(var(--color-bg-secondary))] max-w-none min-h-[150px] overflow-auto prose-content"
								>
									{#if replyBody.trim()}
										{@html previewHtml}
									{:else}
										<p class="text-[rgb(var(--color-text-muted))]">Preview appears here...</p>
									{/if}
								</div>
							</div>
						</div>
					</div>

					<!-- Submit -->
					<button type="submit" class="bg-[rgb(var(--color-primary))] text-white px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-primary-dark))]">
						Post Reply
					</button>
				</form>
			{/if}
		</div>
	{/if}
</div>