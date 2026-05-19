<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	function isActive(href: string): boolean {
		return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
	}
</script>

<div class="flex min-h-screen bg-[rgb(var(--color-bg))]">
	<!-- Sidebar -->
	<div class="w-64 bg-[rgb(var(--color-bg-secondary))] border-r border-[rgb(var(--color-border))] p-6">
		<h2 class="text-lg font-bold mb-6 text-[rgb(var(--color-text))]">Admin Panel</h2>
		<nav class="space-y-2" aria-label="Admin navigation">
			{#each [
				{ href: '/admin/approval-queue', icon: '⏳', label: 'Approval Queue' },
				{ href: '/admin/forums', icon: '🗂️', label: 'Forums' },
				{ href: '/admin/users', icon: '👥', label: 'Users' },
				{ href: '/admin/roles', icon: '🏷️', label: 'Roles' },
				{ href: '/admin/settings', icon: '⚙️', label: 'Settings' },
				{ href: '/admin/threads', icon: '💬', label: 'Threads' },
				{ href: '/admin/posts', icon: '📝', label: 'Posts' },
				{ href: '/admin/mod-log', icon: '📋', label: 'Mod Log' },
				{ href: '/mod/pii-requests', icon: '🔒', label: 'PII Requests' },
				{ href: '/admin/notifications', icon: '🔔', label: 'Notifications' },
				{ href: '/admin/query', icon: '🔍', label: 'SQL Queries' },
			] as item}
				<a
					href={item.href}
					class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]"
					class:bg-[rgb(var(--color-bg-tertiary))]={isActive(item.href)}
					class:font-semibold={isActive(item.href)}
					aria-current={isActive(item.href) ? 'page' : undefined}
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

	<!-- Main Content -->
	<main class="flex-1 bg-[rgb(var(--color-bg))] overflow-y-auto">
		<div class="sticky top-0 bg-[rgb(var(--color-bg))] border-b border-[rgb(var(--color-border))] px-8 py-4 z-10">
			<a href="/" class="text-[rgb(var(--color-primary))] hover:underline text-sm">← Back to Forum</a>
		</div>
		{@render children?.()}
	</main>
</div>
