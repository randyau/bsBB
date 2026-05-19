import { getSetting } from '$lib/settings';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const robotsTxt = await getSetting('robots_txt', 'User-agent: *\nDisallow:\n');

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
