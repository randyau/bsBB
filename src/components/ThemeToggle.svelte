<script lang="ts">
	import { theme } from '$lib/theme';

	let currentTheme = $derived($theme);

	function toggleTheme() {
		theme.toggle();
	}
</script>

<button
	onclick={toggleTheme}
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
			fill="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="5" />
			<path d="M12 1v6m0 6v6M23 12h-6m-6 0H1M20.485 3.515l-4.243 4.243m0 5.486l4.243 4.243M3.515 3.515l4.243 4.243m0 5.486l-4.243 4.243" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
	{/if}
</button>
