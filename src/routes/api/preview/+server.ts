import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/markdown/index.js';
import { checkAbuse } from '$lib/abuse/index.js';

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	const ip = getClientAddress();

	try {
		await checkAbuse({ type: 'preview_request', did: locals.user?.did ?? null, ip });
	} catch {
		return json({ error: 'Preview request rate limited' }, { status: 429 });
	}

	const form = await request.formData();
	const body = String(form.get('body') ?? '').trim();

	if (!body) {
		return json({ html: '' });
	}

	try {
		const html = await renderMarkdown(body);
		return json({ html });
	} catch (err) {
		console.error('[preview error]', err);
		return json({ error: 'Failed to render preview' }, { status: 500 });
	}
};
