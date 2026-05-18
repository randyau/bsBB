import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, getSessionToken } from '$lib/auth/session.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Host header validation — production only to avoid blocking dev port numbers
	if (process.env.NODE_ENV === 'production') {
		if (!process.env.ALLOWED_HOSTS) {
			console.error('[startup] ALLOWED_HOSTS is not set. All requests will be rejected. Set ALLOWED_HOSTS to your domain (e.g. yourforum.com).');
		}
		const hostHeader = event.request.headers.get('host') ?? '';
		const hostname = hostHeader.split(':')[0];
		const allowedHosts = (process.env.ALLOWED_HOSTS ?? '').split(',').map(h => h.trim()).filter(Boolean);

		if (!allowedHosts.includes(hostname)) {
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
			event.cookies.delete('session', { path: '/' });
			event.locals.user = null;
			event.locals.sessionId = null;
		}
	} else {
		event.locals.user = null;
		event.locals.sessionId = null;
	}

	// Banned user block — except /banned and /logout
	const { pathname } = event.url;
	if (
		event.locals.user?.globalRole === 'banned' &&
		pathname !== '/banned' &&
		!pathname.startsWith('/logout')
	) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Your account has been banned.' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		redirect(302, '/banned');
	}

	const response = await resolve(event);

	// Security headers
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	// CSP is declared in svelte.config.js kit.csp — SvelteKit generates the header
	// with per-request nonces applied to its own inline scripts automatically.

	// HSTS: enforce HTTPS in production
	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	}

	return response;
};
