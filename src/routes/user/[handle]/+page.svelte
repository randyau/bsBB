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

	function getContrastColor(hexColor: string | null | undefined): string {
		if (!hexColor) return 'rgb(var(--color-text))';
		const hex = hexColor.replace('#', '');
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		// Calculate luminance using standard formula
		const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		// Use white text for dark colors, dark text for light colors
		return luminance > 0.5 ? 'rgb(17, 24, 39)' : 'rgb(243, 244, 246)';
	}

	function confirmBan(): boolean {
		return confirm(
			`Are you sure you want to ban @${data.profileUser.handle}?\n\nThis action prevents them from posting and will be logged.`
		);
	}

	function confirmPromote(): boolean {
		return confirm(
			`Promote @${data.profileUser.handle} to Admin?\n\nThey will gain full moderation powers. This can be reverted.`
		);
	}

	function confirmDemote(): boolean {
		return confirm(
			`Remove admin privileges from @${data.profileUser.handle}?\n\nThey will return to member status.`
		);
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
			<h1 class="page-title mb-1">{data.profileUser.displayName || data.profileUser.handle}</h1>
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
					<span class="badge border-2" style:background-color={role.color || 'rgb(var(--color-bg-secondary))'} style:color={getContrastColor(role.color)} style:border-color={role.color || 'rgb(var(--color-border))'}>
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
				<div class="box-secondary space-y-4">
					<h3 class="subsection-title">Global Role</h3>

					{#if data.profileUser.globalRole === 'banned'}
						<p class="text-sm text-[rgb(var(--color-text-muted))] mb-3">User is currently banned.</p>
						<form method="POST" action="?/unban" class="inline">
							<input type="hidden" name="targetDid" value={data.profileUser.did} />
							<button type="submit" class="btn btn-sm btn-secondary">
								Unban User
							</button>
						</form>
					{:else}
						<form method="POST" action="?/ban" class="space-y-3" onsubmit={confirmBan}>
							<input type="hidden" name="targetDid" value={data.profileUser.did} />
							<div class="form-group">
								<label for="ban-reason" class="form-label">Ban Reason (optional)</label>
								<textarea
									id="ban-reason"
									name="reason"
									placeholder="Explain why this user is being banned..."
									rows="3"
									class="form-control form-textarea"
									bind:value={banReason}
								></textarea>
								<p class="form-hint">This reason will be logged in the moderation log.</p>
							</div>
							<button type="submit" class="btn btn-sm btn-danger">Ban User</button>
						</form>
					{/if}

					<div class="pt-2 border-t border-[rgb(var(--color-border))]">
						{#if data.profileUser.globalRole !== 'admin'}
							<form method="POST" action="?/promote" class="inline" onsubmit={confirmPromote}>
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<button type="submit" class="btn btn-sm btn-primary">
									Promote to Admin
								</button>
							</form>
						{:else}
							<form method="POST" action="?/demote" class="inline" onsubmit={confirmDemote}>
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<button type="submit" class="btn btn-sm btn-secondary">
									Demote from Admin
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Forum moderator assignments -->
				{#if data.allForums.length > 0}
					<div class="box-secondary space-y-4">
						<h3 class="subsection-title">Forum Moderator</h3>

						<!-- Currently moderating -->
						<div>
							<p class="text-sm font-medium text-[rgb(var(--color-text))] mb-2">Currently moderating:</p>
							{#if data.forumModAssignments.length === 0}
								<p class="text-sm text-[rgb(var(--color-text-muted))] italic">None</p>
							{:else}
								<div class="space-y-2">
									{#each data.forumModAssignments as assignment}
										<div class="flex items-center justify-between p-3 bg-[rgb(var(--color-bg))] rounded border border-[rgb(var(--color-border))]">
											<span class="text-sm font-medium">{assignment.forumName}</span>
											<form method="POST" action="?/removeForumMod" class="inline">
												<input type="hidden" name="targetDid" value={data.profileUser.did} />
												<input type="hidden" name="forumId" value={assignment.forumId} />
												<button type="submit" class="text-sm text-[rgb(var(--color-error))] hover:underline font-medium">
													Remove
												</button>
											</form>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Assign new moderator -->
						<div class="border-t border-[rgb(var(--color-border))] pt-4">
							<p class="text-sm font-medium text-[rgb(var(--color-text))] mb-3">Assign to forum:</p>
							<form method="POST" action="?/assignForumMod" class="space-y-3">
								<input type="hidden" name="targetDid" value={data.profileUser.did} />
								<div class="form-group">
									<select name="forumId" bind:value={forumModSelect} class="form-control">
										<option value="">Select a forum...</option>
										{#each data.allForums as forum}
											{#if !data.forumModAssignments.some((a) => a.forumId === forum.id)}
												<option value={forum.id}>{forum.name}</option>
											{/if}
										{/each}
									</select>
								</div>
								<button
									type="submit"
									disabled={!forumModSelect}
									class="btn btn-sm btn-primary"
								>
									Assign Moderator
								</button>
							</form>
						</div>
					</div>
				{/if}

				<!-- Custom roles -->
				{#if data.allRoles.length > 0}
					<div class="box-secondary">
						<h3 class="subsection-title mb-4">Custom Roles</h3>
						<p class="text-sm text-[rgb(var(--color-text-muted))] mb-4">Click to assign or remove roles:</p>
						<div class="flex flex-wrap gap-2">
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
										class="badge border-2 px-3 py-2 cursor-pointer hover:opacity-90 transition font-medium"
										style:background-color={role.color || 'rgb(var(--color-bg-secondary))'}
										style:color={getContrastColor(role.color)}
										style:border-color={role.color || 'rgb(var(--color-border))'}
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
