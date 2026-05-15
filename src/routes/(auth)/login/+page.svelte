<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types.js';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in — bsBB</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center">
	<div class="w-full max-w-sm space-y-6 p-8">
		<h1 class="text-2xl font-bold">Sign in with Bluesky</h1>

		<form method="POST" use:enhance class="space-y-4">
			<div>
				<label for="handle" class="block text-sm font-medium">
					Bluesky handle or DID
				</label>
				<input
					id="handle"
					name="handle"
					type="text"
					placeholder="you.bsky.social"
					required
					class="mt-1 block w-full rounded border px-3 py-2"
				/>
			</div>

			{#if form?.error}
				<p class="text-sm text-red-600">{form.error}</p>
			{/if}

			<button type="submit" class="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
				Continue
			</button>
		</form>
	</div>
</main>
