import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = ({ params }) => {
	// URLs with [titleSlug] are valid and canonical
	// URLs without slug redirect here to add it, for SEO
	// For now, just redirect to threadId (slug is optional)
	// TODO: Fetch thread from DB, verify slug matches, return 404 if mismatch
	throw redirect(301, `/f/${params.forumSlug}/t/${params.threadId}`);
};
