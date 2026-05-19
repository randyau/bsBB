<script lang="ts">
	interface Props {
		message: string;
		type?: 'success' | 'error' | 'info';
		autoDismissMs?: number;
	}

	let { message = '', type = 'success', autoDismissMs = 3000 }: Props = $props();

	let isVisible = $state(false);

	function getBgColor() {
		const colors = {
			success: 'bg-[rgb(var(--color-success))]',
			error: 'bg-[rgb(var(--color-error))]',
			info: 'bg-[rgb(var(--color-primary))]',
		};
		return colors[type];
	}

	$effect(() => {
		if (message) {
			isVisible = true;
			const timeout = setTimeout(() => {
				isVisible = false;
			}, autoDismissMs);

			return () => clearTimeout(timeout);
		}
	});
</script>

{#if isVisible && message}
	<div class="fixed top-4 right-4 {getBgColor()} text-white px-4 py-3 rounded-lg shadow-lg max-w-sm z-50 animate-in fade-in slide-in-from-top-2">
		{message}
	</div>
{/if}

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide-in-from-top-2 {
		from {
			transform: translateY(-0.5rem);
		}
		to {
			transform: translateY(0);
		}
	}

	:global(.animate-in) {
		animation: fade-in 0.2s ease-in-out, slide-in-from-top-2 0.2s ease-in-out;
	}
</style>
