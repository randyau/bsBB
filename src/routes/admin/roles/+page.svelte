<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let editingRole: string | null = $state(null);
	let formData = $state({
		name: '',
		description: '',
		color: '#3b82f6'
	});

	function startEdit(role: any) {
		editingRole = role.id;
		formData = {
			name: role.name,
			description: role.description || '',
			color: role.color || '#3b82f6'
		};
	}

	function cancelEdit() {
		editingRole = null;
		formData = { name: '', description: '', color: '#3b82f6' };
	}

	function confirmDelete(roleName: string) {
		return confirm(`Are you sure you want to delete the role "${roleName}"? This will remove it from all users.`);
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
	<h1 class="text-3xl font-bold mb-8">Manage Custom Roles</h1>

	{#if data.roles.length > 0}
		<div class="card mb-8">
			<h2 class="text-lg font-semibold mb-4">Roles</h2>
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
						{#each data.roles as role (role.id)}
							<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
								<td class="py-3 px-3">
									<span
										class="inline-block w-4 h-4 rounded-full border border-[rgb(var(--color-border))]"
										style="background-color: {role.color ?? '#888'}"
										title={role.color || 'No color'}
									></span>
								</td>
								<td class="py-3 px-3 font-semibold">{role.name}</td>
								<td class="py-3 px-3 text-[rgb(var(--color-text-muted))]">
									{role.description || '—'}
								</td>
								<td class="py-3 px-3 text-right text-[rgb(var(--color-text-muted))]">
									{role.memberCount}
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
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<div class="card">
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
				{#if editingRole}
					<button type="button" onclick={cancelEdit} class="btn btn-secondary">
						Cancel
					</button>
				{/if}
			</div>
		</form>
	</div>
</div>
