<script lang="ts">
	import { enhance } from '$app/forms';
	import Toast from '$components/Toast.svelte';
	import ConfirmModal from '$components/ConfirmModal.svelte';
	import type { PageData, ActionData } from './$types';

	interface Asset {
		id: string;
		slug: string;
		originalFilename: string;
		mimeType: string;
		size: number;
		createdAt: Date;
		url: string;
	}

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let assets: Asset[] = $state([]);
	let isDragging = $state(false);
	let isUploading = $state(false);
	let toastMessage = $state('');
	let toastType: 'success' | 'error' = $state('success');
	let selectedAssetToDelete: string | null = $state(null);
	let renamingSlug: string | null = $state(null);
	let renamingValue: string = $state('');

	$effect(() => {
		assets = data.assets || [];
	});

	$effect(() => {
		if (form) {
			if (form.error) {
				toastMessage = form.error;
				toastType = 'error';
			} else if (form.success) {
				toastMessage = 'Success!';
				toastType = 'success';
				// Refresh assets list after successful action
				if (form.slug) {
					const newAsset = {
						slug: form.slug,
						url: form.url,
						originalFilename: form.filename,
						mimeType: '',
						size: 0,
						createdAt: new Date(),
						id: '',
					};
					assets = [newAsset, ...assets];
				}
			}
		}
	});

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const files = e.dataTransfer?.files;
		if (files?.length) {
			handleFiles(files);
		}
	}

	function handleFiles(fileList: FileList) {
		const file = fileList[0];
		if (file) {
			uploadFile(file);
		}
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			handleFiles(input.files);
		}
	}

	function uploadFile(file: File) {
		isUploading = true;
		const form = new FormData();
		form.append('file', file);

		fetch('?/uploadAsset', {
			method: 'POST',
			body: form,
		})
			.then((r) => r.json())
			.then((result) => {
				isUploading = false;
				if (result.data?.success) {
					toastMessage = `Uploaded: ${file.name}`;
					toastType = 'success';
					// Refresh page to show new asset
					location.reload();
				} else {
					toastMessage = result.data?.error || 'Upload failed';
					toastType = 'error';
				}
			})
			.catch((err) => {
				isUploading = false;
				toastMessage = `Error: ${err.message}`;
				toastType = 'error';
			});
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}

	function getFileIcon(mimeType: string): string {
		if (mimeType.startsWith('image/')) return '🖼️';
		if (mimeType === 'application/pdf') return '📄';
		if (mimeType === 'application/zip') return '📦';
		if (mimeType.includes('archive')) return '📦';
		if (mimeType.startsWith('text/')) return '📝';
		return '📎';
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
		toastMessage = 'Copied to clipboard!';
		toastType = 'success';
	}

	function copyAsMarkdownImage(asset: Asset) {
		copyToClipboard(`![${asset.originalFilename}](asset:${asset.slug})`);
	}

	function copyAsMarkdownLink(asset: Asset) {
		copyToClipboard(`[${asset.originalFilename}](asset:${asset.slug})`);
	}

	function copyAsReference(slug: string) {
		copyToClipboard(slug);
	}

	function startRename(asset: Asset) {
		renamingSlug = asset.slug;
		renamingValue = asset.originalFilename;
	}

	function cancelRename() {
		renamingSlug = null;
		renamingValue = '';
	}

	function confirmRename(slug: string) {
		const formData = new FormData();
		formData.append('slug', slug);
		formData.append('newFilename', renamingValue);

		fetch('?/renameAsset', {
			method: 'POST',
			body: formData,
		})
			.then((r) => r.json())
			.then((result) => {
				if (result.data?.success) {
					const asset = assets.find((a) => a.slug === slug);
					if (asset) {
						asset.originalFilename = renamingValue;
					}
					toastMessage = 'Renamed successfully!';
					toastType = 'success';
					cancelRename();
				} else {
					toastMessage = result.data?.error || 'Rename failed';
					toastType = 'error';
				}
			});
	}

	function confirmDelete(slug: string) {
		const formData = new FormData();
		formData.append('slug', slug);

		fetch('?/deleteAsset', {
			method: 'POST',
			body: formData,
		})
			.then((r) => r.json())
			.then((result) => {
				if (result.data?.success) {
					assets = assets.filter((a) => a.slug !== slug);
					toastMessage = 'Deleted successfully!';
					toastType = 'success';
					selectedAssetToDelete = null;
				} else {
					toastMessage = result.data?.error || 'Delete failed';
					toastType = 'error';
				}
			});
	}
</script>

<Toast message={toastMessage} type={toastType} />

{#if selectedAssetToDelete}
	<ConfirmModal
		title="Delete Asset"
		message="Are you sure you want to delete this asset? This action cannot be undone."
		confirmText="Delete"
		onConfirm={() => confirmDelete(selectedAssetToDelete!)}
		onCancel={() => (selectedAssetToDelete = null)}
		isDangerous={true}
	/>
{/if}

<div class="p-8">
	<h1 class="page-title mb-8">Asset Management</h1>

	<!-- Upload Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">Upload New Asset</h2>

		<div
			class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer"
			class:dragging={isDragging}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
		>
			{#if isUploading}
				<p class="text-[rgb(var(--color-text-muted))]">Uploading...</p>
			{:else}
				<p class="text-lg font-semibold mb-2">Drag and drop files here</p>
				<p class="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
					or click to browse (Max 50 MB, images/PDFs/archives)
				</p>
				<input
					type="file"
					class="hidden"
					id="file-input"
					onchange={handleFileInput}
					disabled={isUploading}
				/>
				<label for="file-input" class="btn btn-primary cursor-pointer" class:opacity-50={isUploading}>
					{isUploading ? 'Uploading...' : 'Choose File'}
				</label>
			{/if}
		</div>
		<p class="text-xs text-[rgb(var(--color-text-muted))] mt-4">
			Supported: Images (JPEG, PNG, GIF, WebP), PDFs, ZIP files, and archives
		</p>
	</section>

	<!-- Assets Table -->
	<section class="card p-6">
		<h2 class="text-xl font-bold mb-6">Uploaded Assets</h2>

		{#if assets.length === 0}
			<div class="text-center py-8">
				<p class="text-[rgb(var(--color-text-secondary))]">No assets uploaded yet</p>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead class="border-b border-[rgb(var(--color-border))]">
						<tr>
							<th class="text-left py-3 px-4 font-semibold">Name</th>
							<th class="text-left py-3 px-4 font-semibold">Size</th>
							<th class="text-left py-3 px-4 font-semibold">Uploaded</th>
							<th class="text-left py-3 px-4 font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each assets as asset (asset.slug)}
							<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-tertiary))]">
								<td class="py-3 px-4">
									<div class="flex items-center gap-2">
										<span>{getFileIcon(asset.mimeType)}</span>
										{#if renamingSlug === asset.slug}
											<input
												type="text"
												class="form-control w-40"
												bind:value={renamingValue}
												onkeydown={(e) => {
													if (e.key === 'Enter') confirmRename(asset.slug);
													if (e.key === 'Escape') cancelRename();
												}}
												autofocus
											/>
										{:else}
											<span class="font-medium">{asset.originalFilename}</span>
										{/if}
									</div>
								</td>
								<td class="py-3 px-4 text-[rgb(var(--color-text-secondary))]">
									{formatBytes(asset.size)}
								</td>
								<td class="py-3 px-4 text-[rgb(var(--color-text-secondary))]">
									{new Date(asset.createdAt).toLocaleDateString()}
								</td>
								<td class="py-3 px-4">
									<div class="flex gap-2 flex-wrap">
										{#if renamingSlug === asset.slug}
											<button
												class="btn btn-sm btn-primary"
												onclick={() => confirmRename(asset.slug)}
											>
												Save
											</button>
											<button class="btn btn-sm" onclick={cancelRename}>
												Cancel
											</button>
										{:else}
											<button
												class="btn btn-sm"
												onclick={() => copyAsReference(asset.slug)}
												title="Copy asset reference"
											>
												Ref
											</button>
											{#if asset.mimeType.startsWith('image/')}
												<button
													class="btn btn-sm"
													onclick={() => copyAsMarkdownImage(asset)}
													title="Copy as markdown image"
												>
													Img
												</button>
											{/if}
											<button
												class="btn btn-sm"
												onclick={() => copyAsMarkdownLink(asset)}
												title="Copy as markdown link"
											>
												Link
											</button>
											<button
												class="btn btn-sm"
												onclick={() => startRename(asset)}
												title="Rename"
											>
												✏️
											</button>
											<button
												class="btn btn-sm btn-danger"
												onclick={() => (selectedAssetToDelete = asset.slug)}
												title="Delete"
											>
												×
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.card {
		background-color: rgb(var(--color-bg-secondary));
		border: 1px solid rgb(var(--color-border));
	}

	.page-title {
		font-size: var(--text-3xl);
		font-weight: bold;
		color: rgb(var(--color-text));
	}

	.dragging {
		@apply bg-[rgb(var(--color-bg-highlight))] border-[rgb(var(--color-primary))];
	}

	.btn-sm {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
	}
</style>
