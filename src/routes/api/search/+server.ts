import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchPosts, searchPostsCount } from '$lib/search';

/**
 * GET /api/search?q=keyword&page=1
 *
 * Full-text search across all posts.
 * Returns paginated results with relevance scoring.
 */
export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() || '';
	const pageStr = url.searchParams.get('page') || '1';
	const page = Math.max(1, parseInt(pageStr));

	if (!query || query.length < 2) {
		return json({
			error: 'Query must be at least 2 characters',
			results: [],
			total: 0,
			page: 1,
			pageSize: 20
		},
		{ status: 400 }
		);
	}

	const pageSize = 20;
	const offset = (page - 1) * pageSize;

	try {
		const [results, total] = await Promise.all([
			searchPosts(query, pageSize, offset),
			searchPostsCount(query)
		]);

		return json({
			query,
			results,
			total,
			page,
			pageSize,
			totalPages: Math.ceil(total / pageSize)
		});
	} catch (err) {
		console.error('[search error]', err);
		return json(
			{ error: 'Search failed' },
			{ status: 500 }
		);
	}
};
