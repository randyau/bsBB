import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, getSessionToken } from '$lib/auth/session.js';

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

	return resolve(event);
};
