import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/markdown/index.js';
import { checkAbuse } from '$lib/abuse/index.js';

export const POST: RequestHandler = async ({ request, getClientAddress, locals }) => {
	const contentType = request.headers.get('content-type') ?? '';
	if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
		return json({ error: 'Invalid Content-Type. Use application/x-www-form-urlencoded or multipart/form-data' }, { status: 415 });
	}

	const ip = getClientAddress();

	const verdict = await checkAbuse({ type: 'preview_request', did: locals.user?.did ?? null, ip });
	if (!verdict.allowed) {
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
