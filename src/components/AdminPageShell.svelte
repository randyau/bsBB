<script lang="ts">
	let {
		title,
		form,
		children
	}: {
		title: string;
		form?: { error?: string; success?: string | boolean; [key: string]: unknown } | null;
		children: any;
	} = $props();
</script>

<div class="container mx-auto px-4 py-8 max-w-6xl">
	<div class="space-y-6">
		<h1 class="page-title">{title}</h1>

		{#if form?.error}
			<div class="alert alert-error text-sm" role="alert">
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="alert alert-success text-sm" role="alert">
				{typeof form.success === 'string' ? form.success : 'Action completed successfully.'}
			</div>
		{/if}

		{@render children()}
	</div>
</div>
