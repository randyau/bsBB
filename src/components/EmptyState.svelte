<script lang="ts">
	let { message, children }: { message: string; children?: any } = $props();
</script>

<div class="box-secondary text-center py-8 text-[rgb(var(--color-text-muted))]">
	<p class="text-sm mb-4">{message}</p>
	{#if children}
		<div>
			{@render children()}
		</div>
	{/if}
</div>
