import { checkAbuse } from '$lib/abuse/index.js';

export interface LinkMetadata {
	url: string;
	title: string | null;
	description: string | null;
	imageUrl: string | null;
}

export async function fetchLinkMetadata(markdown: string): Promise<LinkMetadata | null> {
	const url = extractBareLineUrl(markdown);
	if (!url) return null;

	try {
		await checkAbuse({ type: 'og_fetch', ip: '' });
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
