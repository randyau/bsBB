import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, getSessionToken } from '$lib/auth/session.js';

function formatHtml(html: string): string {
	if (process.env.NODE_ENV === 'production') return html;

	// Don't format style/script tag contents — preserve them as-is
	const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
	const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);

	let workingHtml = html;
	let styleBlock = '';
	let scriptBlock = '';

	if (styleMatch) {
		styleBlock = styleMatch[0];
		workingHtml = workingHtml.replace(styleBlock, '<!--STYLE_PLACEHOLDER-->');
	}

	if (scriptMatch) {
		scriptBlock = scriptMatch[0];
		workingHtml = workingHtml.replace(scriptBlock, '<!--SCRIPT_PLACEHOLDER-->');
	}

	let indentLevel = 0;
	const indent = '  ';
	let result = '';
	let inTag = false;
	let tagContent = '';

	for (let i = 0; i < workingHtml.length; i++) {
		const char = workingHtml[i];

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

	// Restore style and script blocks
	result = result.replace('<!--STYLE_PLACEHOLDER-->', styleBlock);
	result = result.replace('<!--SCRIPT_PLACEHOLDER-->', scriptBlock);

	return result;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Host header validation (prevents host header injection attacks)
	// Extract hostname without port for comparison
	// Skip validation in dev to avoid blocking different port numbers during testing
	if (process.env.NODE_ENV === 'production') {
		const hostHeader = event.request.headers.get('host') ?? '';
		const hostname = hostHeader.split(':')[0];
		const allowedHosts = (process.env.ALLOWED_HOSTS ?? 'localhost,127.0.0.1').split(',').map(h => h.trim());

		// Only validate if a host header is present
		if (hostname && !allowedHosts.includes(hostname)) {
			return new Response('Invalid host', { status: 400 });
		}
	}

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

	// Security headers: defend against clickjacking, MIME sniffing, and other attacks
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	// Content Security Policy: restrictive by default, allow same-origin assets
	const csp = [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https:",
		"font-src 'self'",
		"connect-src 'self'",
		"frame-ancestors 'none'"
	].join('; ');
	response.headers.set('Content-Security-Policy', csp);

	// HSTS: enforce HTTPS in production
	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	}

	return response;
};
