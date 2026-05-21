<script lang="ts">

	interface Asset {
		id: string;
		slug: string;
		originalFilename: string;
		mimeType: string;
		size: number;
		createdAt: Date;
		url: string;
	}

	interface Props {
		onSelect: (reference: string) => void;
		isOpen: boolean;
		onClose: () => void;
	}

	let { onSelect, isOpen, onClose }: Props = $props();

	let assets: Asset[] = $state([]);
	let filteredAssets: Asset[] = $state([]);
	let searchQuery = $state('');
	let isLoading = $state(false);
	let error = $state('');

	$effect(() => {
		if (isOpen && assets.length === 0) {
			loadAssets();
		}
	});

	$effect(() => {
		if (searchQuery) {
			filteredAssets = assets.filter(
				(a) =>
					a.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
					a.slug.toLowerCase().includes(searchQuery.toLowerCase())
			);
		} else {
			filteredAssets = assets;
		}
	});

	async function loadAssets() {
		isLoading = true;
		error = '';

		try {
			const response = await fetch('/admin/assets/data.json');
			if (!response.ok) throw new Error('Failed to load assets');
			assets = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load assets';
		} finally {
			isLoading = false;
		}
	}

	function selectAsset(slug: string, filename: string, mimeType: string) {
		// Insert as markdown image for images, markdown link for others
		if (mimeType.startsWith('image/')) {
			onSelect(`![${filename}](asset:${slug})`);
		} else {
			onSelect(`[${filename}](asset:${slug})`);
		}
		onClose();
	}

	function getFileIcon(mimeType: string): string {
		if (mimeType.startsWith('image/')) return '🖼️';
		if (mimeType === 'application/pdf') return '📄';
		if (mimeType === 'application/zip') return '📦';
		if (mimeType.includes('archive')) return '📦';
		if (mimeType.startsWith('text/')) return '📝';
		return '📎';
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}
</script>

{#if isOpen}
	<div class="modal-overlay" onclick={onClose}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2 class="text-xl font-bold">Insert Asset</h2>
				<button class="modal-close" onclick={onClose}>×</button>
			</div>

			<div class="modal-body">
				<div class="mb-4">
					<input
						type="text"
						class="form-control w-full"
						placeholder="Search assets..."
						bind:value={searchQuery}
					/>
				</div>

				{#if isLoading}
					<div class="text-center py-8">
						<p class="text-[rgb(var(--color-text-muted))]">Loading assets...</p>
					</div>
				{:else if error}
					<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
						{error}
					</div>
				{:else if filteredAssets.length === 0}
					<div class="text-center py-8">
						<p class="text-[rgb(var(--color-text-secondary))]">
							{searchQuery ? 'No matching assets found' : 'No assets uploaded yet'}
						</p>
					</div>
				{:else}
					<div class="asset-grid">
						{#each filteredAssets as asset (asset.slug)}
							<button
								class="asset-item"
								onclick={() => selectAsset(asset.slug, asset.originalFilename, asset.mimeType)}
								title={asset.originalFilename}
							>
								{#if asset.mimeType.startsWith('image/')}
									<img src={asset.url} alt="" class="asset-thumb" loading="lazy" />
								{:else}
									<div class="asset-icon" aria-hidden="true">{getFileIcon(asset.mimeType)}</div>
								{/if}
								<div class="asset-info">
									<div class="asset-name">{asset.originalFilename}</div>
									<div class="asset-meta">{formatBytes(asset.size)}</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn" onclick={onClose}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal-content {
		background: rgb(var(--color-bg-primary));
		border: 1px solid rgb(var(--color-border));
		border-radius: 8px;
		max-width: 600px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid rgb(var(--color-border));
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		cursor: pointer;
		color: rgb(var(--color-text));
		padding: 0;
		width: 2.5rem;
		height: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.modal-close:hover {
		background-color: rgb(var(--color-bg-secondary));
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.modal-footer {
		padding: 1.5rem;
		border-top: 1px solid rgb(var(--color-border));
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.asset-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 1rem;
	}

	.asset-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px solid rgb(var(--color-border));
		border-radius: 6px;
		background: rgb(var(--color-bg-secondary));
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.asset-item:hover {
		border-color: rgb(var(--color-primary));
		background: rgb(var(--color-bg-highlight));
		transform: translateY(-2px);
	}

	.asset-icon {
		font-size: 2rem;
	}

	.asset-thumb {
		width: 3rem;
		height: 3rem;
		object-fit: cover;
		border-radius: 4px;
		border: 1px solid rgb(var(--color-border));
	}

	.asset-info {
		min-width: 0;
	}

	.asset-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: rgb(var(--color-text));
		word-break: break-word;
	}

	.asset-meta {
		font-size: 0.75rem;
		color: rgb(var(--color-text-muted));
		margin-top: 0.25rem;
	}
</style>
