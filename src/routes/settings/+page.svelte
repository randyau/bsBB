<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let displayName = $state(data.user.displayName ?? '');
	let notifyViaBluesky = $state(data.user.notifyViaBluesky ?? false);
</script>

<div class="container mx-auto px-4 py-8 max-w-lg">
	<div class="flex items-center justify-between mb-8">
		<h1 class="text-3xl font-bold">Settings</h1>
		<a href="/user/{data.user.handle}" class="text-sm text-[rgb(var(--color-primary))] hover:underline">
			← Back to profile
		</a>
	</div>

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

		<!-- Notification preferences -->
		<div class="border-t border-[rgb(var(--color-border))] pt-6">
			<h2 class="text-lg font-semibold mb-3">Notifications</h2>

			<div class="space-y-4">
				<div class="p-4 bg-[rgb(var(--color-bg-secondary))] rounded-lg">
					<h3 class="font-semibold mb-2">Bluesky DM Notifications</h3>
					<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
						Receive DM notifications when someone replies to your thread, quotes your post, or a moderator takes action on your content.
					</p>

					{#if notifyViaBluesky}
						<p class="text-sm text-green-600 font-medium mb-3">✓ Enabled</p>
						<form method="POST" action="?/toggleNotifications" class="inline">
							<input type="hidden" name="enabled" value="false" />
							<button type="submit" class="btn btn-sm btn-secondary">
								Disable Notifications
							</button>
						</form>
					{:else}
						<p class="text-sm text-[rgb(var(--color-text-muted))] font-medium mb-3">Disabled</p>
						<form method="POST" action="?/toggleNotifications" class="inline">
							<input type="hidden" name="enabled" value="true" />
							<button type="submit" class="btn btn-sm btn-primary">
								Enable Notifications
							</button>
						</form>
					{/if}
				</div>

				<p class="text-xs text-[rgb(var(--color-text-muted))]">
					Note: You'll need to authorize your Bluesky account for the forum to send DMs. You'll be prompted when you first enable this.
				</p>
			</div>
		</div>
	</div>
</div>
