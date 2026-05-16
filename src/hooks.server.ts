import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, getSessionToken } from '$lib/auth/session.js';

function formatHtml(html: string): string {
	if (process.env.NODE_ENV === 'production') return html;

	let indentLevel = 0;
	const indent = '  ';
	let result = '';
	let inTag = false;
	let tagContent = '';

	for (let i = 0; i < html.length; i++) {
		const char = html[i];

		if (char === '<') {
			if (tagContent.trim()) {
				result += indent.repeat(indentLevel) + tagContent.trim() + '\n';
				tagContent = '';
			}
			inTag = true;
		}

		if (inTag) {
			tagContent += char;

			if (char === '>') {
				inTag = false;
				const tag = tagContent.trim();

				// Self-closing tags, void elements, or comments
				if (tag.endsWith('/>') || /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)/.test(tag) || tag.startsWith('<!--')) {
					result += indent.repeat(indentLevel) + tag + '\n';
				}
				// Closing tags
				else if (tag.startsWith('</')) {
					indentLevel = Math.max(0, indentLevel - 1);
					result += indent.repeat(indentLevel) + tag + '\n';
				}
				// Opening tags
				else {
					result += indent.repeat(indentLevel) + tag + '\n';
					if (!tag.includes('/>')) {
						indentLevel++;
					}
				}
				tagContent = '';
			}
		} else if (!inTag && char.trim()) {
			tagContent += char;
		}
	}

	if (tagContent.trim()) {
		result += indent.repeat(indentLevel) + tagContent.trim() + '\n';
	}

	return result;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Session hydration
	const token = getSessionToken(event);
	if (token) {
		const result = await validateSession(token);
		if (result) {
			event.locals.user = result.user;
			event.locals.sessionId = result.sessionId;
		} else {
			// Invalid/expired token — clear the cookie
			event.cookies.delete('session', { path: '/' });
			event.locals.user = null;
			event.locals.sessionId = null;
		}
	} else {
		event.locals.user = null;
		event.locals.sessionId = null;
	}

	// Banned user redirect — except /banned and /logout
	const { pathname } = event.url;
	if (
		event.locals.user?.globalRole === 'banned' &&
		pathname !== '/banned' &&
		!pathname.startsWith('/logout')
	) {
		redirect(302, '/banned');
	}

	const response = await resolve(event, {
		transformPageChunk({ html }) {
			return formatHtml(html);
		}
	});

	return response;
};
