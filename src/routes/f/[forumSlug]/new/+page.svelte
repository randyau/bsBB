<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { renderMarkdownClient } from '$lib/markdown/client';

	type FormData = (ActionData & { title?: string; body?: string }) | undefined;

	let { data, form }: { data: PageData; form: FormData } = $props();

	let titleValue: string = $state(form?.title || '');
	let bodyValue: string = $state(form?.body || '');
	let previewHtml: string = $state('');

	const TITLE_MAX = 300;
	const BODY_MAX = 50000;

	function updatePreview() {
		previewHtml = renderMarkdownClient(bodyValue);
	}

	$effect(() => {
		updatePreview();
	});
</script>

<div class="space-y-6 py-8">
	<!-- Breadcrumb -->
	<div class="text-sm mb-4">
		<a href="/" class="text-blue-600 hover:underline">Forums</a>
		<span class="text-[rgb(var(--color-text-muted))]"> / </span>
		<a href="/f/{data.forum.slug}" class="text-blue-600 hover:underline">{data.forum.name}</a>
		<span class="text-[rgb(var(--color-text-muted))]"> / </span>
		<span>New Thread</span>
	</div>

	<h1 class="page-title">Create New Thread</h1>

	{#if form?.error}
		<div class="rounded-lg border border-[rgb(var(--color-error))] bg-[rgb(var(--color-bg-secondary))] p-4 text-[rgb(var(--color-error))]">
			<p>{form.error}</p>
		</div>
	{/if}

	<form method="POST" class="space-y-4">
		<!-- Title -->
		<div>
			<label for="title" class="block text-sm font-semibold mb-2">Thread Title</label>
			<input
				type="text"
				id="title"
				name="title"
				maxlength={TITLE_MAX}
				required
				placeholder="What's on your mind?"
				bind:value={titleValue}
				class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
			/>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-1">
				{titleValue.length} / {TITLE_MAX} characters
				{#if titleValue.length >= TITLE_MAX}
					<span class="text-red-600 font-semibold">(at limit)</span>
				{:else if titleValue.length > TITLE_MAX * 0.8}
					<span class="text-amber-600 font-semibold">(approaching limit)</span>
				{/if}
			</p>
		</div>

		<!-- Body -->
		<div>
			<label for="body" class="block text-sm font-semibold mb-2">Body (Markdown)</label>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<!-- Editor -->
				<div>
					<label for="body" class="text-xs text-[rgb(var(--color-text-muted))] font-medium block mb-2">Write</label>
					<textarea
						id="body"
						name="body"
						maxlength={BODY_MAX}
						required
						placeholder="Write your message in Markdown..."
						bind:value={bodyValue}
						rows="12"
						class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] font-mono text-sm"
					></textarea>
					<p class="text-xs text-[rgb(var(--color-text-muted))] mt-1">
						{bodyValue.length} / {BODY_MAX} characters
						{#if bodyValue.length >= BODY_MAX}
							<span class="text-red-600 font-semibold">(at limit)</span>
						{:else if bodyValue.length > BODY_MAX * 0.8}
							<span class="text-amber-600 font-semibold">(approaching limit)</span>
						{/if}
					</p>
				</div>

				<!-- Live Preview -->
				<div>
					<p class="text-xs text-[rgb(var(--color-text-muted))] font-medium mb-2">Preview</p>
					<div
						class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg bg-[rgb(var(--color-bg-secondary))] max-w-none min-h-[300px] overflow-auto prose-content"
					>
						{#if bodyValue.trim()}
							{@html previewHtml}
						{:else}
							<p class="text-[rgb(var(--color-text-muted))]">Preview appears here...</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Submit -->
		<div class="pt-4">
			{#if titleValue.length === 0}
				<p class="text-sm text-red-600 mb-2">Title is required</p>
			{:else if titleValue.length > TITLE_MAX}
				<p class="text-sm text-red-600 mb-2">Title exceeds {TITLE_MAX} character limit</p>
			{:else if bodyValue.length === 0}
				<p class="text-sm text-red-600 mb-2">Body is required</p>
			{:else if bodyValue.length > BODY_MAX}
				<p class="text-sm text-red-600 mb-2">Body exceeds {BODY_MAX} character limit</p>
			{/if}
			<button
				type="submit"
				disabled={titleValue.length === 0 || titleValue.length > TITLE_MAX || bodyValue.length === 0 || bodyValue.length > BODY_MAX}
				class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Create Thread
			</button>
		</div>
	</form>
</div>
