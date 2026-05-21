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

// Slugs may contain a dot-separated extension, e.g. "my-logo-abc123.jpg"
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9\-]*(\.[a-z0-9]+)?$/;

export function generateAssetSlug(filename: string): string {
	const extMatch = filename.match(/\.[a-z0-9]+$/i);
	const ext = extMatch ? extMatch[0].toLowerCase() : '';
	const basename = extMatch ? filename.slice(0, -extMatch[0].length) : filename;

	const sanitized = basename
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50);

	if (!sanitized) {
		return `asset-${Math.random().toString(36).slice(2, 9)}${ext}`;
	}

	const timestamp = Date.now().toString(36).slice(-6);
	return `${sanitized}-${timestamp}${ext}`;
}

export function resolveAssetReferences(text: string): string {
	return text.replace(/asset:([a-z0-9][a-z0-9\-]*(\.[a-z0-9]+)?)/gi, '/assets/$1');
}

export function canAccessAssets(user: AssetUser | null): boolean {
	return user !== null && user.globalRole === 'admin';
}

export function getAssetUrl(slug: string): string {
	return `/assets/${slug}`;
}
