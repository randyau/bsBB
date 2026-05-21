<script lang="ts">
	interface Props {
		onEmojiSelect?: (emoji: string) => void;
	}

	const { onEmojiSelect }: Props = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let triggerButton = $state<HTMLButtonElement | null>(null);
	let pickerStyle = $state('');

	const emojiList: [string, string][] = [
		['😀', 'grinning face happy smile'],
		['😃', 'grinning face big eyes happy smile'],
		['😄', 'grinning face smiling eyes happy smile'],
		['😁', 'beaming face smiling eyes grin happy'],
		['😆', 'grinning squinting face laugh happy'],
		['😅', 'grinning face sweat nervous smile'],
		['🤣', 'rolling on floor laughing rofl lol'],
		['😂', 'face with tears of joy cry laugh lol'],
		['🙂', 'slightly smiling face smile'],
		['🙃', 'upside down face smile flip'],
		['😉', 'winking face wink'],
		['😊', 'smiling face blush happy'],
		['😇', 'smiling face halo angel'],
		['🥰', 'smiling face hearts love adore'],
		['😍', 'smiling face heart eyes love'],
		['🤩', 'star struck amazing wow'],
		['😘', 'face blowing kiss love'],
		['😗', 'kissing face'],
		['😚', 'kissing face closed eyes'],
		['😙', 'kissing face smiling eyes'],
		['🥲', 'smiling face tear happy cry'],
		['😋', 'face savoring food yum delicious'],
		['😛', 'face with tongue silly'],
		['😜', 'winking face tongue silly'],
		['🤪', 'zany face crazy silly'],
		['😌', 'relieved face calm peaceful'],
		['😔', 'pensive face sad thoughtful'],
		['😑', 'expressionless face blank'],
		['😐', 'neutral face meh'],
		['😶', 'face without mouth silent'],
		['🙁', 'slightly frowning face sad'],
		['😏', 'smirking face smug'],
		['😣', 'persevering face struggle'],
		['😖', 'confounded face frustrated'],
		['😫', 'tired face exhausted weary'],
		['😩', 'weary face tired'],
		['🥺', 'pleading face puppy eyes sad'],
		['😢', 'crying face sad tear'],
		['😭', 'loudly crying face sob tears'],
		['😤', 'face steam from nose frustrated angry'],
		['😠', 'angry face mad'],
		['😡', 'enraged face rage angry'],
		['🤬', 'face symbols mouth cursing swearing angry'],
		['😈', 'smiling face horns devil evil'],
		['👿', 'angry face horns devil'],
		['💀', 'skull dead bones'],
		['☠️', 'skull crossbones pirate danger'],
		['💩', 'pile of poo poop'],
		['🤡', 'clown face'],
		['👹', 'ogre monster'],
		['👺', 'goblin monster'],
		['👻', 'ghost spooky halloween'],
		['👽', 'alien extraterrestrial space'],
		['👾', 'alien monster game space invader'],
		['🤖', 'robot machine'],
		['😺', 'grinning cat happy'],
		['😸', 'grinning cat smiling eyes'],
		['😹', 'cat with tears of joy laugh'],
		['😻', 'smiling cat heart eyes love'],
		['😼', 'cat wry smile smirk'],
		['😽', 'kissing cat'],
		['🙀', 'weary cat surprised'],
		['😿', 'crying cat sad'],
		['😾', 'pouting cat angry'],
		['❤️', 'red heart love'],
		['🧡', 'orange heart love'],
		['💛', 'yellow heart love'],
		['💚', 'green heart love'],
		['💙', 'blue heart love'],
		['💜', 'purple heart love'],
		['🖤', 'black heart love'],
		['🤍', 'white heart love'],
		['🤎', 'brown heart love'],
		['💔', 'broken heart sad'],
		['💕', 'two hearts love'],
		['💞', 'revolving hearts love'],
		['💓', 'beating heart love'],
		['💗', 'growing heart love'],
		['💖', 'sparkling heart love'],
		['💘', 'heart with arrow love cupid'],
		['✨', 'sparkles magic stars'],
		['⭐', 'star yellow'],
		['🌟', 'glowing star shine'],
		['💫', 'dizzy star spin'],
		['🔥', 'fire hot flame'],
		['👍', 'thumbs up like good'],
		['👎', 'thumbs down dislike bad'],
		['👋', 'waving hand hello bye'],
		['🙏', 'folded hands please thanks prayer'],
		['💪', 'flexed biceps strong muscle'],
		['🤝', 'handshake agreement'],
		['👏', 'clapping hands applause'],
		['🎉', 'party popper celebration congrats'],
		['🎊', 'confetti ball party celebration'],
		['🎈', 'balloon party'],
		['🎁', 'wrapped gift present birthday'],
		['📚', 'books reading study'],
		['📖', 'open book reading'],
		['📝', 'memo note writing'],
		['✏️', 'pencil write edit'],
		['🖊️', 'pen write'],
		['🖋️', 'fountain pen write'],
		['💻', 'laptop computer tech'],
		['⌨️', 'keyboard computer type'],
		['🐶', 'dog puppy pet animal'],
		['🐱', 'cat kitten pet animal'],
		['🐭', 'mouse animal'],
		['🐹', 'hamster pet animal'],
		['🐰', 'rabbit bunny animal'],
		['🦊', 'fox animal'],
		['🐻', 'bear animal'],
		['🐼', 'panda bear animal'],
		['🐨', 'koala animal australia'],
		['🐯', 'tiger animal'],
		['🦁', 'lion animal king'],
		['🐮', 'cow animal farm'],
		['🐷', 'pig animal farm'],
		['🐸', 'frog animal'],
		['🐵', 'monkey animal'],
		['🐔', 'chicken bird animal farm'],
		['🍕', 'pizza food'],
		['🍔', 'hamburger burger food'],
		['🍟', 'french fries food'],
		['🌭', 'hot dog food'],
		['🍿', 'popcorn movie snack food'],
		['🥓', 'bacon food'],
		['🍗', 'poultry leg chicken food'],
		['🍖', 'meat on bone food'],
		['🌮', 'taco food mexican'],
		['🌯', 'burrito wrap food'],
		['🥙', 'stuffed flatbread food'],
		['🧆', 'falafel food'],
		['🍱', 'bento box food japanese'],
		['🍜', 'steaming bowl noodles ramen food'],
		['🍝', 'spaghetti pasta food italian'],
		['🍠', 'roasted sweet potato food'],
		['🍣', 'sushi food japanese'],
		['🍤', 'fried shrimp food'],
		['🥘', 'shallow pan of food paella'],
		['🍲', 'pot of food stew'],
		['🍛', 'curry rice food'],
		['🥗', 'green salad food healthy'],
		['🍳', 'cooking egg frying pan food'],
		['☕', 'hot beverage coffee tea drink'],
		['🍵', 'teacup hot tea drink'],
		['🥤', 'cup with straw drink juice'],
		['🍶', 'sake drink japanese'],
		['🍷', 'wine glass drink alcohol'],
		['🍸', 'cocktail glass drink alcohol'],
		['🍹', 'tropical drink cocktail alcohol'],
		['🍺', 'beer mug drink alcohol'],
		['🍻', 'clinking beer mugs cheers drink alcohol'],
	];

	const commonEmojis = emojiList.map(([emoji]) => emoji);

	const filteredEmojis = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return commonEmojis;
		return emojiList.filter(([, keywords]) => keywords.includes(q) || keywords.split(' ').some(w => w.startsWith(q))).map(([emoji]) => emoji);
	});

	function selectEmoji(emoji: string) {
		onEmojiSelect?.(emoji);
		closePicker();
		triggerButton?.focus();
	}

	function togglePicker() {
		if (!isOpen && triggerButton) {
			const rect = triggerButton.getBoundingClientRect();
			const pickerWidth = 256; // w-64 = 16rem = 256px
			const left = Math.max(4, rect.right - pickerWidth);
			// Prefer above the button; fall back to below if not enough space
			const spaceAbove = rect.top;
			const pickerHeight = 320;
			if (spaceAbove >= pickerHeight) {
				pickerStyle = `position:fixed;bottom:${window.innerHeight - rect.top + 8}px;left:${left}px`;
			} else {
				pickerStyle = `position:fixed;top:${rect.bottom + 8}px;left:${left}px`;
			}
		}
		isOpen = !isOpen;
		if (isOpen) {
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

<div class="relative inline-block">
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
			style={pickerStyle}
			class="z-50 w-64 bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-lg shadow-lg p-3"
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
