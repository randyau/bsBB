<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import TableSearch from '$components/TableSearch.svelte';
	import AdminPageShell from '$components/AdminPageShell.svelte';
	import Pagination from '$components/Pagination.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	const viewerIsAdmin = data.user.globalRole === 'admin';

	function confirmPromote(handle: string): boolean {
		return confirm(`Promote @${handle} to Admin?\n\nThey will gain full admin powers including forum config and user management.`);
	}

	function confirmPromoteMod(handle: string): boolean {
		return confirm(`Make @${handle} a global Moderator?\n\nThey will gain moderation access across all forums.`);
	}

	function confirmBan(handle: string): boolean {
		return confirm(`Ban @${handle}?\n\nThis prevents them from posting and will be logged.`);
	}
</script>

<AdminPageShell title="User Management" {form}>
	<div class="space-y-6">
		<div class="flex flex-wrap items-center gap-3">
			<TableSearch
				value={data.q}
				placeholder="Search by handle or display name..."
				clearHref="/admin/users"
			/>
		</div>

		<div class="table-container">
			<table class="w-full text-sm">
				<thead class="table-thead">
					<tr>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Handle</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Display Name</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Role</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Joined</th>
						<th scope="col" class="px-4 py-3 text-left font-semibold">Actions</th>
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
											: user.globalRole === 'moderator'
												? 'bg-[rgb(var(--color-bg-secondary))] text-amber-600'
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
									<!-- Role management (admin only) -->
									{#if viewerIsAdmin}
										{#if user.globalRole === 'member'}
											<form method="POST" use:enhance action="?/promoteModerator" class="inline" onsubmit={() => confirmPromoteMod(user.handle)}>
												<input type="hidden" name="did" value={user.did} />
												<button type="submit" class="text-amber-600 hover:underline font-semibold">Make Moderator</button>
											</form>
											<form method="POST" use:enhance action="?/promote" class="inline" onsubmit={() => confirmPromote(user.handle)}>
												<input type="hidden" name="did" value={user.did} />
												<button type="submit" class="text-[rgb(var(--color-error))] hover:underline font-semibold">Make Admin</button>
											</form>
										{:else if user.globalRole === 'moderator'}
											<form method="POST" use:enhance action="?/demoteModerator" class="inline">
												<input type="hidden" name="did" value={user.did} />
												<button type="submit" class="text-[rgb(var(--color-text-muted))] hover:underline">Remove Moderator</button>
											</form>
											<form method="POST" use:enhance action="?/promote" class="inline" onsubmit={() => confirmPromote(user.handle)}>
												<input type="hidden" name="did" value={user.did} />
												<button type="submit" class="text-[rgb(var(--color-error))] hover:underline font-semibold">Make Admin</button>
											</form>
										{:else if user.globalRole === 'admin'}
											<form method="POST" use:enhance action="?/demote" class="inline">
												<input type="hidden" name="did" value={user.did} />
												<button type="submit" class="text-[rgb(var(--color-text-muted))] hover:underline">Remove Admin</button>
											</form>
										{/if}
									{/if}

									<!-- Ban/unban (mods and admins) -->
									{#if user.globalRole === 'banned'}
										<form method="POST" use:enhance action="?/unban" class="inline">
											<input type="hidden" name="did" value={user.did} />
											<button type="submit" class="text-[rgb(var(--color-success))] hover:underline font-semibold">Unban</button>
										</form>
									{:else if user.globalRole !== 'admin'}
										<form method="POST" use:enhance action="?/ban" class="flex flex-col gap-1" onsubmit={() => confirmBan(user.handle)}>
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

		<Pagination
			page={data.page}
			totalPages={data.totalPages}
			total={data.total}
			buildUrl={(p) => `/admin/users?page=${p}${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`}
		/>
	</div>
</AdminPageShell>
