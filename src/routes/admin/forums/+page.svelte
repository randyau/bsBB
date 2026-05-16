<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);
	let modUserId = $state('');
	let selectedForumId = $state('');
	let userSearchQuery = $state('');
	let modForumFilter = $state('');
	let modUserFilter = $state('');

	const filteredUsers = $derived.by(() => {
		if (!userSearchQuery.trim()) return data.users;
		const query = userSearchQuery.toLowerCase();
		return data.users.filter(
			u =>
				u.handle.toLowerCase().includes(query) ||
				(u.displayName?.toLowerCase().includes(query) ?? false) ||
				u.did.toLowerCase().includes(query)
		);
	});

	const filteredMods = $derived.by(() => {
		return data.mods.filter(mod => {
			const forumMatch = !modForumFilter || mod.forumId === modForumFilter;
			const userQuery = modUserFilter.toLowerCase().trim();
			const userMatch = !userQuery ||
				mod.userHandle.toLowerCase().includes(userQuery) ||
				(mod.userDisplayName?.toLowerCase().includes(userQuery) ?? false);
			return forumMatch && userMatch;
		});
	});

	function selectUser(user: typeof data.users[0]) {
		modUserId = user.did;
		userSearchQuery = '';
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">Forum Management</h1>

	{#if form?.error}
		<div class="card-secondary text-error">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="card-secondary text-success">
			✓ Action completed: {form.action}
		</div>
	{/if}

	<!-- Forums List -->
	<div class="space-y-2">
		<h2 class="text-xl font-semibold mb-4">Forums</h2>
		<div class="card-secondary">
			<table class="w-full text-sm">
				<thead class="border-b" style="border-bottom-color: rgb(var(--color-border))">
					<tr>
						<th class="px-4 py-3 text-left font-semibold">Name</th>
						<th class="px-4 py-3 text-left font-semibold">Parent</th>
						<th class="px-4 py-3 text-left font-semibold">Order</th>
						<th class="px-4 py-3 text-left font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.forums as forum (forum.id)}
						<tr style="border-bottom-color: rgb(var(--color-border))" class="border-b">
							<td class="px-4 py-3 font-semibold">{forum.name}</td>
							<td class="px-4 py-3 text-sm">{forum.parentName || '—'}</td>
							<td class="px-4 py-3 text-sm text-muted">{forum.sortOrder}</td>
							<td class="px-4 py-3 space-x-2 flex gap-2">
								<form method="POST" action="?/reorder" class="inline">
									<input type="hidden" name="forumId" value={forum.id} />
									<input type="hidden" name="direction" value="up" />
									<button type="submit" class="text-xs hover:underline">↑</button>
								</form>
								<form method="POST" action="?/reorder" class="inline">
									<input type="hidden" name="forumId" value={forum.id} />
									<input type="hidden" name="direction" value="down" />
									<button type="submit" class="text-xs hover:underline">↓</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Moderator Assignment -->
	<div class="space-y-4">
		<h2 class="text-xl font-semibold">Assign Moderators</h2>
		<div class="card-secondary space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="forumSelect" class="block text-sm font-semibold mb-1">Forum</label>
					<select id="forumSelect" bind:value={selectedForumId} class="w-full border rounded px-3 py-2">
						<option value="">Select a forum</option>
						{#each data.forums as forum (forum.id)}
							<option value={forum.id}>{forum.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="userSearch" class="block text-sm font-semibold mb-1">User (Search or Select)</label>
					<div class="relative">
						<input
							id="userSearch"
							type="text"
							bind:value={userSearchQuery}
							placeholder="Search by handle, name, or DID..."
							class="w-full border rounded px-3 py-2"
						/>
						{#if userSearchQuery && filteredUsers.length > 0}
							<div class="absolute top-full left-0 right-0 mt-1 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
								{#each filteredUsers as user (user.did)}
									<button
										type="button"
										onclick={() => selectUser(user)}
										class="w-full text-left px-3 py-2 hover:bg-[rgb(var(--color-bg-secondary))] text-sm"
									>
										<div class="font-semibold">{user.displayName || user.handle}</div>
										<div class="text-xs text-muted font-mono">{user.did}</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
					{#if modUserId}
						<div class="mt-2 text-xs">
							Selected: <span class="font-mono">{modUserId}</span>
							<button
								type="button"
								onclick={() => (modUserId = '')}
								class="ml-2 text-error hover:underline"
							>
								Clear
							</button>
						</div>
					{/if}
				</div>
			</div>
			<form method="POST" action="?/assignMod">
				<input type="hidden" name="forumId" value={selectedForumId} />
				<input type="hidden" name="userDid" value={modUserId} />
				<button
					type="submit"
					disabled={!selectedForumId || !modUserId}
					class="px-4 py-2 btn-primary rounded disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Assign Moderator
				</button>
			</form>
		</div>
	</div>

	<!-- Current Moderators -->
	<div class="space-y-2">
		<h2 class="text-xl font-semibold mb-4">Forum Moderators</h2>
		<div class="card-secondary">
			{#if data.mods.length === 0}
				<p class="text-sm text-muted">No forum moderators assigned yet.</p>
			{:else}
				<!-- Filter bar -->
				<div class="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[rgb(var(--color-border))] items-center">
					<select bind:value={modForumFilter} class="form-control text-sm" style="width: 160px; min-width: 120px; max-width: 200px;">
						<option value="">All forums</option>
						{#each data.forums as forum}
							<option value={forum.id}>{forum.name}</option>
						{/each}
					</select>
					<input
						type="text"
						bind:value={modUserFilter}
						placeholder="Search user by name or handle..."
						class="form-control text-sm flex-1"
						style="min-width: 160px;"
					/>
					{#if modForumFilter || modUserFilter}
						<button
							onclick={() => { modForumFilter = ''; modUserFilter = ''; }}
							class="btn btn-sm btn-secondary"
						>
							Clear
						</button>
					{/if}
					<span class="text-xs text-muted">
						{filteredMods.length} of {data.mods.length}
					</span>
				</div>

				{#if filteredMods.length === 0}
					<p class="text-sm text-muted italic">No results matching filter.</p>
				{:else}
					<table class="w-full text-sm">
						<thead class="border-b" style="border-bottom-color: rgb(var(--color-border))">
							<tr>
								<th class="px-4 py-3 text-left font-semibold">Forum</th>
								<th class="px-4 py-3 text-left font-semibold">User</th>
								<th class="px-4 py-3 text-left font-semibold">Action</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredMods as mod (mod.userDid + mod.forumId)}
							<tr style="border-bottom-color: rgb(var(--color-border))" class="border-b">
								<td class="px-4 py-3 font-semibold">{mod.forumName}</td>
								<td class="px-4 py-3 text-sm">
									<a href="/user/{mod.userHandle}" class="link font-semibold hover:underline">{mod.userDisplayName || mod.userHandle}</a>
									<div class="text-xs text-muted font-mono">
										<a href="/user/{mod.userHandle}" class="link hover:underline">@{mod.userHandle}</a>
									</div>
								</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/removeMod" class="inline">
										<input type="hidden" name="forumId" value={mod.forumId} />
										<input type="hidden" name="userDid" value={mod.userDid} />
										<button type="submit" class="text-xs text-error hover:underline">Remove</button>
									</form>
								</td>
							</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			{/if}
		</div>
	</div>
</div>
