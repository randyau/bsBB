<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	function confirmPromote(handle: string): boolean {
		return confirm(`Promote @${handle} to Admin?\n\nThey will gain full moderation powers.`);
	}

	function confirmBan(handle: string): boolean {
		return confirm(`Ban @${handle}?\n\nThis prevents them from posting and will be logged.`);
	}
</script>

<div class="space-y-6">
	<h1 class="page-title">User Management</h1>

	{#if form?.error}
		<div class="alert alert-error text-sm" role="alert">
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success text-sm" role="alert">
			✓ User action completed: {form.action}
		</div>
	{/if}

	<TableSearch
		value={data.q}
		placeholder="Search by handle or display name..."
		clearHref="/admin/users"
	/>

	<div class="table-container">
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
									<form method="POST" action="?/promote" class="inline" onsubmit={() => confirmPromote(user.handle)}>
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
									<form method="POST" action="?/ban" class="flex flex-col gap-1" onsubmit={() => confirmBan(user.handle)}>
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
				<a href={`/admin/users?page=1${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary" aria-label="Go to first page">First</a>
				<a href={`/admin/users?page=${data.page - 1}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary" aria-label="Go to previous page">← Back</a>
			{/if}
			<span class="text-xs text-[rgb(var(--color-text-muted))]">
				Page {data.page} of {data.totalPages}
			</span>
			{#if data.page < data.totalPages}
				<a href={`/admin/users?page=${data.page + 1}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary" aria-label="Go to next page">Next →</a>
				<a href={`/admin/users?page=${data.totalPages}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`} class="btn btn-sm btn-secondary" aria-label="Go to last page">Last</a>
			{/if}
		</div>
	</div>
</div>
