<script lang="ts">
	import type { PageData } from './$types';
	import type { ActionData } from './$types';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);

	let previewMode: 'write' | 'preview' = $state('write');
	let previewHtml: string = $state('');
	let isLoadingPreview: boolean = $state(false);

	async function handlePreview() {
		const title = (document.querySelector('input[name="title"]') as HTMLInputElement)?.value || '';
		const body = (document.querySelector('textarea[name="body"]') as HTMLTextAreaElement)?.value || '';

		if (!body.trim()) {
			previewHtml = '';
			previewMode = 'preview';
			return;
		}

		isLoadingPreview = true;
		try {
			const formData = new FormData();
			formData.append('body', body);

			const response = await fetch('/api/preview', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) throw new Error('Preview failed');

			const result = await response.json();
			previewHtml = result.html || '';
			previewMode = 'preview';
		} catch (err) {
			console.error('Preview error:', err);
			previewHtml = '<p style="color: red;">Failed to load preview</p>';
		} finally {
			isLoadingPreview = false;
		}
	}
</script>

<div class="space-y-6 py-8">
	<!-- Breadcrumb -->
	<div class="text-sm mb-4">
		<a href="/" class="text-blue-600 hover:underline">Forums</a>
		<span class="text-gray-400"> / </span>
		<a href="/f/{data.forum.slug}" class="text-blue-600 hover:underline">{data.forum.name}</a>
		<span class="text-gray-400"> / </span>
		<span>New Thread</span>
	</div>

	<h1 class="text-3xl font-bold">Create New Thread</h1>

	{#if form?.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
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
				maxlength="300"
				required
				placeholder="What's on your mind?"
				value={form?.title || ''}
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
			/>
			<p class="text-xs text-gray-500 mt-1">1-300 characters</p>
		</div>

		<!-- Body -->
		<div>
			<div class="flex gap-2 mb-2">
				<label for="body" class="block text-sm font-semibold">Body (Markdown)</label>
				<button
					type="button"
					onclick={handlePreview}
					disabled={isLoadingPreview}
					class="text-sm text-blue-600 hover:underline disabled:opacity-50"
				>
					{isLoadingPreview ? 'Loading...' : previewMode === 'write' ? 'Preview' : 'Edit'}
				</button>
			</div>

			{#if previewMode === 'write'}
				<textarea
					id="body"
					name="body"
					maxlength="50000"
					required
					placeholder="Write your message in Markdown..."
					value={form?.body || ''}
					rows="12"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
				/>
			{:else}
				<div
					class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 prose prose-sm max-w-none min-h-[300px]"
				>
					{@html previewHtml}
				</div>
			{/if}

			<p class="text-xs text-gray-500 mt-1">1-50,000 characters, Markdown supported</p>
		</div>

		<!-- Submit -->
		<div class="pt-4">
			<button
				type="submit"
				class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
			>
				Create Thread
			</button>
		</div>
	</form>
</div>
