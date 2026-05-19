<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className }: Props = $props();
</script>

<details class="markdown-help {className ?? ''}">
	<summary class="cursor-pointer font-semibold text-sm text-[rgb(var(--color-primary))] hover:underline">
		Markdown Reference
	</summary>
	<div class="mt-3 p-3 bg-[rgb(var(--color-bg-secondary))] rounded border border-[rgb(var(--color-border))] text-sm">
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
			</tbody>
		</table>
	</div>
</details>

<style>
	:global(.markdown-help) {
		width: 100%;
	}

	:global(.markdown-help summary) {
		list-style: none;
	}

	:global(.markdown-help summary::-webkit-details-marker) {
		display: none;
	}

	:global(.markdown-help summary::before) {
		content: '▶ ';
		display: inline-block;
		margin-right: 0.5rem;
		transition: transform 0.2s;
	}

	:global(.markdown-help[open] summary::before) {
		transform: rotate(90deg);
	}
</style>
