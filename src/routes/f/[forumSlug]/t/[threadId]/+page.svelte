<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { renderMarkdownClient } from '$lib/markdown/client';
	import { formatTimeDisplay } from '$lib/utils/time';
	import Breadcrumb from '$components/Breadcrumb.svelte';
	import EmptyState from '$components/EmptyState.svelte';
	import Pagination from '$components/Pagination.svelte';
	import MarkdownToolbar from '$components/MarkdownToolbar.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	import { page } from '$app/stores';
	const showPendingNotice = $derived($page.url.searchParams.get('pending') === '1');

	let previewHtml: string = $state('');
	let replyBody: string = $state('');
	let editingPostId: string | null = $state(null);
	let editBody: string = $state('');
	let editPreviewHtml: string = $state('');
	let isEditSaving: boolean = $state(false);
	let modEditingPostId: string | null = $state(null);
	let modEditBody: string = $state('');
	let modEditPreviewHtml: string = $state('');
	let modEditReason: string = $state('');
	let isModEditSaving: boolean = $state(false);
	let piiRequestPostId: string | null = $state(null);
	let piiRequestReason: string = $state('');
	let piiRequestSubmitting: boolean = $state(false);

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

	$effect(() => {
		updateModEditPreview();
	});

	function confirmDeletePost(): boolean {
		return confirm('Hide this post? It will be removed from view but content is preserved and can be restored.');
	}

	function addQuoteReference(postId: string) {
		const post = data.posts.find(p => p.id === postId);
		if (!post) return;

		// Build the quote: marker + blockquoted content
		const quoteMarker = `>!quote ${postId}`;
		const quotedContent = post.bodyMarkdown
			.split('\n')
			.map((line: string) => `> ${line}`)
			.join('\n');

		// Append to the end of existing text
		const toAppend = `${quoteMarker}\n${quotedContent}`;
		const newBody = replyBody ? replyBody + '\n\n' + toAppend : toAppend;

		// Check if adding the quote would exceed the limit
		if (newBody.length > 50000) {
			alert('Adding this quote would exceed the 50,000 character limit. Remove some text and try again.');
			return;
		}

		replyBody = newBody;
		(document.querySelector('textarea[name="body"]') as HTMLTextAreaElement)?.focus();
	}

	function removeQuoteReference(postId: string) {
		const quoteMarker = `>!quote ${postId}\n\n`;
		replyBody = replyBody.replace(quoteMarker, '');
	}

	async function copyPostLink(postId: string) {
		const url = `${window.location.origin}/f/${data.forum.slug}/t/${data.thread.slug}#post-${postId}`;
		try {
			await navigator.clipboard.writeText(url);
			// Brief visual feedback
			alert('Post link copied to clipboard');
		} catch (err) {
			console.error('Failed to copy:', err);
			// Fallback: select text for manual copy
			const input = document.createElement('textarea');
			input.value = url;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
			alert('Post link copied to clipboard');
		}
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

	function startModEdit(postId: string) {
		const post = data.posts.find(p => p.id === postId);
		if (!post) return;
		modEditingPostId = postId;
		modEditBody = post.bodyMarkdown;
		modEditReason = '';
		updateModEditPreview();
	}

	function updateModEditPreview() {
		modEditPreviewHtml = renderMarkdownClient(modEditBody);
	}

	async function saveModEdit(postId: string) {
		if (!modEditBody.trim()) {
			alert('Body cannot be empty');
			return;
		}

		if (!modEditReason.trim()) {
			alert('Reason for edit is required');
			return;
		}

		isModEditSaving = true;
		try {
			const response = await fetch(`/f/${data.forum.slug}/t/${data.thread.slug}/post/${postId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					body: modEditBody,
					modReason: modEditReason,
					isModEdit: true
				})
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
					post.bodyMarkdown = modEditBody;
					post.bodyHtml = result.post.bodyHtml;
					post.editedAt = new Date(result.post.editedAt);
				}
				modEditingPostId = null;
			}
		} catch (err) {
			console.error('Mod edit error:', err);
			alert('Failed to save edit');
		} finally {
			isModEditSaving = false;
		}
	}

	function cancelModEdit() {
		modEditingPostId = null;
		modEditBody = '';
		modEditReason = '';
	}

	function stripHtml(html: string, maxLength = 200): string {
		const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
		return stripped.length > maxLength ? stripped.slice(0, maxLength - 1) + '…' : stripped;
	}

	const firstPost = data.posts[0];
	const pageDescription = firstPost ? stripHtml(firstPost.bodyHtml) : data.thread.title;
	const pageUrl = data.baseUrl + `/f/${data.forum.slug}/t/${data.thread.slug}`;
	const pageTitle = `${data.thread.title} — ${data.siteName}`;
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content={data.siteName} />
	<meta property="og:title" content={data.thread.title} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={pageUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={data.thread.title} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="space-y-6 py-8">
	<!-- Breadcrumb & Header -->
	<div>
		<div class="mb-4">
			<Breadcrumb crumbs={[{ label: 'Forums', href: '/' }, { label: data.forum.name, href: `/f/${data.forum.slug}` }]} />
		</div>

		<div class="flex items-center gap-2 flex-wrap">
			<h1 class="page-title">{data.thread.title}</h1>
			{#if data.thread.isPinned}
				<span class="text-xs bg-[rgb(var(--color-warning))] text-[rgb(var(--color-bg))] px-2 py-1 rounded">pinned</span>
			{/if}
			{#if data.thread.isLocked}
				<span class="text-xs bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] px-2 py-1 rounded">locked</span>
			{/if}

			{#if data.user}
				{#if data.user.notifyViaBluesky}
					<div class="flex items-center gap-1 border border-[rgb(var(--color-border))] rounded overflow-hidden" role="group" aria-label="Thread notification preferences">
						<!-- Mute button -->
						<form method="POST" use:enhance action="?/muteThread" style="display: contents;">
							<button
								type="submit"
								aria-pressed={data.userSubscription === 'mute'}
								class="px-3 py-2 text-sm font-medium transition {data.userSubscription === 'mute'
									? 'bg-[rgb(var(--color-primary))] text-white'
									: 'bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-bg-secondary))]'}"
							>
								Mute
							</button>
						</form>

						<!-- Default button -->
						<form method="POST" use:enhance action="?/unwatchThread" style="display: contents;">
							<button
								type="submit"
								aria-pressed={data.userSubscription === null}
								aria-label="Default notifications"
								class="px-3 py-2 text-xs leading-tight font-medium transition border-l border-r border-[rgb(var(--color-border))] {data.userSubscription === null
									? 'bg-[rgb(var(--color-primary))] text-white'
									: 'bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-bg-secondary))]'}"
							>
								<div>Default</div>
								<div>notifs</div>
							</button>
						</form>

						<!-- Watch button -->
						<form method="POST" use:enhance action="?/watchThread" style="display: contents;">
							<button
								type="submit"
								aria-pressed={data.userSubscription === 'follow'}
								class="px-3 py-2 text-sm font-medium transition {data.userSubscription === 'follow'
									? 'bg-[rgb(var(--color-primary))] text-white'
									: 'bg-[rgb(var(--color-bg))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-bg-secondary))]'}"
							>
								Watch
							</button>
						</form>
					</div>
				{:else}
					<p class="text-xs text-[rgb(var(--color-text-muted))]">
						<a href="/settings#notifications" class="text-[rgb(var(--color-primary))] hover:underline">Enable notifications</a> to watch/mute
					</p>
				{/if}
			{/if}

			{#if data.canModerate}
				<details class="relative ml-auto">
					<summary class="cursor-pointer text-xs bg-[rgb(var(--color-bg-tertiary))] hover:bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] px-3 py-1 rounded list-none select-none" aria-haspopup="menu">
						Thread actions ▾
					</summary>
					<div class="absolute right-0 mt-1 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded shadow-lg z-10 min-w-[160px]">
						{#if data.thread.isLocked}
							<form method="POST" use:enhance action="?/unlockThread">
								<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Unlock thread</button>
							</form>
						{:else}
							<form method="POST" use:enhance action="?/lockThread">
								<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Lock thread</button>
							</form>
						{/if}
						{#if data.canModerate}
							{#if data.thread.isPinned}
								<form method="POST" use:enhance action="?/unpinThread">
									<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Unpin thread</button>
								</form>
							{:else}
								<form method="POST" use:enhance action="?/pinThread">
									<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Pin thread</button>
								</form>
							{/if}
						{/if}
					</div>
				</details>
			{/if}
		</div>

		<p class="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">
			Started by <a href="/user/{data.threadAuthor?.handle}" class="link font-semibold">{data.threadAuthor?.displayName || data.threadAuthor?.handle || 'Unknown'}</a>
			{#if data.threadAuthor?.handle}
				(<a href="/user/{data.threadAuthor.handle}" class="link text-xs font-mono">{data.threadAuthor.handle}</a>)
			{/if}
		</p>
	</div>

	<!-- Pending approval notice (shown after posting when approval is required) -->
	{#if showPendingNotice}
		<div class="bg-[rgb(var(--color-warning))] text-[rgb(var(--color-bg))] rounded px-4 py-3 text-sm font-medium" role="status">
			Your post has been submitted and is awaiting moderator approval. It will be visible to others once approved, or automatically after 24 hours.
		</div>
	{/if}

	<!-- Posts -->
	{#if data.posts.length === 0}
		<EmptyState message="No posts yet." />
	{:else}
		<div class="space-y-4">
			{#each data.posts as post, idx (post.id)}
				<div class="post{!post.isApproved ? ' opacity-70 border-dashed' : ''}" id="post-{post.id}">
					{#if !post.isApproved}
						<div class="px-4 py-2 text-xs font-medium bg-[rgb(var(--color-warning))]/20 text-[rgb(var(--color-warning))] rounded-t border-b border-[rgb(var(--color-warning))]/30">
							{#if data.canModerate}
								⏳ Pending approval — <a href="/admin/approval-queue" class="underline">Review in approval queue</a>
							{:else}
								⏳ Your post is pending moderator approval
							{/if}
						</div>
					{/if}
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
								<a href="/user/{post.authorHandle}" class="link font-semibold hover:underline">
									{post.authorDisplayName || post.authorHandle}
								</a>
								<p class="text-xs text-[rgb(var(--color-text-muted))]">
									<a href="/user/{post.authorHandle}" class="link font-mono hover:underline">@{post.authorHandle}</a>
								</p>
							</div>
						</div>

						<div class="flex flex-col items-end gap-2">
							<div class="text-sm text-[rgb(var(--color-text-muted))] text-right">
								<p><span class="text-sm">{formatTimeDisplay(post.createdAt)}</span></p>
								{#if post.editedAt}
									
									<a
										href="/f/{data.forum.slug}/t/{data.thread.slug}/post/{post.id}/revisions"
										class="text-xs italic link"
									>
										edited {formatTimeDisplay(post.editedAt)} (history)
									</a>
								{/if}
							</div>

							{#if post.status === 'active'}
								<button
									type="button"
									onclick={() => copyPostLink(post.id)}
									class="text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] hover:underline"
									aria-label="Copy link to post by {post.authorHandle}"
								>
									Copy link
								</button>
							{/if}

							{#if data.user && data.canPost && !data.thread.isLocked && post.status === 'active'}
								<button
									type="button"
									onclick={() => addQuoteReference(post.id)}
									class="text-xs text-[rgb(var(--color-primary))] hover:underline"
									aria-label="Quote post by {post.authorHandle}"
								>
									Quote
								</button>
							{/if}

							{#if data.user && (post.authorDid === data.user.did || data.canModerate) && post.status === 'active'}
								<button
									type="button"
									onclick={() => startEdit(post.id)}
									class="text-xs text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] hover:underline"
									aria-label="Edit post by {post.authorHandle}"
								>
									Edit
								</button>
							{/if}

							{#if data.user && post.status === 'active'}
								<button
									type="button"
									onclick={() => { piiRequestPostId = post.id; piiRequestReason = ''; }}
									class="text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-error))] hover:underline"
									aria-label="Request PII removal for post by {post.authorHandle}"
								>
									Report PII
								</button>
							{/if}

							{#if data.canModerate}
								<details class="relative">
									<summary class="cursor-pointer text-xs bg-[rgb(var(--color-bg-tertiary))] hover:bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] px-2 py-1 rounded list-none select-none" aria-label="Post moderation actions">
										⋯
									</summary>
									<div class="absolute right-0 mt-1 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded shadow-lg z-10 min-w-[160px]">
										{#if post.status === 'active' && data.canModerate && post.authorDid !== data.user.did}
											<button
												type="button"
												onclick={() => startModEdit(post.id)}
												class="w-full text-left px-4 py-2 text-sm text-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-bg-secondary))]"
											>
												Edit as mod
											</button>
										{/if}
										{#if idx === 0}
											{#if data.thread.isLocked}
												<form method="POST" use:enhance action="?/unlockThread">
													<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Unlock thread</button>
												</form>
											{:else}
												<form method="POST" use:enhance action="?/lockThread">
													<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Lock thread</button>
												</form>
											{/if}
										{/if}
										{#if post.status !== 'active'}
											<form method="POST" use:enhance action="?/restorePost">
												<input type="hidden" name="postId" value={post.id} />
												<button type="submit" class="w-full text-left px-4 py-2 text-sm hover:bg-[rgb(var(--color-bg-secondary))]">Restore post</button>
											</form>
										{:else}
											<form method="POST" use:enhance action="?/deletePost" onsubmit={(e) => { if (!confirmDeletePost()) { e.preventDefault(); return; } const reason = prompt('Reason (optional):'); if (reason !== null) { const el = e.currentTarget.querySelector('input[name=reason]'); if (el) (el as HTMLInputElement).value = reason; } else e.preventDefault(); }}>
												<input type="hidden" name="postId" value={post.id} />
												<input type="hidden" name="reason" value="" />
												<button type="submit" class="w-full text-left px-4 py-2 text-sm text-[rgb(var(--color-error))] hover:bg-[rgb(var(--color-bg-secondary))]">Hide post</button>
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
							<label for="edit-body-{post.id}" class="sr-only">Edit post</label>
							<textarea
								id="edit-body-{post.id}"
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
					{:else if modEditingPostId === post.id}
						<div class="space-y-3 p-3 border border-[rgb(var(--color-primary))] rounded-lg bg-[rgb(var(--color-bg-secondary))]">
							<p class="text-sm font-semibold text-[rgb(var(--color-primary))]">Edit as Moderator</p>
							<label for="mod-edit-body-{post.id}" class="sr-only">Edit post content</label>
							<textarea
								id="mod-edit-body-{post.id}"
								bind:value={modEditBody}
								class="w-full h-32 p-3 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
								placeholder="Edit post content..."
							></textarea>
							<label for="mod-edit-reason-{post.id}" class="sr-only">Reason for edit (required)</label>
							<textarea
								id="mod-edit-reason-{post.id}"
								bind:value={modEditReason}
								class="w-full h-16 p-3 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
								placeholder="Reason for edit (required)..."
							></textarea>
							<div class="text-xs text-[rgb(var(--color-text-muted))] space-y-1">
								<p><strong>Preview:</strong></p>
								<div class="prose-content bg-[rgb(var(--color-bg))] p-3 rounded">
									{@html modEditPreviewHtml || '<em>No preview</em>'}
								</div>
							</div>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={() => saveModEdit(post.id)}
									disabled={isModEditSaving}
									class="px-4 py-2 bg-[rgb(var(--color-primary))] text-white rounded hover:bg-[rgb(var(--color-primary-dark))] disabled:opacity-50"
								>
									{isModEditSaving ? 'Saving...' : 'Save as Mod'}
								</button>
								<button
									type="button"
									onclick={cancelModEdit}
									disabled={isModEditSaving}
									class="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] rounded hover:bg-[rgb(var(--color-border))] disabled:opacity-50"
								>
									Cancel
								</button>
							</div>
						</div>
						<p class="italic text-[rgb(var(--color-text-muted))]">
							{#if post.hiddenByUser}
								[post hidden by author]
							{:else}
								[post hidden by moderator]
							{/if}
						</p>
					{:else if post.status === 'deleted'}
						<p class="italic text-[rgb(var(--color-text-muted))]">[post permanently deleted]</p>
					{:else if post.status === 'archived'}
						<p class="italic text-[rgb(var(--color-text-muted))]">[post archived]</p>
					{:else}
						<div class="prose-content">
							{@html post.bodyHtml}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Pagination -->
	<Pagination
		page={data.page}
		totalPages={data.totalPages}
		total={data.totalPosts}
		buildUrl={(p) => `?page=${p}`}
	/>

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
				<h2 class="text-lg font-semibold mb-4">Reply to this thread</h2>

				{#if form?.error}
					<div class="alert alert-error mb-4 text-sm">
						<p>{form.error}</p>
					</div>
				{/if}


				<form method="POST" use:enhance action="?/reply" class="space-y-4">

					<!-- Body textarea/preview -->
					<div>
						<label for="reply-body" class="block text-sm font-semibold mb-2">Your reply (Markdown)</label>

						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<!-- Editor -->
							<div>
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
								<MarkdownToolbar value={replyBody} onEmojiSelect={(emoji) => replyBody += emoji} />
							</div>

							<!-- Live Preview -->
							<div>
								<p class="text-xs text-[rgb(var(--color-text-muted))] font-medium mb-2" id="reply-preview-label">Preview</p>
								<div
									aria-live="polite"
									aria-label="Markdown preview"
									aria-labelledby="reply-preview-label"
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
					<button type="submit" class="btn btn-primary">
						Post Reply
					</button>
				</form>
			{/if}
		</div>
	{/if}
</div>

<!-- PII Removal Request Modal -->
{#if piiRequestPostId}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		role="dialog"
		aria-modal="true"
		aria-labelledby="pii-modal-title"
	>
		<div class="box max-w-md w-full mx-4">
			<h2 id="pii-modal-title" class="text-lg font-semibold mb-2">Request PII Removal</h2>
			<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
				Use this only for posts containing personally identifiable information (real name, address, phone number, etc.) that should be permanently erased. Moderators will review and, if approved, will wipe the post content and its full edit history.
			</p>
			{#if form?.error && !piiRequestSubmitting}
				<div class="alert alert-error mb-3 text-sm">{form.error}</div>
			{/if}
			<form
				method="POST"
				action="?/requestPiiRemoval"
				use:enhance={() => {
					piiRequestSubmitting = true;
					return async ({ update }) => {
						await update();
						piiRequestSubmitting = false;
						if (!form?.error) piiRequestPostId = null;
					};
				}}
			>
				<input type="hidden" name="postId" value={piiRequestPostId} />
				<label for="pii-reason" class="block text-sm font-medium mb-1">
					Describe the PII in this post <span aria-hidden="true">*</span>
				</label>
				<textarea
					id="pii-reason"
					name="reason"
					bind:value={piiRequestReason}
					rows="4"
					required
					maxlength="1000"
					placeholder="e.g. Contains my full name and home address in the third paragraph"
					class="form-control w-full mb-4"
				></textarea>
				<div class="flex gap-3 justify-end">
					<button
						type="button"
						onclick={() => { piiRequestPostId = null; piiRequestReason = ''; }}
						class="btn btn-secondary"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={piiRequestSubmitting || !piiRequestReason.trim()}
						class="btn btn-danger"
					>
						{piiRequestSubmitting ? 'Submitting…' : 'Submit request'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
</div>