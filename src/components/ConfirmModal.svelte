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

	let dialogEl: HTMLDivElement | undefined = $state();

	const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	function getFocusable(): HTMLElement[] {
		if (!dialogEl) return [];
		return Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE));
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
			return;
		}
		if (e.key === 'Tab') {
			const focusable = getFocusable();
			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey) {
				if (document.activeElement === first) {
					e.preventDefault();
					last.focus();
				}
			} else {
				if (document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}
	}

	$effect(() => {
		if (open && dialogEl) {
			const focusable = getFocusable();
			if (focusable.length > 0) {
				focusable[0].focus();
			} else {
				dialogEl.focus();
			}
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		onclick={onClose}
		onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
		role="none"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			tabindex="-1"
			bind:this={dialogEl}
			class="bg-[rgb(var(--color-bg))] rounded-lg p-6 max-w-sm w-full mx-4 border border-[rgb(var(--color-border))]"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleKeydown}
		>
			<h2 id="modal-title" class="section-title mb-4">{title}</h2>
			{@render children()}
		</div>
	</div>
{/if}
