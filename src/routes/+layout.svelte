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

<nav class="border-b px-4 py-3 flex items-center justify-between">
	<a href="/" class="font-bold text-lg">bsBB</a>
	<div class="flex items-center gap-4 text-sm">
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
