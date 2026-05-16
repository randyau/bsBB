import type { PageServerLoad } from './$types';
import { searchPosts, searchPostsCount, type SearchResult } from '$lib/search';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() || '';
	const pageStr = url.searchParams.get('page') || '1';
	const page = Math.max(1, parseInt(pageStr));

	let results: SearchResult[] = [];
	let total = 0;
	let error = '';

	if (query) {
		if (query.length < 2) {
			error = 'Query must be at least 2 characters';
		} else {
			try {
				[results, total] = await Promise.all([
					searchPosts(query, 20, (page - 1) * 20),
					searchPostsCount(query)
				]);
			} catch (err) {
				console.error('[search error]', err);
				error = 'Search failed';
			}
		}
	}

	return {
		query,
		results,
		total,
		page,
		pageSize: 20,
		totalPages: Math.ceil(total / 20),
		error
	};
};
