<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let displayName = $state(data.user.displayName ?? '');
	let notifyViaBluesky = $state(data.user.notifyViaBluesky ?? false);
	let notificationType = $state(data.user.notificationType ?? 'both');
	let notificationFrequency = $state(data.user.notificationFrequency ?? 'immediate');
	let deleteAccountHandle = $state('');

	$effect(() => {
		displayName = data.user.displayName ?? '';
		notifyViaBluesky = data.user.notifyViaBluesky ?? false;
		notificationType = data.user.notificationType ?? 'both';
		notificationFrequency = data.user.notificationFrequency ?? 'immediate';
	});

	function confirmDeleteAllPosts(): boolean {
		return confirm(
			'Delete all of your posts?\n\n' +
			'This will permanently delete all post content. The post stubs will remain for quotes/links, but your content cannot be recovered.\n\n' +
			'This action cannot be undone.'
		);
	}

	function confirmDeleteAccount(): boolean {
		return confirm(
			'Delete your account?\n\n' +
			'Your account will be anonymized. Your handle and identity will be removed from the forum, but your post stubs will remain to preserve quote/link integrity.\n\n' +
			'You can register again with the same Bluesky identity later.\n\n' +
			'This action cannot be undone.'
		);
	}
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
				<label for="displayName" class="form-label">Display Name</label>
				<input
					id="displayName"
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
			<div class="space-y-4">
				<div class="p-4 bg-[rgb(var(--color-bg-secondary))] rounded-lg">
					<h3 class="font-semibold mb-2">Bluesky DM Notifications</h3>
					<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
						Receive DM notifications when someone replies to your thread, quotes your post, or a moderator takes action on your content.
					</p>

					<form method="POST" action="?/updateNotificationPreferences" class="space-y-4">
						<!-- Enable/Disable toggle -->
						<div>
							{#if notifyViaBluesky}
								<p class="text-sm text-green-600 font-medium mb-3">✓ Enabled</p>
								<input type="hidden" name="enabled" value="true" />
								<button type="submit" formaction="?/toggleNotifications" value="false" name="enabled" class="btn btn-sm btn-secondary">
									Disable Notifications
								</button>
							{:else}
								<p class="text-sm text-[rgb(var(--color-text-muted))] font-medium mb-3">Disabled</p>
								<input type="hidden" name="enabled" value="false" />
								<button type="submit" formaction="?/toggleNotifications" value="true" name="enabled" class="btn btn-sm btn-primary">
									Enable Notifications
								</button>
							{/if}
						</div>

						<!-- Notification type and frequency (only if enabled) -->
						{#if notifyViaBluesky}
							<div class="border-t border-[rgb(var(--color-border))] pt-4 space-y-4">
								<!-- Type -->
								<div>
									<label for="notificationType" class="block text-sm font-medium mb-2">Notify me about:</label>
									<select
										id="notificationType"
										name="notificationType"
										bind:value={notificationType}
										class="form-control"
									>
										<option value="both">Replies & Quotes</option>
										<option value="replies">Replies only</option>
										<option value="quotes">Quotes only</option>
									</select>
									<p class="text-xs text-[rgb(var(--color-text-muted))] mt-1">
										Choose which types of interactions trigger notifications.
									</p>
								</div>

								<!-- Frequency -->
								<div>
									<label for="notificationFrequency" class="block text-sm font-medium mb-2">Notification frequency:</label>
									<select
										id="notificationFrequency"
										name="notificationFrequency"
										bind:value={notificationFrequency}
										class="form-control"
									>
										<option value="immediate">Max once every 10 minutes</option>
										<option value="hourly">Max once per hour</option>
										<option value="daily">Max once per day</option>
									</select>
									<p class="text-xs text-[rgb(var(--color-text-muted))] mt-1">
										How often you'll receive batches of notifications.
									</p>
								</div>

								<button type="submit" class="btn btn-primary">Save Preferences</button>
							</div>
						{/if}
					</form>
				</div>

				<p class="text-xs text-[rgb(var(--color-text-muted))]">
					Note: You'll need to authorize your Bluesky account for the forum to send DMs. You'll be prompted when you first enable this.
				</p>
			</div>

			<!-- Danger Zone -->
			<div class="border-t border-[rgb(var(--color-border))] pt-6">
				<h2 class="text-lg font-semibold mb-3 text-[rgb(var(--color-error))]">Danger Zone</h2>
				<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
					These actions are permanent and cannot be undone.
				</p>

				<div class="space-y-4">
					<!-- Delete all posts -->
					<div class="p-4 border-2 border-[rgb(var(--color-error))] rounded-lg bg-red-50 dark:bg-red-950">
						<h3 class="font-semibold text-[rgb(var(--color-error))] mb-2">Delete All Posts</h3>
						<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
							Permanently delete the content of all your posts. Post stubs will remain to preserve quotes and links, but your text will be irretrievably removed.
						</p>
						<form method="POST" action="?/deleteAllPosts" onsubmit={confirmDeleteAllPosts}>
							<input type="hidden" name="confirm" value="true" />
							<button type="submit" class="btn btn-danger btn-sm">
								Delete All Post Content
							</button>
						</form>
					</div>

					<!-- Delete account -->
					<div class="p-4 border-2 border-[rgb(var(--color-error))] rounded-lg bg-red-50 dark:bg-red-950">
						<h3 class="font-semibold text-[rgb(var(--color-error))] mb-2">Delete Your Account</h3>
						<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
							Permanently delete your account. Your identity and handle will be removed from the forum, but post stubs will remain. You can re-register with the same Bluesky account later.
						</p>

						<form method="POST" action="?/deleteAccount" onsubmit={confirmDeleteAccount} class="space-y-3">
							<input type="hidden" name="confirm" value="true" />
							<div class="form-group">
								<label for="confirmHandle" class="form-label text-sm">
									Type your handle to confirm: <span class="font-mono font-semibold">@{data.user.handle}</span>
								</label>
								<input
									type="text"
									id="confirmHandle"
									name="confirmHandle"
									bind:value={deleteAccountHandle}
									placeholder={data.user.handle}
									class="form-control"
								/>
							</div>
							<button
								type="submit"
								disabled={deleteAccountHandle !== data.user.handle}
								class="btn btn-danger btn-sm"
							>
								Delete Account Permanently
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
