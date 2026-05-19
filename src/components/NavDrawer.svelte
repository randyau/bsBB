<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id = 'nav-drawer',
		open = $bindable(false),
		children
	}: {
		id?: string;
		open?: boolean;
		children: Snippet;
	} = $props();

	function close() {
		open = false;
	}
</script>

<!-- Mobile overlay -->
{#if open}
	<div
		class="fixed inset-0 bg-black/50 z-20 md:hidden"
		role="presentation"
		onclick={close}
	></div>
{/if}

<!-- Drawer panel — fixed/slide on mobile, static on md+ -->
<div
	{id}
	class="fixed inset-y-0 left-0 z-30 w-64 bg-[rgb(var(--color-bg-secondary))] border-r border-[rgb(var(--color-border))] flex flex-col transition-transform duration-200
	       md:static md:translate-x-0 md:flex md:shrink-0"
	class:-translate-x-full={!open}
	class:translate-x-0={open}
>
	<!-- Close button (mobile only) -->
	<button
		class="md:hidden absolute top-4 right-4 p-1 rounded text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-tertiary))]"
		onclick={close}
		aria-label="Close navigation"
	>✕</button>

	{@render children()}
</div>
