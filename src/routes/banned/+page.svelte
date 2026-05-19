<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Account Banned — {data.siteName}</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center">
	<div class="max-w-md space-y-4 p-8 text-center">
		<h1 class="text-2xl font-bold">Account Suspended</h1>
		<p class="text-[rgb(var(--color-text-secondary))]">
			Your account has been suspended from this forum. If you believe this is an error,
			please contact the forum administrators.
		</p>
		<form method="POST" use:enhance action="/logout">
			<button type="submit" class="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300">
				Sign out
			</button>
		</form>
	</div>
</main>
