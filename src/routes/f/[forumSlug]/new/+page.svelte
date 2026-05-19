<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { renderMarkdownClient } from '$lib/markdown/client';
	import Breadcrumb from '$components/Breadcrumb.svelte';
	import MarkdownHelp from '$components/MarkdownHelp.svelte';
	import EmojiPicker from '$components/EmojiPicker.svelte';

	type FormData = (ActionData & { title?: string; body?: string }) | undefined;

	let { data, form }: { data: PageData; form: FormData } = $props();

	let titleValue: string = $state('');
	let bodyValue: string = $state('');
	$effect(() => { titleValue = form?.title || ''; bodyValue = form?.body || ''; });
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
	<Breadcrumb crumbs={[{ label: 'Forums', href: '/' }, { label: data.forum.name, href: `/f/${data.forum.slug}` }, { label: 'New Thread' }]} />

	<h1 class="page-title">Create New Thread</h1>

	{#if form?.error}
		<div class="alert alert-error">
			<p>{form.error}</p>
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-6">
		<!-- Title -->
		<div class="form-group">
			<label for="title" class="form-label">
				Thread Title
				<span class="form-required">*</span>
			</label>
			<input
				type="text"
				id="title"
				name="title"
				maxlength={TITLE_MAX}
				required
				placeholder="What's on your mind?"
				bind:value={titleValue}
				class="form-control"
			/>
			<div class="form-hint">
				{titleValue.length} / {TITLE_MAX} characters
				{#if titleValue.length >= TITLE_MAX}
					<span class="text-[rgb(var(--color-error))] font-semibold">(at limit)</span>
				{:else if titleValue.length > TITLE_MAX * 0.8}
					<span class="text-[rgb(var(--color-warning))] font-semibold">(approaching limit)</span>
				{/if}
			</div>
		</div>

		<!-- Body -->
		<div class="form-group">
			<label for="body" class="form-label">
				Body (Markdown)
				<span class="form-required">*</span>
			</label>
			<MarkdownHelp class="mb-3" />

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
				<!-- Editor -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<p class="text-xs text-[rgb(var(--color-text-muted))] font-medium m-0">Write</p>
						<EmojiPicker onEmojiSelect={(emoji) => bodyValue += emoji} />
					</div>
					<textarea
						id="body"
						name="body"
						maxlength={BODY_MAX}
						required
						placeholder="Write your message in Markdown..."
						bind:value={bodyValue}
						rows="12"
						class="form-control form-textarea"
					></textarea>
					<div class="form-hint">
						{bodyValue.length} / {BODY_MAX} characters
						{#if bodyValue.length >= BODY_MAX}
							<span class="text-[rgb(var(--color-error))] font-semibold">(at limit)</span>
						{:else if bodyValue.length > BODY_MAX * 0.8}
							<span class="text-[rgb(var(--color-warning))] font-semibold">(approaching limit)</span>
						{/if}
					</div>
				</div>

				<!-- Live Preview -->
				<div>
					<p class="text-xs text-[rgb(var(--color-text-muted))] font-medium mb-2">Preview</p>
					<div
						class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded bg-[rgb(var(--color-bg-secondary))] max-w-none min-h-[300px] overflow-auto prose-content"
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
				<p class="form-error mb-3">Title is required</p>
			{:else if titleValue.length > TITLE_MAX}
				<p class="form-error mb-3">Title exceeds {TITLE_MAX} character limit</p>
			{:else if bodyValue.length === 0}
				<p class="form-error mb-3">Body is required</p>
			{:else if bodyValue.length > BODY_MAX}
				<p class="form-error mb-3">Body exceeds {BODY_MAX} character limit</p>
			{/if}
			<button
				type="submit"
				disabled={titleValue.length === 0 || titleValue.length > TITLE_MAX || bodyValue.length === 0 || bodyValue.length > BODY_MAX}
				class="btn btn-primary"
			>
				Create Thread
			</button>
		</div>
	</form>
</div>
