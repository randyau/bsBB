<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { formatTimeDisplay } from '$lib/utils/time';
	import UserTypeahead from '$components/UserTypeahead.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedUser = $state<{ did: string; handle: string; displayName?: string } | null>(null);
	let notificationType = $state('reply');
	let expandedError = $state<string | null>(null);
	let expandedContext = $state<string | null>(null);

	const stats = data.stats ?? {};
	const total = Object.values(stats).reduce((a, b) => a + b, 0);

	function toggleError(id: string) {
		expandedError = expandedError === id ? null : id;
	}

	function toggleContext(id: string) {
		expandedContext = expandedContext === id ? null : id;
	}
</script>

<div class="space-y-8 p-8">
	<h1 class="page-title">Notifications</h1>

	<!-- Queue stats -->
	<section>
		<h2 class="section-title mb-3">Queue Status</h2>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each [
				{ key: 'pending',    label: 'Pending',    color: 'text-[rgb(var(--color-primary))]' },
				{ key: 'processing', label: 'Processing', color: 'text-[rgb(var(--color-text-secondary))]' },
				{ key: 'sent',       label: 'Sent',       color: 'text-green-600 dark:text-green-400' },
				{ key: 'failed',     label: 'Failed',     color: 'text-red-600 dark:text-red-400' },
			] as s}
				<div class="box text-center">
					<div class="text-2xl font-bold {s.color}">{stats[s.key] ?? 0}</div>
					<div class="text-xs text-[rgb(var(--color-text-muted))] mt-1">{s.label}</div>
				</div>
			{/each}
		</div>
		{#if total > 0}
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">{total} total queue entries</p>
		{/if}
	</section>

	<!-- Test send -->
	<section>
		<h2 class="section-title mb-3">Send Test Notification</h2>
		<div class="box space-y-4 max-w-lg">
			{#if form?.action === 'testSend' && (form as any).success}
				<p class="text-sm text-green-600 dark:text-green-400 font-medium">
					Test DM sent to @{(form as any).handle}.
				</p>
			{/if}
			{#if form?.action === 'testSend' && (form as any).error}
				<p class="text-sm text-red-600 dark:text-red-400 font-medium">{(form as any).error}</p>
			{/if}

			<form method="POST" action="?/testSend" use:enhance class="space-y-3">
				<div>
					<label class="label" for="notif-user">Recipient</label>
					<UserTypeahead
						users={data.allUsers}
						onSelect={(u) => { selectedUser = u; }}
						placeholder="Search by handle or display name…"
					/>
					<input type="hidden" name="recipientDid" value={selectedUser?.did ?? ''} />
					{#if selectedUser}
						<p class="text-xs text-[rgb(var(--color-text-secondary))] mt-1">
							Selected: <span class="font-mono">@{selectedUser.handle}</span>
						</p>
					{/if}
				</div>

				<div>
					<label class="label" for="notif-type">Notification type</label>
					<select id="notif-type" name="notificationType" bind:value={notificationType} class="form-control">
						<option value="reply">reply — "@user replied to your thread"</option>
						<option value="quote">quote — "@user quoted your post"</option>
						<option value="new_reply_in_thread">new_reply_in_thread — "New reply in …"</option>
					</select>
				</div>

				<button
					type="submit"
					class="btn btn-primary"
					disabled={!selectedUser}
				>
					Send test DM
				</button>
			</form>

			<p class="text-xs text-[rgb(var(--color-text-muted))]">
				Sends immediately (bypasses queue). Recipient must have Bluesky DMs enabled and a stored chat session.
			</p>
		</div>
	</section>

	<!-- Failed notifications -->
	<section>
		<h2 class="section-title mb-3">Failed Notifications</h2>

		{#if form?.action === 'retry' && form.success}
			<p class="text-sm text-green-600 dark:text-green-400 mb-3">Notification reset to pending.</p>
		{/if}
		{#if form?.action === 'delete' && form.success}
			<p class="text-sm text-green-600 dark:text-green-400 mb-3">Notification deleted.</p>
		{/if}

		{#if data.failed.length === 0}
			<div class="box-secondary text-center">
				<p class="text-sm text-[rgb(var(--color-text-secondary))]">No failed notifications.</p>
			</div>
		{:else}
			<div class="table-container">
				<table class="w-full text-sm">
					<thead class="bg-[rgb(var(--color-bg-tertiary))] border-b border-[rgb(var(--color-border))]">
						<tr>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Time</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Recipient</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Type</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Retries</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Error</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.failed as row (row.id)}
							<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
								<td class="px-4 py-3 text-xs text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
									{formatTimeDisplay(row.createdAt)}
								</td>
								<td class="px-4 py-3 font-mono text-xs">
									{#if row.recipientHandle}
										<a href="/user/{row.recipientHandle}" class="link hover:underline">@{row.recipientHandle}</a>
									{:else}
										<span class="text-[rgb(var(--color-text-muted))]">{row.recipientDid.slice(0, 24)}…</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<span class="inline-block px-2 py-0.5 rounded text-xs font-mono bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-primary))]">
										{row.type}
									</span>
								</td>
								<td class="px-4 py-3 text-center text-xs">{row.retryCount}</td>
								<td class="px-4 py-3 text-xs max-w-xs">
									{#if row.error}
										<button
											type="button"
											onclick={() => toggleError(row.id)}
											class="text-red-600 dark:text-red-400 hover:underline text-left"
										>
											{expandedError === row.id ? 'Hide' : row.error.split('\n')[0]}
										</button>
										{#if expandedError === row.id}
											<pre class="mt-2 p-2 bg-[rgb(var(--color-bg-tertiary))] rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">{row.error}</pre>
											<button
												type="button"
												onclick={() => toggleContext(row.id)}
												class="mt-1 text-[rgb(var(--color-text-secondary))] hover:underline text-xs"
											>
												{expandedContext === row.id ? 'Hide payload' : 'Show payload'}
											</button>
											{#if expandedContext === row.id}
												<pre class="mt-1 p-2 bg-[rgb(var(--color-bg-tertiary))] rounded text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(row.payload, null, 2)}</pre>
											{/if}
										{/if}
									{:else}
										<span class="text-[rgb(var(--color-text-muted))]">—</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<div class="flex gap-2">
										<form method="POST" action="?/retry" use:enhance>
											<input type="hidden" name="id" value={row.id} />
											<button type="submit" class="btn btn-sm btn-secondary">Retry</button>
										</form>
										<form method="POST" action="?/delete" use:enhance>
											<input type="hidden" name="id" value={row.id} />
											<button type="submit" class="btn btn-sm btn-danger">Delete</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">Showing up to 100 most recent failures.</p>
		{/if}
	</section>

	<!-- Worker error log -->
	<section>
		<div class="flex items-center justify-between mb-3">
			<h2 class="section-title">Worker Error Log</h2>
			{#if data.workerErrors.length > 0}
				<form method="POST" action="?/clearLog" use:enhance>
					<button
						type="submit"
						class="btn btn-sm btn-danger"
						onclick={(e) => { if (!confirm('Clear all worker log entries?')) e.preventDefault(); }}
					>
						Clear log
					</button>
				</form>
			{/if}
		</div>

		{#if form?.action === 'clearLog' && form.success}
			<p class="text-sm text-green-600 dark:text-green-400 mb-3">Worker log cleared.</p>
		{/if}

		{#if data.workerErrors.length === 0}
			<div class="box-secondary text-center">
				<p class="text-sm text-[rgb(var(--color-text-secondary))]">No worker log entries.</p>
			</div>
		{:else}
			<div class="table-container">
				<table class="w-full text-sm">
					<thead class="bg-[rgb(var(--color-bg-tertiary))] border-b border-[rgb(var(--color-border))]">
						<tr>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Time</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Level</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Message</th>
							<th scope="col" class="px-4 py-3 text-left font-semibold">Context</th>
						</tr>
					</thead>
					<tbody>
						{#each data.workerErrors as entry (entry.id)}
							<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
								<td class="px-4 py-3 text-xs text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
									{formatTimeDisplay(entry.createdAt)}
								</td>
								<td class="px-4 py-3">
									<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold {entry.level === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}">
										{entry.level}
									</span>
								</td>
								<td class="px-4 py-3 text-xs max-w-sm">
									<button
										type="button"
										onclick={() => toggleError('log-' + entry.id)}
										class="text-left hover:underline"
									>
										{expandedError === 'log-' + entry.id ? 'Hide' : entry.message.split('\n')[0]}
									</button>
									{#if expandedError === 'log-' + entry.id}
										<pre class="mt-2 p-2 bg-[rgb(var(--color-bg-tertiary))] rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">{entry.message}</pre>
									{/if}
								</td>
								<td class="px-4 py-3 text-xs">
									{#if entry.context}
										<button
											type="button"
											onclick={() => toggleContext('log-' + entry.id)}
											class="text-[rgb(var(--color-text-secondary))] hover:underline"
										>
											{expandedContext === 'log-' + entry.id ? 'Hide' : 'Show'}
										</button>
										{#if expandedContext === 'log-' + entry.id}
											<pre class="mt-1 p-2 bg-[rgb(var(--color-bg-tertiary))] rounded text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(entry.context, null, 2)}</pre>
										{/if}
									{:else}
										<span class="text-[rgb(var(--color-text-muted))]">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">Showing up to 200 most recent entries.</p>
		{/if}
	</section>
</div>
