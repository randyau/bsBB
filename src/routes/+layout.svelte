<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import type { LayoutData } from './$types.js';
	import ThemeToggle from '$components/ThemeToggle.svelte';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
	const { user, unreadNotificationCount, siteName, faviconUrl, themeOverrideCss, customCss, fontBody } = $derived(data);

	let searchQuery = $state('');
	let timezoneDetected = $state(false);

	$effect(() => {
		// Auto-detect and set browser timezone on first load if user is logged in and has default timezone
		if (!timezoneDetected && user && user.timezone === 'America/New_York') {
			timezoneDetected = true;
			const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (browserTimezone && browserTimezone !== 'America/New_York') {
				fetch('/api/user/timezone', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ timezone: browserTimezone })
				}).catch(() => {
					// Silently fail — timezone detection is a nice-to-have
				});
			}
		}
	});

	function handleSearch(e: Event) {
		e.preventDefault();
		if (searchQuery.trim()) {
			window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
		}
	}
</script>

<svelte:head>
	{#if faviconUrl}
		<link rel="icon" href={faviconUrl} />
	{:else}
		<link rel="icon" href={favicon} />
	{/if}

	<!-- Font loading (Google Fonts if not system) -->
	{#if fontBody && fontBody !== 'system'}
		{@const fontUrls = {
			'inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
			'lora': 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
			'source-serif-4': 'https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;500;600;700&display=swap',
			'jetbrains-mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
		}}
		{@const fontFamilies = {
			'inter': 'Inter, sans-serif',
			'lora': 'Lora, serif',
			'source-serif-4': '"Source Serif 4", serif',
			'jetbrains-mono': '"JetBrains Mono", monospace',
		}}
		{@const fontUrl = (fontUrls as Record<string, string>)[fontBody]}
		{@const fontFamily = (fontFamilies as Record<string, string>)[fontBody]}
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
		{#if fontUrl}
			<link rel="stylesheet" href={fontUrl} />
		{/if}
		{#if fontFamily}
			<style>
				body {{ font-family: {fontFamily}; }}
			</style>
		{/if}
	{/if}

	<!-- Theme overrides (primary color) -->
	{#if themeOverrideCss}
		<style>{@html themeOverrideCss}</style>
	{/if}

	<!-- Custom CSS -->
	{#if customCss}
		<style>{@html customCss}</style>
	{/if}

	<script>
		const theme = document.cookie.split('; ').find(c => c.startsWith('theme='))?.split('=')[1] || 'dark';
		document.documentElement.setAttribute('data-theme', theme);
	</script>
</svelte:head>

<a href="#main-content" class="sr-only focus:not-sr-only px-4 py-2 bg-[rgb(var(--color-primary))] text-white font-semibold rounded">
	Skip to main content
</a>

<nav class="border-b px-4 py-3 flex items-center justify-between gap-4 bg-[rgb(var(--color-bg))]" aria-label="Site navigation">
	<a href="/" class="font-bold text-lg whitespace-nowrap">{siteName}</a>

	<!-- Search Bar -->
	<form onsubmit={handleSearch} class="flex-1 max-w-md">
		<label for="search-input" class="sr-only">Search posts</label>
		<input
			id="search-input"
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
			<a href="/notifications" class="relative hover:underline" aria-label="Notifications{unreadNotificationCount > 0 ? ` (${unreadNotificationCount} unread)` : ''}">
				Notifications
				{#if unreadNotificationCount > 0}
					<span class="absolute -top-1 -right-3 min-w-[1.1rem] h-[1.1rem] rounded-full bg-[rgb(var(--color-primary))] text-white text-[10px] font-bold flex items-center justify-center px-0.5" aria-hidden="true">
						{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
					</span>
				{/if}
			</a>
			<a href="/user/{user.handle}" class="text-secondary hover:underline">@{user.handle}</a>
			<form method="POST" action="?/logout">
				<button type="submit" class="hover:underline">Sign out</button>
			</form>
		{:else}
			<a href="/login" class="hover:underline">Sign in</a>
		{/if}
	</div>
</nav>

<main id="main-content" class="container">
	{@render children()}
</main>
