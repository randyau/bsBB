<script lang="ts">
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: any } = $props();
</script>

<div class="flex min-h-screen bg-gray-50">
	<!-- Sidebar -->
	<div class="w-64 bg-white border-r border-gray-200 p-6">
		<h2 class="text-lg font-bold mb-6">Admin Panel</h2>
		<nav class="space-y-2">
			<a href="/admin/query" class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
				🔍 SQL Queries
			</a>
			<a href="/admin/users" class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
				👥 Users
			</a>
			<a href="/admin/threads" class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
				💬 Threads
			</a>
			<a href="/admin/posts" class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
				📝 Posts
			</a>
			<a href="/admin/mod-log" class="block px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700">
				📋 Mod Log
			</a>
		</nav>
		<div class="mt-8 pt-6 border-t border-gray-200">
			<p class="text-xs text-gray-500">Logged in as:</p>
			<p class="font-semibold text-sm">{data.user.displayName || data.user.handle}</p>
			<p class="text-xs text-gray-600">{data.user.handle}</p>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 p-8">
		<a href="/" class="text-blue-600 hover:underline text-sm mb-4 block">← Back to Forum</a>
		<slot />
	</div>
</div>
