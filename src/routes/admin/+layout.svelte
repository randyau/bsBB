<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import NavDrawer from '$components/NavDrawer.svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const isAdmin = data.user.globalRole === 'admin';
	let drawerOpen = $state(false);

	function isActive(href: string): boolean {
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}

	const navItems = [
		{ href: '/admin/approval-queue', icon: '⏳', label: 'Approval Queue', adminOnly: false },
		{ href: '/admin/users', icon: '👥', label: 'Users', adminOnly: false },
		{ href: '/admin/threads', icon: '💬', label: 'Threads', adminOnly: false },
		{ href: '/admin/posts', icon: '📝', label: 'Posts', adminOnly: false },
		{ href: '/admin/mod-log', icon: '📋', label: 'Mod Log', adminOnly: false },
		{ href: '/mod/pii-requests', icon: '🔒', label: 'PII Requests', adminOnly: false },
		{ href: '/admin/forums', icon: '🗂️', label: 'Forums', adminOnly: true },
		{ href: '/admin/roles', icon: '🏷️', label: 'Roles', adminOnly: true },
		{ href: '/admin/settings', icon: '⚙️', label: 'Settings', adminOnly: true },
		{ href: '/admin/notifications', icon: '🔔', label: 'Notifications', adminOnly: true },
		{ href: '/admin/query', icon: '🔍', label: 'SQL Queries', adminOnly: true },
	].filter(item => !item.adminOnly || isAdmin);
</script>

<div class="flex min-h-screen bg-[rgb(var(--color-bg))]">
	<NavDrawer id="admin-nav" bind:open={drawerOpen}>
		<div class="p-6 flex flex-col h-full">
			<h2 class="text-lg font-bold mb-6 text-[rgb(var(--color-text))]">{isAdmin ? 'Admin Panel' : 'Mod Panel'}</h2>
			<nav class="space-y-2 flex-1 overflow-y-auto" aria-label="Admin navigation">
				{#each navItems as item}
					<a
						href={item.href}
						class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]"
						class:bg-[rgb(var(--color-bg-tertiary))]={isActive(item.href)}
						class:font-semibold={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
						onclick={() => (drawerOpen = false)}
					>
						<span aria-hidden="true">{item.icon}</span> {item.label}
					</a>
				{/each}
			</nav>
			<div class="mt-8 pt-6 border-t border-[rgb(var(--color-border))]">
				<p class="text-xs text-[rgb(var(--color-text-muted))]">Logged in as:</p>
				<p class="font-semibold text-sm text-[rgb(var(--color-text))]">{data.user.displayName || data.user.handle}</p>
				<p class="text-xs text-[rgb(var(--color-text-secondary))]">{data.user.handle}</p>
			</div>
		</div>
	</NavDrawer>

	<!-- Main Content -->
	<main class="flex-1 bg-[rgb(var(--color-bg))] overflow-y-auto min-w-0">
		<div class="sticky top-0 bg-[rgb(var(--color-bg))] border-b border-[rgb(var(--color-border))] px-4 py-3 z-10 flex items-center gap-3">
			<button
				class="md:hidden p-2 rounded-lg text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-secondary))]"
				onclick={() => (drawerOpen = true)}
				aria-expanded={drawerOpen}
				aria-controls="admin-nav"
				aria-label="Open navigation"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>
			<a href="/" class="text-[rgb(var(--color-primary))] hover:underline text-sm">← Back to Forum</a>
		</div>
		{@render children?.()}
	</main>
</div>
