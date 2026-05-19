<script lang="ts">
	import { onMount } from 'svelte';

	let theme = $state<'light' | 'dark'>('dark');

	onMount(() => {
		// Read actual theme from DOM on mount
		theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
	});

	function toggle() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', theme);
		document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
	}
</script>

<button
	type="button"
	onclick={toggle}
	class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] cursor-pointer transition-colors hover:bg-[rgb(var(--color-bg-secondary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
	aria-label="Toggle theme"
	title="Toggle light/dark mode"
>
	{#if theme === 'dark'}
		<svg class="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
		</svg>
	{:else}
		<svg class="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
		</svg>
	{/if}
</button>
