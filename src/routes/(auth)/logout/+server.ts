import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { invalidateSession, deleteSessionCookie } from '$lib/auth/session.js';

export const POST: RequestHandler = async (event) => {
	const { sessionId } = event.locals;
	if (sessionId) {
		await invalidateSession(sessionId);
	}
	deleteSessionCookie(event);
	redirect(302, '/');
};
