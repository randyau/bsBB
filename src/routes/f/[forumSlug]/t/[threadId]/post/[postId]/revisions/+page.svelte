<script lang="ts">
	import type { PageData } from './$types';
	import { formatTimeDisplay } from '$lib/utils/time';

	let { data }: { data: PageData } = $props();

	let selectedRevisionId: string | null = $state(null);
</script>

<div class="max-w-4xl mx-auto py-8 px-4 space-y-6">
	<!-- Header -->
	<div>
		<a href="/f/{data.forum.slug}/t/{data.thread.slug}" class="link text-sm">
			← Back to thread
		</a>
		<h1 class="page-title">{data.thread.title}</h1>
		<p class="text-[rgb(var(--color-text-secondary))] mt-2">
			Edit history for post by <span class="font-semibold">@{data.post.authorHandle}</span>
		</p>
	</div>

	{#if data.revisions.length === 0}
		<div class="box-secondary text-center">
			<p class="text-[rgb(var(--color-text-secondary))]">No edits — post has not been modified.</p>
		</div>
	{:else}
		<!-- Revision Timeline -->
		<div class="space-y-4">
			<p class="text-sm text-[rgb(var(--color-text-secondary))] font-semibold">
				{data.revisions.length} edit{data.revisions.length === 1 ? '' : 's'}
			</p>

			{#each data.revisions as revision (revision.id)}
				<div class="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] overflow-hidden">
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
							<p class="text-sm text-[rgb(var(--color-text-secondary))]">{formatTimeDisplay(revision.createdAt)}</p>
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
								<div class="prose-content bg-[rgb(var(--color-bg))] p-3 rounded border border-[rgb(var(--color-border))]">
									{@html revision.bodyHtml}
								</div>
								<details class="mt-2">
									<summary class="text-xs text-[rgb(var(--color-text-secondary))] cursor-pointer hover:text-[rgb(var(--color-text))]">
										View markdown source
									</summary>
									<pre class="mt-2 p-3 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] rounded text-xs overflow-x-auto"><code>{revision.bodyMarkdown}</code></pre>
								</details>
							</div>

							<!-- Current Content (shown for last revision) -->
							{#if revision === data.revisions[data.revisions.length - 1]}
								<div class="pt-4 border-t border-[rgb(var(--color-border))]">
									<h4 class="font-semibold text-sm mb-2">Current content (after this edit):</h4>
									<div class="prose-content bg-[rgb(var(--color-bg))] p-3 rounded border border-[rgb(var(--color-border))]">
										{@html data.post.bodyHtml}
									</div>
									<details class="mt-2">
										<summary class="text-xs text-[rgb(var(--color-text-secondary))] cursor-pointer hover:text-[rgb(var(--color-text))]">
											View markdown source
										</summary>
										<pre class="mt-2 p-3 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))] rounded text-xs overflow-x-auto"><code>{data.post.bodyMarkdown}</code></pre>
									</details>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Original Post Info -->
		<div class="box-secondary">
			<p class="text-sm"><strong>Original post:</strong> Created {formatTimeDisplay(data.post.createdAt)}</p>
			{#if data.post.editedAt}
				<p class="text-sm mt-1"><strong>Last edited:</strong> {formatTimeDisplay(data.post.editedAt)}</p>
			{/if}
		</div>
	{/if}
</div>
