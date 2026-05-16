<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<div class="flex min-h-screen bg-[rgb(var(--color-bg))]">
	<!-- Sidebar -->
	<div class="w-64 bg-[rgb(var(--color-bg-secondary))] border-r border-[rgb(var(--color-border))] p-6">
		<h2 class="text-lg font-bold mb-6 text-[rgb(var(--color-text))]">Admin Panel</h2>
		<nav class="space-y-2">
			<a href="/admin/forums" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				🗂️ Forums
			</a>
			<a href="/admin/users" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				👥 Users
			</a>
			<a href="/admin/roles" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				🏷️ Roles
			</a>
			<a href="/admin/threads" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				💬 Threads
			</a>
			<a href="/admin/posts" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				📝 Posts
			</a>
			<a href="/admin/mod-log" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				📋 Mod Log
			</a>
			<a href="/admin/query" class="block px-4 py-2 rounded-lg hover:bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
				🔍 SQL Queries
			</a>
		</nav>
		<div class="mt-8 pt-6 border-t border-[rgb(var(--color-border))]">
			<p class="text-xs text-[rgb(var(--color-text-muted))]">Logged in as:</p>
			<p class="font-semibold text-sm text-[rgb(var(--color-text))]">{data.user.displayName || data.user.handle}</p>
			<p class="text-xs text-[rgb(var(--color-text-secondary))]">{data.user.handle}</p>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 p-8 bg-[rgb(var(--color-bg))]">
		<a href="/" class="text-[rgb(var(--color-primary))] hover:underline text-sm mb-4 block">← Back to Forum</a>
		<slot />
	</div>
</div>
