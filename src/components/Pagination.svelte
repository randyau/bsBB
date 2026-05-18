<script lang="ts">
	let {
		page,
		totalPages,
		total,
		buildUrl
	}: {
		page: number;
		totalPages: number;
		total: number;
		buildUrl: (p: number) => string;
	} = $props();
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-between p-4 bg-[rgb(var(--color-bg-secondary))] rounded border border-[rgb(var(--color-border))]">
		<div class="text-sm text-[rgb(var(--color-text-muted))]">
			Page {page} of {totalPages} ({total} total)
		</div>
		<div class="flex gap-2">
			<a
				href={buildUrl(1)}
				class="btn btn-sm btn-secondary"
				aria-disabled={page === 1}
				class:opacity-50={page === 1}
				class:pointer-events-none={page === 1}
			>
				First
			</a>
			<a
				href={buildUrl(Math.max(1, page - 1))}
				class="btn btn-sm btn-secondary"
				aria-disabled={page === 1}
				class:opacity-50={page === 1}
				class:pointer-events-none={page === 1}
			>
				Back
			</a>
			<a
				href={buildUrl(Math.min(totalPages, page + 1))}
				class="btn btn-sm btn-secondary"
				aria-disabled={page === totalPages}
				class:opacity-50={page === totalPages}
				class:pointer-events-none={page === totalPages}
			>
				Next
			</a>
			<a
				href={buildUrl(totalPages)}
				class="btn btn-sm btn-secondary"
				aria-disabled={page === totalPages}
				class:opacity-50={page === totalPages}
				class:pointer-events-none={page === totalPages}
			>
				Last
			</a>
		</div>
	</div>
{/if}
