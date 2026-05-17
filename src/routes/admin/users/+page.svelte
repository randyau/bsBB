<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">User Management</h1>

	{#if form?.error}
		<div class="rounded-lg border border-[rgb(var(--color-error))] bg-[rgb(var(--color-bg-secondary))] p-4 text-[rgb(var(--color-error))] text-sm">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-lg border border-[rgb(var(--color-success))] bg-[rgb(var(--color-bg-secondary))] p-4 text-[rgb(var(--color-success))] text-sm">
			✓ User action completed: {form.action}
		</div>
	{/if}

	<TableSearch
		value={data.q}
		placeholder="Search by handle or display name..."
		clearHref="/admin/users"
	/>

	<div class="rounded-lg border border-[rgb(var(--color-border))] overflow-x-auto">
		<table class="w-full text-sm">
			<thead class="bg-[rgb(var(--color-bg-tertiary))] border-b border-[rgb(var(--color-border))]">
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
					<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
						<td class="px-4 py-3 font-mono text-xs">
							<a href="/user/{user.handle}" class="link hover:underline">{user.handle}</a>
						</td>
						<td class="px-4 py-3">{user.displayName || '—'}</td>
						<td class="px-4 py-3">
							<span
								class={`px-2 py-1 rounded text-xs font-semibold ${
									user.globalRole === 'admin'
										? 'bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-error))]'
										: user.globalRole === 'banned'
											? 'bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text))]'
											: 'bg-[rgb(var(--color-bg-secondary))] text-[rgb(var(--color-primary))]'
								}`}
							>
								{user.globalRole}
							</span>
						</td>
						<td class="px-4 py-3 text-xs text-[rgb(var(--color-text-muted))]">
							{new Date(user.createdAt).toLocaleDateString()}
						</td>
						<td class="px-4 py-3">
							<div class="flex flex-col gap-2 text-xs">
								{#if user.globalRole !== 'admin' && user.globalRole !== 'banned'}
									<form method="POST" action="?/promote" class="inline">
										<input type="hidden" name="did" value={user.did} />
										<button type="submit" class="text-amber-600 hover:underline font-semibold">Make Admin</button>
									</form>
								{:else if user.globalRole === 'admin'}
									<form method="POST" action="?/demote" class="inline">
										<input type="hidden" name="did" value={user.did} />
										<button type="submit" class="text-[rgb(var(--color-text-muted))] hover:underline">Remove Admin</button>
									</form>
								{/if}

								{#if user.globalRole === 'banned'}
									<form method="POST" action="?/unban" class="inline">
										<input type="hidden" name="did" value={user.did} />
										<button type="submit" class="text-[rgb(var(--color-success))] hover:underline font-semibold">Unban</button>
									</form>
								{:else}
									<form method="POST" action="?/ban" class="flex flex-col gap-1">
										<input type="hidden" name="did" value={user.did} />
										<label for="ban-reason-{user.did}" class="text-[rgb(var(--color-text-muted))]">Ban reason (optional)</label>
										<input
											id="ban-reason-{user.did}"
											type="text"
											name="reason"
											placeholder="Reason..."
											class="form-control text-xs"
										/>
										<button type="submit" class="text-[rgb(var(--color-error))] hover:underline text-left font-semibold">Ban user</button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	<div class="flex items-center justify-between">
		<p class="text-xs text-[rgb(var(--color-text-muted))]">
			Showing {data.users.length} of {data.total} user{data.total === 1 ? '' : 's'}{data.q ? ` matching "${data.q}"` : ''}
		</p>
		<div class="flex gap-2 items-center">
			{#if data.page > 1}
				<a href={`/admin/users?page=1${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary">First</a>
				<a href={`/admin/users?page=${data.page - 1}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary">← Back</a>
			{/if}
			<span class="text-xs text-[rgb(var(--color-text-muted))]">
				Page {data.page} of {data.totalPages}
			</span>
			{#if data.page < data.totalPages}
				<a href={`/admin/users?page=${data.page + 1}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary">Next →</a>
				<a href={`/admin/users?page=${data.totalPages}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary">Last</a>
			{/if}
		</div>
	</div>
</div>
