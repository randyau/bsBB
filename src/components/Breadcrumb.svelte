<script lang="ts">
	let {
		crumbs
	}: {
		crumbs: Array<{ label: string; href?: string }>;
	} = $props();
</script>

<div class="text-sm mb-4 text-[rgb(var(--color-text-muted))]">
	{#each crumbs as crumb, index (index)}
		{#if crumb.href}
			<a href={crumb.href} class="text-[rgb(var(--color-primary))] hover:underline">
				{crumb.label}
			</a>
		{:else}
			<span>{crumb.label}</span>
		{/if}
		{#if index < crumbs.length - 1}
			<span class="text-[rgb(var(--color-text-muted))]"> / </span>
		{/if}
	{/each}
</div>
