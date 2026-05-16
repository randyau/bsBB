/**
 * Full-text search helpers using PostgreSQL tsvector.
 */

import { db } from './db';
import { posts, threads, forums, users } from './db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface SearchResult {
	postId: string;
	threadId: string;
	threadTitle: string;
	threadSlug: string;
	forumSlug: string;
	authorHandle: string;
	authorDid: string;
	bodyPreview: string;
	relevance: number;
	createdAt: Date;
}

/**
 * Search posts by full-text query.
 * Uses PostgreSQL tsvector & tsquery.
 */
export async function searchPosts(
	query: string,
	limit: number = 20,
	offset: number = 0
): Promise<SearchResult[]> {
	// Convert query to tsquery format (simple plainto_tsquery)
	const searchQuery = query
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
		.join(' & ');

	if (!searchQuery) {
		return [];
	}

	// Raw SQL search using tsvector
	const results = await db.execute(
		sql`
		SELECT
			p.id as post_id,
			p.thread_id,
			t.title as thread_title,
			t.slug as thread_slug,
			f.slug as forum_slug,
			u.handle as author_handle,
			u.did as author_did,
			substring(p.body_html, 1, 200) as body_preview,
			ts_rank(p.body_tsv, plainto_tsquery('english', ${searchQuery})) as relevance,
			p.created_at
		FROM posts p
		JOIN threads t ON p.thread_id = t.id
		JOIN forums f ON t.forum_id = f.id
		JOIN users u ON p.author_did = u.did
		WHERE p.body_tsv @@ plainto_tsquery('english', ${searchQuery})
			AND p.is_deleted = false
		ORDER BY relevance DESC, p.created_at DESC
		LIMIT ${limit} OFFSET ${offset}
		`
	);

	return (results as any[]).map((row) => ({
		postId: row.post_id,
		threadId: row.thread_id,
		threadTitle: row.thread_title,
		threadSlug: row.thread_slug,
		forumSlug: row.forum_slug,
		authorHandle: row.author_handle,
		authorDid: row.author_did,
		bodyPreview: row.body_preview?.replace(/<[^>]*>/g, '') || '',
		relevance: row.relevance || 0,
		createdAt: new Date(row.created_at)
	}));
}

/**
 * Get total count of search results.
 */
export async function searchPostsCount(query: string): Promise<number> {
	const searchQuery = query
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
		.join(' & ');

	if (!searchQuery) {
		return 0;
	}

	const result = await db.execute(
		sql`
		SELECT COUNT(*) as count
		FROM posts p
		WHERE p.body_tsv @@ plainto_tsquery('english', ${searchQuery})
			AND p.is_deleted = false
		`
	);

	return (result as any[])[0]?.count || 0;
}
