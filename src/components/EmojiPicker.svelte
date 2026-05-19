<script lang="ts">
	interface Props {
		onEmojiSelect?: (emoji: string) => void;
	}

	const { onEmojiSelect }: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');

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
		isOpen = false;
		searchQuery = '';
	}

	function togglePicker() {
		isOpen = !isOpen;
	}
</script>

<div class="relative inline-block">
	<button
		type="button"
		onclick={togglePicker}
		class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] text-xl cursor-pointer transition-colors hover:bg-[rgb(var(--color-bg-secondary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
		title="Open emoji picker"
		aria-label="Emoji picker"
	>
		😊
	</button>

	{#if isOpen}
		<div class="absolute bottom-full right-0 mb-2 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-lg shadow-lg z-50 p-3 w-64">
			<!-- Search -->
			<input
				type="text"
				placeholder="Search emojis..."
				bind:value={searchQuery}
				class="w-full px-2 py-1 text-sm border border-[rgb(var(--color-border))] rounded mb-2 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
				autocomplete="off"
			/>

			<!-- Emoji Grid -->
			<div class="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto">
				{#each filteredEmojis as emoji (emoji)}
					<button
						type="button"
						onclick={() => selectEmoji(emoji)}
						class="p-2 text-xl hover:bg-[rgb(var(--color-bg-secondary))] rounded transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-primary))]"
						title={emoji}
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
