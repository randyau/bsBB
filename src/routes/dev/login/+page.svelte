<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dev Login</title>
</svelte:head>

<div style="max-width: 480px; margin: 80px auto; font-family: monospace; padding: 0 1rem;">
	<div style="border: 2px dashed #f59e0b; padding: 1rem; margin-bottom: 1.5rem; background: #fef3c7; color: #92400e; font-size: 0.85rem;">
		⚠ DEV LOGIN — not available in production
	</div>

	<h1 style="font-size: 1.25rem; margin-bottom: 1rem;">Sign in as dev user</h1>

	{#if data.devUsers.length === 0}
		<p>No dev users found. Run <code>npx tsx scripts/seed-dev-users.ts</code> first.</p>
	{:else}
		{#each data.devUsers as user}
			<form method="POST" use:enhance style="margin-bottom: 0.75rem;">
				<input type="hidden" name="did" value={user.did} />
				<button
					type="submit"
					style="width: 100%; text-align: left; padding: 0.75rem 1rem; border: 1px solid #d1d5db; background: white; cursor: pointer; border-radius: 4px;"
				>
					<div style="font-weight: bold;">{user.displayName ?? user.handle}</div>
					<div style="font-size: 0.8rem; color: #6b7280;">
						{user.handle} &bull; {user.globalRole} &bull; {user.did}
					</div>
				</button>
			</form>
		{/each}
	{/if}
</div>
