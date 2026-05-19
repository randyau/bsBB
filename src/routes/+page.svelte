<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function stripHtml(html: string, maxLength = 200): string {
		const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
		return stripped.length > maxLength ? stripped.slice(0, maxLength - 1) + '…' : stripped;
	}

	const pageDescription = data.announcementHtml
		? stripHtml(data.announcementHtml)
		: 'A community forum powered by Bluesky identity.';
	const pageUrl = data.baseUrl + '/';
</script>

<svelte:head>
	<title>{data.siteName}</title>
	<meta name="description" content={pageDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={data.siteName} />
	<meta property="og:title" content={data.siteName} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={pageUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={data.siteName} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="space-y-6 py-8">
	{#if data.flashAdmin}
		<div class="alert alert-success">
			<p class="font-semibold">Welcome, Admin!</p>
			<p class="text-sm">You are the first user to log in. Your account has been promoted to admin. This can only happen once.</p>
		</div>
	{/if}

	{#if data.announcementHtml}
		<div class="box border-l-4 border-[rgb(var(--color-primary))]">
			<div class="prose-content">
				{@html data.announcementHtml}
			</div>
		</div>
	{/if}

	<div>
		<h1 class="page-title">Forums</h1>
		<p class="mt-2 text-[rgb(var(--color-text-secondary))]">
			{#if data.user}
				<span>Logged in as <strong>{data.user.handle}</strong></span>
			{:else}
				<span><a href="/login" class="text-[rgb(var(--color-primary))] hover:underline">Sign in</a> to post</span>
			{/if}
		</p>
	</div>

	{#if data.forums.length === 0}
		<div class="card-secondary text-center text-[rgb(var(--color-text-muted))]">
			<p>No forums available for you to view.</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each data.forums as forum (forum.id)}
				<div class="box hover:shadow-md transition">
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
