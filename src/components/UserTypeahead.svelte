<script lang="ts">
	let {
		users,
		onSelect,
		placeholder = 'Search users...'
	}: {
		users: Array<{ did: string; handle: string; displayName?: string }>;
		onSelect: (user: { did: string; handle: string; displayName?: string }) => void;
		placeholder?: string;
	} = $props();

	let searchQuery = $state('');
	let showDropdown = $state(false);

	const filteredUsers = $derived(
		searchQuery.trim()
			? users.filter(
				(u) =>
					u.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
					(u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
			)
			: []
	);

	function selectUser(user: typeof users[0]) {
		onSelect(user);
		searchQuery = '';
		showDropdown = false;
	}
</script>

<div class="relative w-full">
	<input
		type="text"
		bind:value={searchQuery}
		onfocus={() => (showDropdown = true)}
		onblur={() => setTimeout(() => (showDropdown = false), 100)}
		placeholder={placeholder}
		class="form-control w-full"
	/>
	{#if showDropdown && searchQuery && filteredUsers.length > 0}
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
