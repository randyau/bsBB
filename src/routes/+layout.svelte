<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import type { LayoutData } from './$types.js';
	import ThemeToggle from '$components/ThemeToggle.svelte';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
	const { user } = $derived(data);

	let searchQuery = $state('');

	function handleSearch(e: Event) {
		e.preventDefault();
		if (searchQuery.trim()) {
			window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<script>
		const theme = document.cookie.split('; ').find(c => c.startsWith('theme='))?.split('=')[1] || 'dark';
		document.documentElement.setAttribute('data-theme', theme);
	</script>
</svelte:head>

<nav class="border-b px-4 py-3 flex items-center justify-between gap-4 bg-[rgb(var(--color-bg))]">
	<a href="/" class="font-bold text-lg whitespace-nowrap">bsBB</a>

	<!-- Search Bar -->
	<form onsubmit={handleSearch} class="flex-1 max-w-md">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search posts..."
			class="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
		/>
	</form>

	<div class="flex items-center gap-4 text-sm whitespace-nowrap">
		<ThemeToggle />

		{#if user}
			{#if user.globalRole === 'admin'}
				<a href="/admin" class="font-semibold hover:underline">Admin</a>
			{/if}
			<a href="/user/{user.handle}" class="text-secondary hover:underline">@{user.handle}</a>
			<form method="POST" action="/logout">
				<button type="submit" class="hover:underline">Sign out</button>
			</form>
		{:else}
			<a href="/login" class="hover:underline">Sign in</a>
		{/if}
	</div>
</nav>

<div class="container">
	{@render children()}
</div>
