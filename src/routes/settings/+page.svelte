<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let displayName = $state(data.user.displayName ?? '');
</script>

<div class="container mx-auto px-4 py-8 max-w-lg">
	<h1 class="text-3xl font-bold mb-8">Settings</h1>

	{#if form?.error}
		<div class="card-secondary text-error mb-4">{form.error}</div>
	{/if}

	{#if form?.success}
		<div class="card-secondary text-success mb-4">✓ Display name updated</div>
	{/if}

	<div class="card space-y-6">
		<!-- Identity (read-only) -->
		<div>
			<h2 class="text-lg font-semibold mb-3">Identity</h2>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between items-center py-2 border-b border-[rgb(var(--color-border))]">
					<span class="text-[rgb(var(--color-text-muted))]">Handle</span>
					<span class="font-mono">@{data.user.handle}</span>
				</div>
				<div class="flex justify-between items-center py-2 border-b border-[rgb(var(--color-border))]">
					<span class="text-[rgb(var(--color-text-muted))]">DID</span>
					<span class="font-mono text-xs text-[rgb(var(--color-text-muted))]">{data.user.did}</span>
				</div>
			</div>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				Your handle is tied to your Bluesky identity. To change it, update it on
				<a href="https://bsky.app/settings" target="_blank" rel="noopener noreferrer" class="link hover:underline">Bluesky</a>
				or your PDS — it will sync here on your next login.
			</p>
		</div>

		<!-- Display name (editable) -->
		<div>
			<h2 class="text-lg font-semibold mb-3">Display Name</h2>
			<form method="POST" action="?/updateDisplayName" class="space-y-3">
				<input
					type="text"
					name="displayName"
					bind:value={displayName}
					placeholder="Your display name"
					maxlength="100"
					class="form-control"
				/>
				<p class="text-xs text-[rgb(var(--color-text-muted))]">
					Shown on your profile and posts. Leave blank to use your handle.
				</p>
				<button type="submit" class="btn btn-primary">Save</button>
			</form>
		</div>
	</div>
</div>
