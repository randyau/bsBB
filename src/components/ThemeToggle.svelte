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
	{#if currentTheme === 'light'}
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
			viewBox="0 0 20 20"
			aria-hidden="true"
		>
			<path
				fill-rule="evenodd"
				d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.464 7.464a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm1.414-4.828a1 1 0 000-1.414L4.757.757a1 1 0 00-1.414 1.414l.707.707a1 1 0 001.414 0zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z"
				clip-rule="evenodd"
			/>
		</svg>
	{/if}
</button>
