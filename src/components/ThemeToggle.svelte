<script lang="ts">
	import { theme } from '$lib/theme';

	let currentTheme = $derived($theme);

	function toggleTheme() {
		theme.toggle();
	}
</script>

<button
	on:click={toggleTheme}
	title={`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`}
	class="p-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] transition-colors"
	aria-label="Toggle theme"
>
	{#if currentTheme === 'dark'}
		<svg
			class="w-5 h-5"
			fill="currentColor"
			viewBox="0 0 20 20"
			aria-hidden="true"
		>
			<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
		</svg>
	{:else}
		<svg
			class="w-5 h-5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	{/if}
</button>
