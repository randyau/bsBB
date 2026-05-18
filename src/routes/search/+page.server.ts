import type { PageServerLoad } from './$types';
import { searchPosts, searchPostsCount, type SearchResult } from '$lib/search';

export const load: PageServerLoad = async ({ url }) => {
	const rawQuery = url.searchParams.get('q')?.trim() || '';
	const pageStr = url.searchParams.get('page') || '1';
	const page = Math.max(1, parseInt(pageStr));

	// Parse author: filter from query (e.g., "author:alice.bsky.social some keywords")
	const authorMatch = rawQuery.match(/\bauthor:(\S+)/i);
	const authorFilter = authorMatch ? authorMatch[1] : '';
	const contentQuery = rawQuery.replace(/\bauthor:\S+/gi, '').trim();

	let results: SearchResult[] = [];
	let total = 0;
	let error = '';

	const hasSearchTerm = contentQuery.length > 0 || authorFilter.length > 0;

	if (hasSearchTerm) {
		if (contentQuery && contentQuery.length < 2) {
			error = 'Query must be at least 2 characters';
		} else {
			try {
				[results, total] = await Promise.all([
					searchPosts(contentQuery, 20, (page - 1) * 20, authorFilter || undefined),
					searchPostsCount(contentQuery, authorFilter || undefined)
				]);
			} catch (err) {
				console.error('[search error]', err);
				error = 'Search failed';
			}
		}
	}

	return {
		query: rawQuery,
		contentQuery,
		authorFilter,
		results,
		total,
		page,
		pageSize: 20,
		totalPages: Math.ceil(total / 20),
		error
	};
};
