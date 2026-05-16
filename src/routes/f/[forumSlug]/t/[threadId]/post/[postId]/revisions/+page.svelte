<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatTime(date: Date) {
		const now = new Date();
		const diffMs = now.getTime() - new Date(date).getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return `${diffDays}d ago`;
	}

	let selectedRevisionId: string | null = $state(null);
</script>

<div class="max-w-4xl mx-auto py-8 px-4 space-y-6">
	<!-- Header -->
	<div>
		<a href="/f/{data.forum.slug}/t/{data.thread.slug}" class="text-blue-600 hover:underline text-sm">
			← Back to thread
		</a>
		<h1 class="text-3xl font-bold mt-4">{data.thread.title}</h1>
		<p class="text-[rgb(var(--color-text-secondary))] mt-2">
			Edit history for post by <span class="font-semibold">@{data.post.authorHandle}</span>
		</p>
	</div>

	{#if data.revisions.length === 0}
		<div class="rounded-lg bg-[rgb(var(--color-bg-secondary))] border border-[rgb(var(--color-border))] p-8 text-center">
			<p class="text-[rgb(var(--color-text-secondary))]">No edits — post has not been modified.</p>
		</div>
	{:else}
		<!-- Revision Timeline -->
		<div class="space-y-4">
			<p class="text-sm text-[rgb(var(--color-text-secondary))] font-semibold">
				{data.revisions.length} edit{data.revisions.length === 1 ? '' : 's'}
			</p>

			{#each data.revisions as revision (revision.id)}
				<div class="rounded-lg border border-[rgb(var(--color-border))] bg-white overflow-hidden">
					<!-- Revision Header -->
					<button
						type="button"
						onclick={() => (selectedRevisionId = selectedRevisionId === revision.id ? null : revision.id)}
						class="w-full p-4 hover:bg-[rgb(var(--color-bg-secondary))] flex items-start justify-between cursor-pointer"
					>
						<div class="text-left">
							<p class="font-semibold">
								Edited by <span class="font-mono">@{revision.editorHandle}</span>
							</p>
							<p class="text-sm text-[rgb(var(--color-text-secondary))]">
								{new Date(revision.createdAt).toLocaleString()} ({formatTime(revision.createdAt)})
							</p>
						</div>
						<div class="text-[rgb(var(--color-text-muted))]">
							{selectedRevisionId === revision.id ? '▼' : '▶'}
						</div>
					</button>

					<!-- Revision Content (Collapsed by default) -->
					{#if selectedRevisionId === revision.id}
						<div class="border-t border-[rgb(var(--color-border))] p-4 bg-[rgb(var(--color-bg-secondary))] space-y-4">
							<!-- Original Content -->
							<div>
								<h4 class="font-semibold text-sm mb-2">Original content:</h4>
								<div class="prose prose-sm max-w-none bg-white p-3 rounded border border-[rgb(var(--color-border))]">
									{@html revision.bodyHtml}
								</div>
								<details class="mt-2">
									<summary class="text-xs text-[rgb(var(--color-text-secondary))] cursor-pointer hover:text-gray-900">
										View markdown source
									</summary>
									<pre class="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto"><code>{revision.bodyMarkdown}</code></pre>
								</details>
							</div>

							<!-- Current Content (shown for last revision) -->
							{#if revision === data.revisions[data.revisions.length - 1]}
								<div class="pt-4 border-t border-[rgb(var(--color-border))]">
									<h4 class="font-semibold text-sm mb-2">Current content (after this edit):</h4>
									<div class="prose prose-sm max-w-none bg-white p-3 rounded border border-[rgb(var(--color-border))]">
										{@html data.post.bodyHtml}
									</div>
									<details class="mt-2">
										<summary class="text-xs text-[rgb(var(--color-text-secondary))] cursor-pointer hover:text-gray-900">
											View markdown source
										</summary>
										<pre class="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto"><code>{data.post.bodyMarkdown}</code></pre>
									</details>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Original Post Info -->
		<div class="rounded-lg bg-blue-50 border border-blue-200 p-4">
			<p class="text-sm text-blue-900">
				<strong>Original post:</strong> Created {new Date(data.post.createdAt).toLocaleString()}
			</p>
			{#if data.post.editedAt}
				<p class="text-sm text-blue-900 mt-1">
					<strong>Last edited:</strong> {new Date(data.post.editedAt).toLocaleString()}
				</p>
			{/if}
		</div>
	{/if}
</div>
