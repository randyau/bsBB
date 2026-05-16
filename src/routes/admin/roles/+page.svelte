<script lang="ts">
	import type { PageData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';

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

	const filteredRoles = $derived(
		roleSearch.trim()
			? data.roles.filter(
					(r) =>
						r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
						(r.description?.toLowerCase().includes(roleSearch.toLowerCase()) ?? false)
				)
			: data.roles
	);

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
		if (expandedRoles.has(roleId)) {
			expandedRoles.delete(roleId);
		} else {
			expandedRoles.add(roleId);
		}
	}

	function confirmDelete(roleName: string) {
		return confirm(`Are you sure you want to delete the role "${roleName}"? This will remove it from all users.`);
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
	<div class="flex items-center justify-between mb-8">
		<h1 class="text-3xl font-bold">Manage Custom Roles</h1>
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
</div>
