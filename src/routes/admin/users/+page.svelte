<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);
	let banReason: Record<string, string> = $state({});
	let showBanReason: Record<string, boolean> = $state({});
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">User Management</h1>

	{#if form?.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 text-sm">
			✓ User action completed: {form.action}
		</div>
	{/if}

	<div class="rounded-lg border border-gray-200 overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="bg-gray-100 border-b border-gray-200">
				<tr>
					<th class="px-4 py-3 text-left font-semibold">Handle</th>
					<th class="px-4 py-3 text-left font-semibold">Display Name</th>
					<th class="px-4 py-3 text-left font-semibold">Role</th>
					<th class="px-4 py-3 text-left font-semibold">Joined</th>
					<th class="px-4 py-3 text-left font-semibold">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.did)}
					<tr class="border-b border-gray-200 hover:bg-gray-50">
						<td class="px-4 py-3 font-mono text-xs">{user.handle}</td>
						<td class="px-4 py-3">{user.displayName || '—'}</td>
						<td class="px-4 py-3">
							<span
								class={`px-2 py-1 rounded text-xs font-semibold ${
									user.globalRole === 'admin'
										? 'bg-red-100 text-red-800'
										: user.globalRole === 'banned'
											? 'bg-gray-100 text-gray-800'
											: 'bg-blue-100 text-blue-800'
								}`}
							>
								{user.globalRole}
							</span>
						</td>
						<td class="px-4 py-3 text-xs text-gray-500">
							{new Date(user.createdAt).toLocaleDateString()}
						</td>
						<td class="px-4 py-3 space-x-2 flex flex-wrap gap-1">
							{#if user.globalRole === 'banned'}
								<form method="POST" action="?/unban" class="inline">
									<input type="hidden" name="did" value={user.did} />
									<button type="submit" class="text-xs text-green-600 hover:underline font-semibold"
										>Unban</button
									>
								</form>
							{:else}
								<div class="flex gap-1">
									{#if showBanReason[user.did]}
										<form method="POST" action="?/ban" class="inline">
											<input type="hidden" name="did" value={user.did} />
											<input type="hidden" name="reason" value={banReason[user.did] || ''} />
											<button
												type="submit"
												class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
											>
												Ban
											</button>
										</form>
										<input
											type="text"
											placeholder="Reason..."
											bind:value={banReason[user.did]}
											class="text-xs px-2 py-1 border border-gray-300 rounded w-32"
										/>
										<button
											onclick={() => (showBanReason[user.did] = false)}
											class="text-xs text-gray-600 hover:text-gray-800"
										>
											✕
										</button>
									{:else}
										<button
											onclick={() => (showBanReason[user.did] = true)}
											class="text-xs text-red-600 hover:underline"
										>
											Ban
										</button>
									{/if}
								</div>
							{/if}

							{#if user.globalRole !== 'admin'}
								<form method="POST" action="?/promote" class="inline">
									<input type="hidden" name="did" value={user.did} />
									<button type="submit" class="text-xs text-amber-600 hover:underline">Promote</button>
								</form>
							{:else}
								<form method="POST" action="?/demote" class="inline">
									<input type="hidden" name="did" value={user.did} />
									<button type="submit" class="text-xs text-gray-600 hover:underline">Demote</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-xs text-gray-500">Total users: {data.users.length}</p>
</div>
