<script lang="ts">
	let {
		open = false,
		title,
		onClose,
		children
	}: {
		open: boolean;
		title: string;
		onClose: () => void;
		children: any;
	} = $props();
</script>

{#if open}
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		<div
			role="none"
			class="bg-[rgb(var(--color-bg))] rounded-lg p-6 max-w-sm w-full mx-4 border border-[rgb(var(--color-border))]"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h2 id="modal-title" class="section-title mb-4">{title}</h2>
			{@render children()}
		</div>
	</div>
{/if}
