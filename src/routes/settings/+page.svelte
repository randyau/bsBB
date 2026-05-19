<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let displayName = $state('');
	let timezone = $state('');
	let notifyViaBluesky = $state(false);
	let notificationType = $state('');
	let notificationFrequency = $state('');
	let deleteAccountHandle = $state('');

	// Populate form fields from server data (runs on mount and on data changes after form actions)
	$effect(() => {
		displayName = data.user.displayName ?? '';
		timezone = data.user.timezone ?? 'America/New_York';
		notifyViaBluesky = data.user.notifyViaBluesky ?? false;
		notificationType = data.user.notificationType ?? 'both';
		notificationFrequency = data.user.notificationFrequency ?? 'immediate';
	});

	let justEnabledNotifications = $state(false);

	// Sync state when form action completes
	$effect(() => {
		if (form?.success && form?.notifyViaBluesky !== undefined) {
			console.log('[settings] form response, updating notifyViaBluesky to:', form.notifyViaBluesky);
			justEnabledNotifications = form.notifyViaBluesky === true;
			notifyViaBluesky = form.notifyViaBluesky;
		}
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
		<h1 class="page-title">Settings</h1>
		<a href="/user/{data.user.handle}" class="text-sm text-[rgb(var(--color-primary))] hover:underline">
			← Back to profile
		</a>
	</div>

	{#if form?.error}
		<div class="alert alert-error mb-4">{form.error}</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success mb-4">✓ Display name updated</div>
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
			<form method="POST" use:enhance action="?/updateDisplayName" class="space-y-3">
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

		<!-- Time Zone -->
		<div class="border-t border-[rgb(var(--color-border))] pt-6">
			<h2 class="text-lg font-semibold mb-3">Time Zone</h2>
			<form method="POST" use:enhance action="?/updateTimezone" class="space-y-3">
				<label for="timezone" class="form-label">Time Zone (IANA identifier)</label>
				<select
					id="timezone"
					name="timezone"
					bind:value={timezone}
					class="form-control"
				>
					<option value="America/New_York">Eastern Time (America/New_York)</option>
					<option value="America/Chicago">Central Time (America/Chicago)</option>
					<option value="America/Denver">Mountain Time (America/Denver)</option>
					<option value="America/Los_Angeles">Pacific Time (America/Los_Angeles)</option>
					<option value="America/Anchorage">Alaska Time (America/Anchorage)</option>
					<option value="Pacific/Honolulu">Hawaii Time (Pacific/Honolulu)</option>
					<option value="UTC">UTC</option>
					<option value="Europe/London">London (Europe/London)</option>
					<option value="Europe/Paris">Central European (Europe/Paris)</option>
					<option value="Europe/Berlin">Berlin (Europe/Berlin)</option>
					<option value="Asia/Tokyo">Tokyo (Asia/Tokyo)</option>
					<option value="Asia/Shanghai">Shanghai (Asia/Shanghai)</option>
					<option value="Asia/Hong_Kong">Hong Kong (Asia/Hong_Kong)</option>
					<option value="Asia/Singapore">Singapore (Asia/Singapore)</option>
					<option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
				</select>
				<p class="text-xs text-[rgb(var(--color-text-muted))]">
					Used to display timestamps in your local time. Timestamps will show as "HH:MM:SS" in your selected timezone.
				</p>
				<button type="submit" class="btn btn-primary">Save Time Zone</button>
			</form>
		</div>

		<!-- Notification preferences -->
		<div class="border-t border-[rgb(var(--color-border))] pt-6">
			<div class="space-y-4">
				<div class="p-4 bg-[rgb(var(--color-bg-secondary))] rounded-lg">
					<h3 class="font-semibold mb-2">Bluesky DM Notifications</h3>
					<p class="text-sm text-[rgb(var(--color-text-muted))] mb-3">
						Opt in to receive a Bluesky DM when someone replies to your thread or quotes your post. This is entirely optional — you can disable it at any time below.
					</p>
					{#if data.serviceHandle}
						<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">
							Messages are sent by
							<a href="https://bsky.app/profile/{data.serviceHandle}" target="_blank" rel="noopener noreferrer" class="link font-mono">@{data.serviceHandle}</a>.
							To receive them you must either <strong>follow that account</strong> or have your Bluesky DMs set to <strong>accept messages from everyone</strong>.
						</p>
					{/if}

					<form method="POST" use:enhance action="?/updateNotificationPreferences" class="space-y-4">
						<!-- Enable/Disable toggle -->
						<div>
							{#if notifyViaBluesky}
								<p class="text-sm text-[rgb(var(--color-text-muted))] font-medium mb-3">Enabled — you will receive DMs from the service account above.</p>
								<button type="submit" formaction="?/toggleNotifications" value="false" name="enabled" class="btn btn-sm btn-secondary">
									Disable Notifications
								</button>
							{:else}
								<p class="text-sm text-[rgb(var(--color-text-muted))] font-medium mb-3">Disabled</p>
								<button type="submit" formaction="?/toggleNotifications" value="true" name="enabled" class="btn btn-sm btn-primary">
									Enable Notifications
								</button>
							{/if}
							{#if justEnabledNotifications}
								<div class="mt-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
									<p class="text-sm text-green-800 dark:text-green-200 font-medium">Notifications enabled</p>
									<p class="text-sm text-green-700 dark:text-green-300 mt-1">A confirmation message has been sent to you. Check your Bluesky DMs and chat requests.</p>
								</div>
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
					Note: Notifications are sent via Bluesky DM from the account listed above. You must follow that account or allow DMs from everyone to receive them.
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
						<form method="POST" use:enhance action="?/deleteAllPosts" onsubmit={confirmDeleteAllPosts}>
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

						<form method="POST" use:enhance action="?/deleteAccount" onsubmit={confirmDeleteAccount} class="space-y-3">
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
