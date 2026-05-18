<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';
	import AdminPageShell from '$components/AdminPageShell.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();
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

<AdminPageShell title="Forum Management" {form}>

	<!-- Forums List -->
	<div class="space-y-6">
		<div class="space-y-2">
			<h2 class="section-title mb-4">Forums</h2>
			<div class="box-secondary">
				<table class="w-full text-sm">
					<thead class="table-thead">
					<tr>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Name</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Parent</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Order</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Approval (days)</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.forums as forum (forum.id)}
						<tr class="border-b">
							<td class="px-4 py-3 font-semibold">{forum.name}</td>
							<td class="px-4 py-3 text-sm">{forum.parentName || '—'}</td>
							<td class="px-4 py-3 text-sm text-muted">{forum.sortOrder}</td>
							<td class="px-4 py-3">
								<form method="POST" action="?/setApprovalDays" class="flex items-center gap-2">
									<input type="hidden" name="forumId" value={forum.id} />
									<label for="approval-days-{forum.id}" class="sr-only">Approval age threshold in days for {forum.name} (0 = disabled)</label>
									<input
										id="approval-days-{forum.id}"
										type="number"
										name="days"
										value={forum.requireApprovalDays}
										min="0"
										max="365"
										class="form-control w-20 text-sm py-1"
										title="Require approval for accounts younger than this many days (0 = disabled)"
									/>
									<button type="submit" class="btn btn-sm btn-secondary">Set</button>
								</form>
								{#if forum.requireApprovalDays > 0}
									<p class="text-xs text-muted mt-1">Accounts &lt; {forum.requireApprovalDays}d need approval</p>
								{/if}
							</td>
							<td class="px-4 py-3 space-x-2 flex gap-2">
								<form method="POST" action="?/reorder" class="inline">
									<input type="hidden" name="forumId" value={forum.id} />
									<input type="hidden" name="direction" value="up" />
									<button type="submit" class="btn btn-sm btn-secondary" aria-label="Move {forum.name} up" title="Move up">↑</button>
								</form>
								<form method="POST" action="?/reorder" class="inline">
									<input type="hidden" name="forumId" value={forum.id} />
									<input type="hidden" name="direction" value="down" />
									<button type="submit" class="btn btn-sm btn-secondary" aria-label="Move {forum.name} down" title="Move down">↓</button>
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
		<h2 class="section-title">Assign Moderators</h2>
		<div class="card-secondary space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div class="form-group">
					<label for="forumSelect" class="form-label">Forum</label>
					<select id="forumSelect" bind:value={selectedForumId} class="form-control">
						<option value="">Select a forum</option>
						{#each data.forums as forum (forum.id)}
							<option value={forum.id}>{forum.name}</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label for="userSearch" class="form-label">User (Search or Select)</label>
					<div class="relative">
						<input
							id="userSearch"
							type="text"
							bind:value={userSearchQuery}
							placeholder="Search by handle, name, or DID..."
							class="form-control"
						/>
						{#if userSearchQuery && filteredUsers.length > 0}
							<div class="absolute top-full left-0 right-0 mt-1 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded shadow-lg z-10 max-h-48 overflow-y-auto">
								{#each filteredUsers as user (user.did)}
									<button
										type="button"
										onclick={() => selectUser(user)}
										class="w-full text-left px-3 py-2 hover:bg-[rgb(var(--color-bg-secondary))] text-sm transition-colors"
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
					class="btn btn-primary"
				>
					Assign Moderator
				</button>
			</form>
		</div>
	</div>

	<!-- Current Moderators -->
	<div class="space-y-2">
		<h2 class="section-title mb-4">Forum Moderators</h2>
		<div class="card-secondary">
			{#if data.mods.length === 0}
				<p class="text-sm text-muted">No forum moderators assigned yet.</p>
			{:else}
				<!-- Filter bar -->
				<div class="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[rgb(var(--color-border))] items-center">
					<select bind:value={modForumFilter} class="form-control text-sm select-w-sm">
						<option value="">All forums</option>
						{#each data.forums as forum}
							<option value={forum.id}>{forum.name}</option>
						{/each}
					</select>
					<TableSearch
						bind:value={modUserFilter}
						placeholder="Search user by name or handle..."
						onFilter={() => {}}
					/>
					{#if modForumFilter || modUserFilter}
						<button
							onclick={() => { modForumFilter = ''; modUserFilter = ''; }}
							class="btn btn-sm btn-secondary"
						>
							Clear filters
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
						<thead class="border-b">
							<tr>
								<th class="px-4 py-3 text-left font-semibold">Forum</th>
								<th class="px-4 py-3 text-left font-semibold">User</th>
								<th class="px-4 py-3 text-left font-semibold">Action</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredMods as mod (mod.userDid + mod.forumId)}
							<tr class="border-b">
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

	<!-- Permissions Matrix -->
	{#if data.roles.length > 0}
		<div class="space-y-4">
			<h2 class="section-title">Role Permissions</h2>
			<div class="card-secondary space-y-4">
				<p class="text-sm text-[rgb(var(--color-text-muted))]">
					Set per-role permissions for each forum. Roles inherit permissions from parent forums unless explicitly overridden.
				</p>

				{#each data.forums as forum (forum.id)}
					<details class="border border-[rgb(var(--color-border))] rounded">
						<summary class="p-4 font-semibold cursor-pointer hover:bg-[rgb(var(--color-bg-secondary))] transition-colors">
							{forum.name}
						</summary>
						<div class="p-4 border-t border-[rgb(var(--color-border))] overflow-x-auto">
							<table class="w-full text-xs">
								<thead class="border-b border-[rgb(var(--color-border))]">
									<tr>
										<th class="text-left py-2 px-2">Role</th>
										<th class="text-center py-2 px-2">Read</th>
										<th class="text-center py-2 px-2">Post</th>
										<th class="text-center py-2 px-2">Moderate</th>
									</tr>
								</thead>
								<tbody>
									<!-- System roles: always full access, not configurable -->
									{#each ['admin', 'moderator'] as sysRole}
										<tr class="border-b border-[rgb(var(--color-border))] opacity-50">
											<td class="py-2 px-2 font-semibold">
												{sysRole}
												<span class="ml-1 text-[10px] font-normal text-[rgb(var(--color-text-muted))]">(system)</span>
											</td>
											<td class="text-center py-2 px-2 text-[rgb(var(--color-success))]" title="Always granted">✓</td>
											<td class="text-center py-2 px-2 text-[rgb(var(--color-success))]" title="Always granted">✓</td>
											<td class="text-center py-2 px-2 text-[rgb(var(--color-success))]" title="Always granted">✓</td>
										</tr>
									{/each}
									<!-- Configurable roles -->
									{#each ['guest', 'member', ...data.roles.map(r => r.name)] as roleName}
										{@const perm = data.permissions[forum.id]?.find(p => p.role === roleName)}
										<tr class="border-b border-[rgb(var(--color-border))]">
											<td class="py-2 px-2 font-semibold">{roleName}</td>
											<td class="text-center py-2 px-2">
												<form method="POST" action="?/updatePermission" class="inline">
													<input type="hidden" name="forumId" value={forum.id} />
													<input type="hidden" name="role" value={roleName} />
													<input type="hidden" name="permType" value="canRead" />
													<input type="hidden" name="value" value={!(perm?.canRead ?? false)} />
													<button type="submit" class="relative w-5 h-5 inline-flex items-center justify-center border-2 border-[rgb(var(--color-border))] rounded transition-all hover:border-[rgb(var(--color-primary))] focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.5)]" title={perm?.canRead ? 'Remove read access' : 'Grant read access'}>
														{#if perm?.canRead}
															<span class="absolute inset-0 bg-[rgb(var(--color-success))] rounded flex items-center justify-center text-white text-xs">✓</span>
														{/if}
													</button>
												</form>
											</td>
											<td class="text-center py-2 px-2">
												<form method="POST" action="?/updatePermission" class="inline">
													<input type="hidden" name="forumId" value={forum.id} />
													<input type="hidden" name="role" value={roleName} />
													<input type="hidden" name="permType" value="canPost" />
													<input type="hidden" name="value" value={!(perm?.canPost ?? false)} />
													<button type="submit" class="relative w-5 h-5 inline-flex items-center justify-center border-2 border-[rgb(var(--color-border))] rounded transition-all hover:border-[rgb(var(--color-primary))] focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.5)]" title={perm?.canPost ? 'Remove post access' : 'Grant post access'}>
														{#if perm?.canPost}
															<span class="absolute inset-0 bg-[rgb(var(--color-success))] rounded flex items-center justify-center text-white text-xs">✓</span>
														{/if}
													</button>
												</form>
											</td>
											<td class="text-center py-2 px-2">
												<form method="POST" action="?/updatePermission" class="inline">
													<input type="hidden" name="forumId" value={forum.id} />
													<input type="hidden" name="role" value={roleName} />
													<input type="hidden" name="permType" value="canModerate" />
													<input type="hidden" name="value" value={!(perm?.canModerate ?? false)} />
													<button type="submit" class="relative w-5 h-5 inline-flex items-center justify-center border-2 border-[rgb(var(--color-border))] rounded transition-all hover:border-[rgb(var(--color-primary))] focus:outline-none focus:shadow-[0_0_0_3px_rgba(59,130,246,0.5)]" title={perm?.canModerate ? 'Remove moderate access' : 'Grant moderate access'}>
														{#if perm?.canModerate}
															<span class="absolute inset-0 bg-[rgb(var(--color-success))] rounded flex items-center justify-center text-white text-xs">✓</span>
														{/if}
													</button>
												</form>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</details>
				{/each}
			</div>
		</div>
	{/if}
	</div>
</AdminPageShell>
