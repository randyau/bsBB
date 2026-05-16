<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import type { LayoutData } from './$types.js';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
	const { user } = $derived(data);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<script>
	let searchQuery = $state('');

	function handleSearch(e) {
		e.preventDefault();
		if (searchQuery.trim()) {
			window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
		}
	}
</script>

<nav class="border-b px-4 py-3 flex items-center justify-between gap-4">
	<a href="/" class="font-bold text-lg whitespace-nowrap">bsBB</a>

	<!-- Search Bar -->
	<form onsubmit={handleSearch} class="flex-1 max-w-md">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search posts..."
			class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
		/>
	</form>

	<div class="flex items-center gap-4 text-sm whitespace-nowrap">
		{#if user}
			{#if user.globalRole === 'admin'}
				<a href="/admin" class="text-blue-600 hover:underline font-semibold">Admin</a>
			{/if}
			<span class="text-gray-600">@{user.handle}</span>
			<form method="POST" action="/logout">
				<button type="submit" class="hover:underline">Sign out</button>
			</form>
		{:else}
			<a href="/login" class="hover:underline">Sign in</a>
		{/if}
	</div>
</nav>

{@render children()}
