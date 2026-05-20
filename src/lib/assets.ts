export interface AdminAsset {
	id: string;
	slug: string;
	originalFilename: string;
	mimeType: string;
	size: number;
	uploadedByDid: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface AssetUploadResult {
	slug: string;
	url: string;
	filename: string;
	error?: string;
}

export interface AssetUser {
	globalRole: 'admin' | 'moderator' | 'member' | 'banned';
}

export function generateAssetSlug(filename: string): string {
	const basename = filename.split('.')[0];
	const sanitized = basename
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50);

	if (!sanitized) {
		return `asset-${Math.random().toString(36).slice(2, 9)}`;
	}

	const timestamp = Date.now().toString(36).slice(-6);
	return `${sanitized}-${timestamp}`;
}

export function resolveAssetReferences(text: string): string {
	return text.replace(/asset:([a-z0-9\-]+)/gi, '/assets/$1');
}

export function canAccessAssets(user: AssetUser | null): boolean {
	return user !== null && user.globalRole === 'admin';
}

export function getAssetUrl(slug: string): string {
	return `/assets/${slug}`;
}
