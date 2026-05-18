<script lang="ts">
	import type { PageData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';
	import AdminPageShell from '$components/AdminPageShell.svelte';

	let { data }: { data: PageData } = $props();

	let editingRole: string | null = $state(null);
	let showCreateForm = $state(false);
	let expandedRoles = $state(new Set<string>());
	let formData = $state({
		name: '',
		description: '',
		color: '#3b82f6'
	});
	let roleSearch = $state('');
	let selectedRoleForMember = $state<string | null>(null);
	let userSearchQuery = $state('');
	let selectedUser = $state<{ did: string; handle: string; displayName: string | null } | null>(null);

	const filteredRoles = $derived(
		roleSearch.trim()
			? data.roles.filter(
					(r) =>
						r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
						(r.description?.toLowerCase().includes(roleSearch.toLowerCase()) ?? false)
				)
			: data.roles
	);

	const filteredUsers = $derived.by(() => {
		if (!userSearchQuery.trim() || !selectedRoleForMember) return [];
		const query = userSearchQuery.toLowerCase();
		const roleMembers = data.roleMembers[selectedRoleForMember] || [];
		const assignedDids = new Set(roleMembers.map((m) => m.userDid));

		return data.users
			.filter(
				(u) =>
					!assignedDids.has(u.did) &&
					(u.handle.toLowerCase().includes(query) ||
						(u.displayName?.toLowerCase().includes(query) ?? false) ||
						u.did.toLowerCase().includes(query))
			)
			.slice(0, 10);
	});

	function startEdit(role: any) {
		editingRole = role.id;
		showCreateForm = true;
		formData = {
			name: role.name,
			description: role.description || '',
			color: role.color || '#3b82f6'
		};
	}

	function cancelEdit() {
		editingRole = null;
		showCreateForm = false;
		formData = { name: '', description: '', color: '#3b82f6' };
	}

	function toggleExpand(roleId: string) {
		const newSet = new Set(expandedRoles);
		if (newSet.has(roleId)) {
			newSet.delete(roleId);
		} else {
			newSet.add(roleId);
		}
		expandedRoles = newSet;
	}

	function selectUser(user: typeof data.users[0]) {
		selectedUser = user;
		userSearchQuery = '';
	}

	function clearSelection() {
		selectedUser = null;
		selectedRoleForMember = null;
		userSearchQuery = '';
	}

	function confirmDelete(roleName: string) {
		return confirm(`Are you sure you want to delete the role "${roleName}"? This will remove it from all users.`);
	}
</script>

<AdminPageShell title="Manage Custom Roles">
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<div></div>
		{#if !editingRole}
			<button
				type="button"
				onclick={() => (showCreateForm = !showCreateForm)}
				class="btn btn-primary btn-sm"
			>
				{showCreateForm ? 'Cancel' : '+ New Role'}
			</button>
		{/if}
	</div>

	<!-- Add Member to Role -->
	{#if selectedRoleForMember}
		<div class="card mb-8 border-l-4 border-blue-500">
			<h2 class="text-lg font-semibold mb-4">Add Member to Role</h2>
			<div class="space-y-4">
				<div>
					<div class="block text-sm font-semibold mb-2">
						Role: <span class="font-mono">{data.roles.find((r) => r.id === selectedRoleForMember)?.name}</span>
					</div>
				</div>

				<div class="relative">
					<label for="userSearch" class="block text-sm font-semibold mb-2">Search Users</label>
					<input
						id="userSearch"
						type="text"
						bind:value={userSearchQuery}
						placeholder="Search by name, handle, or DID..."
						class="form-control w-full"
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
									<div class="text-xs text-[rgb(var(--color-text-muted))] font-mono">@{user.handle}</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				{#if selectedUser}
					<div class="p-3 bg-[rgb(var(--color-bg-secondary))] rounded border border-[rgb(var(--color-border))]">
						<div class="font-semibold">{selectedUser.displayName || selectedUser.handle}</div>
						<div class="text-sm text-[rgb(var(--color-text-muted))] font-mono">@{selectedUser.handle}</div>
					</div>

					<form method="POST" action="?/addRoleMember" class="flex gap-2">
						<input type="hidden" name="roleId" value={selectedRoleForMember} />
						<input type="hidden" name="userDid" value={selectedUser.did} />
						<button type="submit" class="btn btn-primary flex-1">Add Member</button>
						<button type="button" onclick={clearSelection} class="btn btn-secondary">Cancel</button>
					</form>
				{:else}
					<div class="flex gap-2">
						<button type="button" onclick={clearSelection} class="btn btn-secondary">Close</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Create / Edit form (expandable) -->
	{#if showCreateForm || editingRole}
		<div class="card mb-8">
			<h2 class="text-lg font-semibold mb-4">
				{editingRole ? 'Edit Role' : 'Create New Role'}
			</h2>

			<form method="POST" action={editingRole ? '?/editRole' : '?/createRole'} class="space-y-4">
				{#if editingRole}
					<input type="hidden" name="id" value={editingRole} />
				{/if}

				<div class="form-group">
					<label for="name" class="form-label">Role Name *</label>
					<input
						id="name"
						type="text"
						name="name"
						bind:value={formData.name}
						placeholder="e.g. VIP, Trusted, Moderator"
						maxlength="50"
						required
						class="form-control"
					/>
				</div>

				<div class="form-group">
					<label for="color" class="form-label">Color</label>
					<input
						id="color"
						type="color"
						name="color"
						bind:value={formData.color}
						class="w-12 h-10 cursor-pointer rounded border border-[rgb(var(--color-border))]"
					/>
					<p class="form-hint mt-1">Shown in user role badges</p>
				</div>

				<div class="form-group">
					<label for="description" class="form-label">Description</label>
					<textarea
						id="description"
						name="description"
						bind:value={formData.description}
						placeholder="What is this role for?"
						rows="3"
						class="form-control"
					></textarea>
				</div>

				<div class="flex gap-2">
					<button type="submit" class="btn btn-primary">
						{editingRole ? 'Save Changes' : 'Create Role'}
					</button>
					<button type="button" onclick={cancelEdit} class="btn btn-secondary">
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if data.roles.length > 0}
		<div class="card">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold">Roles</h2>
				<TableSearch
					bind:value={roleSearch}
					placeholder="Search roles..."
					onFilter={() => {}}
				/>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="border-b border-[rgb(var(--color-border))]">
						<tr>
							<th class="text-left py-2 px-3">Color</th>
							<th class="text-left py-2 px-3">Name</th>
							<th class="text-left py-2 px-3">Description</th>
							<th class="text-right py-2 px-3">Members</th>
							<th class="text-right py-2 px-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredRoles as role (role.id)}
							<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
								<td class="py-3 px-3">
									<span
										class="inline-block w-4 h-4 rounded-full border border-[rgb(var(--color-border))]"
										style:background-color={role.color ?? '#888'}
										title={role.color || 'No color'}
									></span>
								</td>
								<td class="py-3 px-3 font-semibold">{role.name}</td>
								<td class="py-3 px-3 text-[rgb(var(--color-text-muted))]">
									{role.description || '—'}
								</td>
								<td class="py-3 px-3 text-right">
									{#if role.memberCount > 0}
										<button
											type="button"
											onclick={() => toggleExpand(role.id)}
											class="link text-blue-600 hover:underline font-semibold cursor-pointer"
										>
											{role.memberCount} member{role.memberCount === 1 ? '' : 's'}
										</button>
									{:else}
										<span class="text-[rgb(var(--color-text-muted))]">{role.memberCount}</span>
									{/if}
								</td>
								<td class="py-3 px-3 text-right space-x-2">
									<button
										type="button"
										onclick={() => {
											selectedRoleForMember = role.id;
										}}
										class="btn btn-sm text-green-600 hover:underline"
									>
										+ Add
									</button>
									<button
										type="button"
										onclick={() => startEdit(role)}
										class="btn btn-sm text-blue-600 hover:underline"
									>
										Edit
									</button>
									<form
										action="?/deleteRole"
										method="POST"
										onsubmit={(e) => {
											if (!confirmDelete(role.name)) {
												e.preventDefault();
											}
										}}
										class="inline"
									>
										<input type="hidden" name="id" value={role.id} />
										<button type="submit" class="btn btn-sm text-red-600 hover:underline">
											Delete
										</button>
									</form>
								</td>
							</tr>

							{#if expandedRoles.has(role.id)}
								<tr class="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-secondary))]">
									<td colspan="5" class="px-3 py-3">
										{#if !data.roleMembers[role.id]?.length}
											<p class="text-sm italic text-[rgb(var(--color-text-muted))]">No members</p>
										{:else}
											<div class="space-y-2">
												{#each data.roleMembers[role.id] as member}
													<div class="flex items-center justify-between p-2 bg-[rgb(var(--color-bg))] rounded border border-[rgb(var(--color-border))] text-sm">
														<a href="/user/{member.handle}" class="link hover:underline">
															{member.displayName || member.handle}
															<span class="text-[rgb(var(--color-text-muted))] font-mono text-xs">@{member.handle}</span>
														</a>
														<form method="POST" action="?/removeRoleMember" class="inline">
															<input type="hidden" name="roleId" value={role.id} />
															<input type="hidden" name="userDid" value={member.userDid} />
															<button type="submit" class="text-xs text-red-600 hover:text-red-700 hover:underline">
																Remove
															</button>
														</form>
													</div>
												{/each}
											</div>
										{/if}
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<div class="card text-center text-[rgb(var(--color-text-muted))] py-8">
			<p>No roles yet. Create one above.</p>
		</div>
	{/if}
</AdminPageShell>
