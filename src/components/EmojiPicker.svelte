<script lang="ts">
	interface Props {
		onEmojiSelect?: (emoji: string) => void;
	}

	const { onEmojiSelect }: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let triggerButton = $state<HTMLButtonElement | null>(null);

	const commonEmojis = [
		'😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
		'🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
		'😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
		'🤪', '😌', '😔', '😑', '😐', '😶', '🙁', '😏',
		'😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
		'😠', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩',
		'🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺',
		'😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
		'❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
		'🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘',
		'✨', '⭐', '🌟', '💫', '🔥', '👍', '👎', '👋',
		'🙏', '💪', '🤝', '👏', '🎉', '🎊', '🎈', '🎁',
		'📚', '📖', '📝', '✏️', '🖊️', '🖋️', '💻', '⌨️',
		'🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
		'🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
		'🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🍗', '🍖',
		'🌮', '🌯', '🥙', '🧆', '🍱', '🍜', '🍝', '🍠',
		'🍣', '🍤', '🥘', '🍲', '🍛', '🍣', '🍳', '☕',
		'🍵', '🥤', '🍶', '🍷', '🍸', '🍹', '🍺', '🍻'
	];

	const filteredEmojis = $derived.by(() => {
		if (!searchQuery.trim()) return commonEmojis;
		// Simple filter - just show all emojis on search (no emoji names db)
		return commonEmojis;
	});

	function selectEmoji(emoji: string) {
		onEmojiSelect?.(emoji);
		closePicker();
		triggerButton?.focus();
	}

	function togglePicker() {
		isOpen = !isOpen;
		if (isOpen) {
			// Focus search input after DOM updates
			setTimeout(() => searchInput?.focus(), 0);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			closePicker();
			triggerButton?.focus();
		}
	}

	function closePicker() {
		isOpen = false;
		searchQuery = '';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative inline-block emoji-picker-root">
	<button
		type="button"
		bind:this={triggerButton}
		onclick={togglePicker}
		class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] text-xl cursor-pointer transition-colors hover:bg-[rgb(var(--color-bg-secondary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
		aria-label="Insert emoji"
		aria-haspopup="dialog"
		aria-expanded={isOpen}
	>
		😊
	</button>

	{#if isOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={closePicker} aria-hidden="true"></div>
		<div
			role="dialog"
			aria-label="Emoji picker"
			aria-modal="true"
			class="absolute bottom-full right-0 mb-2 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-lg shadow-lg z-50 p-3 w-64"
		>
			<!-- Search -->
			<input
				type="text"
				placeholder="Search emojis..."
				bind:value={searchQuery}
				bind:this={searchInput}
				class="w-full px-2 py-1 text-sm border border-[rgb(var(--color-border))] rounded mb-2 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
				aria-label="Search emojis"
				autocomplete="off"
			/>

			<!-- Emoji Grid -->
			<div class="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto" aria-label="Emoji list">
				{#each filteredEmojis as emoji (emoji)}
					<button
						type="button"
						onclick={() => selectEmoji(emoji)}
						class="p-2 text-xl hover:bg-[rgb(var(--color-bg-secondary))] rounded transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
						aria-label={emoji}
					>
						{emoji}
					</button>
				{/each}
			</div>

			<!-- No results -->
			{#if filteredEmojis.length === 0}
				<p class="text-center text-sm text-[rgb(var(--color-text-muted))] py-4">
					No emojis found
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Hide emoji picker on mobile (under 640px) */
	@media (max-width: 640px) {
		:global(.emoji-picker-desktop-only) {
			display: none;
		}
	}
</style>
