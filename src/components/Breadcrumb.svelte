<script lang="ts">
	let {
		crumbs
	}: {
		crumbs: Array<{ label: string; href?: string }>;
	} = $props();
</script>

<nav aria-label="Breadcrumb" class="text-sm mb-4 text-[rgb(var(--color-text-muted))]">
	<ol class="flex flex-wrap items-center gap-0">
		{#each crumbs as crumb, index (index)}
			<li class="flex items-center">
				{#if crumb.href && index < crumbs.length - 1}
					<a href={crumb.href} class="text-[rgb(var(--color-primary))] hover:underline">
						{crumb.label}
					</a>
				{:else}
					<span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>
				{/if}
				{#if index < crumbs.length - 1}
					<span class="mx-1.5 text-[rgb(var(--color-text-muted))]" aria-hidden="true">/</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
