import type { RequestHandler } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const GET: RequestHandler = ({ params }) => {
	// Redirect from /f/[forumSlug]/t/[threadId]/[titleSlug] to /f/[forumSlug]/t/[threadId]
	// This strips the cosmetic slug to keep URLs clean
	throw redirect(301, `/f/${params.forumSlug}/t/${params.threadId}`);
};
