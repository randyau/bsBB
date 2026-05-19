<script lang="ts">
	import EmojiPicker from './EmojiPicker.svelte';

	interface Props {
		value: string;
		maxlength?: number;
		onEmojiSelect: (emoji: string) => void;
	}

	const { value, maxlength = 50000, onEmojiSelect }: Props = $props();

	let markdownOpen = $state(false);
</script>

<div class="mt-1">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={() => (markdownOpen = !markdownOpen)}
				class="text-sm text-[rgb(var(--color-primary))] hover:underline focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] rounded"
				aria-expanded={markdownOpen}
				aria-controls="markdown-help-panel"
			>
				<span class="inline-block transition-transform duration-200" class:rotate-90={markdownOpen}>▶</span>
				Markdown Reference
			</button>
			<EmojiPicker {onEmojiSelect} />
		</div>
		<p class="text-xs text-[rgb(var(--color-text-muted))]" aria-live="polite" aria-atomic="true">
			{value.length} / {maxlength.toLocaleString()} characters
			{#if value.length > maxlength * 0.9}
				<span class="text-[rgb(var(--color-warning))] font-semibold">(approaching limit)</span>
			{/if}
		</p>
	</div>

	{#if markdownOpen}
		<div
			id="markdown-help-panel"
			class="mt-2 p-3 bg-[rgb(var(--color-bg-secondary))] rounded border border-[rgb(var(--color-border))] text-sm"
		>
			<table class="w-full text-xs">
				<thead>
					<tr>
						<th class="text-left py-1 px-2 font-semibold">Syntax</th>
						<th class="text-left py-1 px-2 font-semibold">Result</th>
					</tr>
				</thead>
				<tbody>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono"># Heading</td>
						<td class="py-1 px-2">Large heading</td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">**bold**</td>
						<td class="py-1 px-2"><strong>bold</strong></td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">*italic*</td>
						<td class="py-1 px-2"><em>italic</em></td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">[link](url)</td>
						<td class="py-1 px-2">Clickable link</td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">![alt](url)</td>
						<td class="py-1 px-2">Embed image</td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">> quote</td>
						<td class="py-1 px-2">Block quote</td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">`code`</td>
						<td class="py-1 px-2"><code>inline code</code></td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">- item</td>
						<td class="py-1 px-2">Bullet list</td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">1. item</td>
						<td class="py-1 px-2">Numbered list</td>
					</tr>
					<tr class="border-t border-[rgb(var(--color-border))]">
						<td class="py-1 px-2 font-mono">:smile:</td>
						<td class="py-1 px-2">😄 Emoji shortcode</td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</div>
