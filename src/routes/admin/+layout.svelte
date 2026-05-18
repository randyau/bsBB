<script lang="ts">
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex min-h-screen bg-[rgb(var(--color-bg))]">
	<!-- Sidebar -->
	<div class="w-64 bg-[rgb(var(--color-bg-secondary))] border-r border-[rgb(var(--color-border))] p-6">
		<h2 class="text-lg font-bold mb-6 text-[rgb(var(--color-text))]">Admin Panel</h2>
		<nav class="space-y-2" aria-label="Admin navigation">
			<a href="/admin/approval-queue" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">⏳</span> Approval Queue
			</a>
			<a href="/admin/forums" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">🗂️</span> Forums
			</a>
			<a href="/admin/users" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">👥</span> Users
			</a>
			<a href="/admin/roles" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">🏷️</span> Roles
			</a>
			<a href="/admin/threads" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">💬</span> Threads
			</a>
			<a href="/admin/posts" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">📝</span> Posts
			</a>
			<a href="/admin/mod-log" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">📋</span> Mod Log
			</a>
			<a href="/admin/query" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				<span aria-hidden="true">🔍</span> SQL Queries
			</a>
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
