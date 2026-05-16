<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6 py-8">
	{#if data.flashAdmin}
		<div class="rounded-lg border border-[rgb(var(--color-success))] bg-[rgb(var(--color-bg-secondary))] p-4 text-[rgb(var(--color-success))]">
			<p class="font-semibold">Welcome, Admin!</p>
			<p class="text-sm">You are the first user to log in. Your account has been promoted to admin. This can only happen once.</p>
		</div>
	{/if}

	<div>
		<h1 class="text-3xl font-bold">Forums</h1>
		<p class="mt-2 text-[rgb(var(--color-text-secondary))]">
			{#if data.user}
				<span>Logged in as <strong>{data.user.handle}</strong></span>
			{:else}
				<span><a href="/login" class="text-[rgb(var(--color-primary))] hover:underline">Sign in</a> to post</span>
			{/if}
		</p>
	</div>

	{#if data.forums.length === 0}
		<div class="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg-secondary))] p-6 text-center text-[rgb(var(--color-text-muted))]">
			<p>No forums available for you to view.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.forums as forum (forum.id)}
				<div class="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] p-6 hover:shadow-md transition">
					<div class="flex items-start justify-between gap-4">
						<div class="flex-1">
							<h2 class="text-xl font-semibold">
								<a href="/f/{forum.slug}" class="text-[rgb(var(--color-primary))] hover:underline">
									{forum.name}
								</a>
							</h2>
							{#if forum.description}
								<p class="mt-1 text-[rgb(var(--color-text-secondary))]">{forum.description}</p>
							{/if}
						</div>
						<div class="text-right text-sm text-[rgb(var(--color-text-muted))]">
							<p><strong>{forum.threadCount}</strong> thread{forum.threadCount !== 1 ? 's' : ''}</p>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
