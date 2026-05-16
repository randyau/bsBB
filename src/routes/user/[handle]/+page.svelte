<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let forumModSelect = $state('');
	let banReason = $state('');

	function getInitial(name: string | null | undefined): string {
		return (name || data.profileUser.handle).charAt(0).toUpperCase();
	}

	function isRoleAssigned(roleId: string): boolean {
		return data.customRoles.some((r) => r.id === roleId);
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<!-- Header with user info -->
	<div class="mb-8 flex gap-6 items-start">
		<!-- Avatar -->
		<div class="flex-shrink-0">
			{#if data.profileUser.avatarUrl}
				<img
					src={data.profileUser.avatarUrl}
					alt={data.profileUser.handle}
					class="w-20 h-20 rounded-full object-cover"
				/>
			{:else}
				<div
					class="w-20 h-20 rounded-full bg-[rgb(var(--color-bg-secondary))] flex items-center justify-center text-2xl font-bold text-[rgb(var(--color-text-muted))]"
				>
					{getInitial(data.profileUser.displayName)}
				</div>
			{/if}
		</div>

		<!-- User info -->
		<div class="flex-1">
			<h1 class="text-3xl font-bold mb-1">{data.profileUser.displayName || data.profileUser.handle}</h1>
			<p class="text-[rgb(var(--color-text-muted))] font-mono text-sm mb-3">@{data.profileUser.handle}</p>

			<div class="flex gap-2 items-center mb-3">
				<!-- Global role badge -->
				{#if data.profileUser.globalRole === 'admin'}
					<span class="badge bg-red-50 text-red-600 border border-red-200">Admin</span>
				{:else if data.profileUser.globalRole === 'banned'}
					<span class="badge bg-gray-100 text-gray-600 border border-gray-300">Banned</span>
				{:else}
					<span class="badge bg-blue-50 text-blue-600 border border-blue-200">Member</span>
				{/if}

				<!-- Custom role badges -->
				{#each data.customRoles as role}
					<span class="badge border" style:background-color={role.color ? role.color + '20' : undefined} style:color={role.color || undefined}>
						{role.name}
					</span>
				{/each}
			</div>

			<p class="text-sm text-[rgb(var(--color-text-muted))]">
				Joined {new Date(data.profileUser.createdAt).toLocaleDateString()}
			</p>
		</div>
	</div>

	<!-- Recent posts -->
	{#if data.recentPosts.length > 0}
		<div class="card mb-8">
			<h2 class="text-xl font-bold mb-4">Recent Posts</h2>
			<div class="space-y-3">
				{#each data.recentPosts as post}
					<a
						href="/f/{post.forumSlug}/t/{post.threadSlug}"
						class="block p-3 rounded border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))] transition"
					>
						<p class="font-semibold mb-1">{post.threadTitle}</p>
						<p class="text-xs text-[rgb(var(--color-text-muted))] mb-2">
							in <span class="font-mono">{post.forumName}</span> · {new Date(post.createdAt).toLocaleDateString()}
						</p>
						<p class="text-sm line-clamp-2 text-[rgb(var(--color-text-secondary))]">
							{post.bodyPreview}
						</p>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Admin management panel -->
	{#if data.isAdmin && !data.isSelf}
		<div class="card border-l-4 border-l-amber-500">
			<h2 class="text-xl font-bold mb-6">Manage User</h2>

			<div class="space-y-6">
				<!-- Global role management -->
				<div class="box-secondary">
					<h3 class="font-semibold mb-3">Global Role</h3>
					<div class="flex gap-2">
						{#if data.profileUser.globalRole === 'banned'}
							<form method="POST" action="?/unban" class="inline">
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<button type="submit" class="btn btn-sm bg-green-50 text-green-600 hover:bg-green-100 border border-green-200">
									Unban
								</button>
							</form>
						{:else}
							<form method="POST" action="?/ban" class="inline space-x-2 flex">
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<textarea
									name="reason"
									placeholder="Reason (optional)"
									class="form-control text-xs w-40 h-16"
									bind:value={banReason}
								></textarea>
								<button type="submit" class="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
									Ban
								</button>
							</form>
						{/if}

						{#if data.profileUser.globalRole !== 'admin'}
							<form method="POST" action="?/promote" class="inline">
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<button type="submit" class="btn btn-sm bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200">
									Promote to Admin
								</button>
							</form>
						{:else}
							<form method="POST" action="?/demote" class="inline">
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<button type="submit" class="btn btn-sm bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200">
									Demote
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Forum moderator assignments -->
				{#if data.allForums.length > 0}
					<div class="box-secondary">
						<h3 class="font-semibold mb-4">Forum Moderator</h3>

						<!-- Currently moderating -->
						<div class="mb-4">
							<p class="text-sm font-medium text-[rgb(var(--color-text))] mb-2">Currently moderating:</p>
							{#if data.forumModAssignments.length === 0}
								<p class="text-sm text-[rgb(var(--color-text-muted))] italic">None</p>
							{:else}
								<div class="space-y-2">
									{#each data.forumModAssignments as assignment}
										<div class="flex items-center justify-between p-2 bg-[rgb(var(--color-bg))] rounded border border-[rgb(var(--color-border))]">
											<span class="text-sm font-medium">{assignment.forumName}</span>
											<form method="POST" action="?/removeForumMod" class="inline">
												<input type="hidden" name="targetDid" value={data.profileUser.did} />
												<input type="hidden" name="forumId" value={assignment.forumId} />
												<button type="submit" class="text-red-600 hover:text-red-700 text-xs underline">
													Remove
												</button>
											</form>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Assign new moderator -->
						<div>
							<p class="text-sm font-medium text-[rgb(var(--color-text))] mb-2">Assign to forum:</p>
							<div class="flex gap-2">
								<select bind:value={forumModSelect} class="form-control text-sm flex-1">
									<option value="">Select a forum...</option>
									{#each data.allForums as forum}
										{#if !data.forumModAssignments.some((a) => a.forumId === forum.id)}
											<option value={forum.id}>{forum.name}</option>
										{/if}
									{/each}
								</select>
								<form
									method="POST"
									action="?/assignForumMod"
									class="inline"
								>
									<input type="hidden" name="targetDid" value={data.profileUser.did} />
									<input type="hidden" name="forumId" value={forumModSelect} />
									<button
										type="submit"
										disabled={!forumModSelect}
										class="btn btn-sm btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Assign
									</button>
								</form>
							</div>
						</div>
					</div>
				{/if}

				<!-- Custom roles -->
				{#if data.allRoles.length > 0}
					<div class="box-secondary">
						<h3 class="font-semibold mb-3">Custom Roles</h3>
						<div class="space-y-2">
							{#each data.allRoles as role}
								<form
									method="POST"
									action={isRoleAssigned(role.id) ? '?/removeCustomRole' : '?/assignCustomRole'}
									class="inline"
								>
									<input type="hidden" name="targetDid" value={data.profileUser.did} />
									<input type="hidden" name="roleId" value={role.id} />
									<button
										type="submit"
										class="badge border px-3 py-1.5 cursor-pointer hover:opacity-80 transition"
										style:background-color={role.color ? role.color + '20' : undefined}
										style:color={role.color || undefined}
									>
										{isRoleAssigned(role.id) ? '✓' : '+'} {role.name}
									</button>
								</form>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
