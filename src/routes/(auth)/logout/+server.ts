import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { invalidateSession, deleteSessionCookie } from '$lib/auth/session.js';
import { logger as rootLogger } from '$lib/logger.js';

const log = rootLogger.child({ module: 'auth:logout' });

export const GET: RequestHandler = async (event) => {
	const { sessionId } = event.locals;
	if (sessionId) {
		await invalidateSession(sessionId);
	}
	deleteSessionCookie(event);
	log.info({ did: event.locals.user?.did }, 'user logged out');
	redirect(302, '/');
};
