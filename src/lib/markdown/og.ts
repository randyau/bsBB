import { checkAbuse } from '$lib/abuse/index.js';

export interface LinkMetadata {
	url: string;
	title: string | null;
	description: string | null;
	imageUrl: string | null;
}

// Block requests to private/loopback addresses to prevent SSRF attacks.
function isPrivateAddress(urlStr: string): boolean {
	try {
		const { hostname } = new URL(urlStr);
		return /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fe80:|fc00:|fd[0-9a-f]{2}:)/i.test(
			hostname
		);
	} catch {
		return true; // malformed URL — treat as private
	}
}

export async function fetchLinkMetadata(
	markdown: string,
	ip?: string
): Promise<LinkMetadata | null> {
	const url = extractBareLineUrl(markdown);
	if (!url) return null;

	if (isPrivateAddress(url)) return null;

	try {
		await checkAbuse({ type: 'og_fetch', ip: ip ?? '' });
	} catch {
		return null;
	}

	try {
		const ogs = await import('open-graph-scraper');
		const { result } = await ogs.default({ url, timeout: 5000 });

		return {
			url: result.requestUrl || url,
			title: result.ogTitle || null,
			description: result.ogDescription || null,
			imageUrl: result.ogImage?.[0]?.url || null,
		};
	} catch {
		return null;
	}
}

function extractBareLineUrl(markdown: string): string | null {
	const lines = markdown.split('\n');

	for (const line of lines) {
		const trimmed = line.trim();
		if (/^https?:\/\/\S+$/.test(trimmed)) {
			return trimmed;
		}
	}

	return null;
}
