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
 * Tries tsvector first (whole-word), falls back to trigram (substring) for short queries.
 */
export async function searchPosts(
	query: string,
	limit: number = 20,
	offset: number = 0
): Promise<SearchResult[]> {
	const cleanQuery = query
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
		.join(' & ');

	if (!cleanQuery) {
		return [];
	}

	// For short queries (like "lol"), use trigram for substring matching
	// For longer queries, use tsvector for better relevance
	const isShortQuery = query.length <= 4;

	if (isShortQuery) {
		// Use trigram (pg_trgm) for substring matching on short queries
		const likePattern = `%${query.toLowerCase()}%`;
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
				regexp_replace(substring(p.body_html, 1, 200), '<[^>]*>', '', 'g') as body_preview,
				CASE WHEN LOWER(p.body_html) LIKE ${likePattern} THEN 1 ELSE 0 END as relevance,
				p.created_at
			FROM posts p
			JOIN threads t ON p.thread_id = t.id
			JOIN forums f ON t.forum_id = f.id
			JOIN users u ON p.author_did = u.did
			WHERE LOWER(p.body_html) LIKE ${likePattern}
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
			bodyPreview: (row.body_preview || '').replace(/\s+/g, ' ').trim(),
			relevance: row.relevance || 0,
			createdAt: new Date(row.created_at)
		}));
	} else {
		// Use tsvector for longer queries (better for multi-word searches)
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
				regexp_replace(substring(p.body_html, 1, 200), '<[^>]*>', '', 'g') as body_preview,
				ts_rank(p.body_tsv, plainto_tsquery('english', ${cleanQuery})) as relevance,
				p.created_at
			FROM posts p
			JOIN threads t ON p.thread_id = t.id
			JOIN forums f ON t.forum_id = f.id
			JOIN users u ON p.author_did = u.did
			WHERE p.body_tsv @@ plainto_tsquery('english', ${cleanQuery})
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
			bodyPreview: (row.body_preview || '').replace(/\s+/g, ' ').trim(),
			relevance: row.relevance || 0,
			createdAt: new Date(row.created_at)
		}));
	}
}

/**
 * Get total count of search results.
 */
export async function searchPostsCount(query: string): Promise<number> {
	const cleanQuery = query
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => word.replace(/[^a-zA-Z0-9]/g, ''))
		.join(' & ');

	if (!cleanQuery) {
		return 0;
	}

	const isShortQuery = query.length <= 4;

	if (isShortQuery) {
		const likePattern = `%${query.toLowerCase()}%`;
		const result = await db.execute(
			sql`
			SELECT COUNT(*) as count
			FROM posts p
			WHERE LOWER(p.body_html) LIKE ${likePattern}
				AND p.is_deleted = false
			`
		);

		return (result as any[])[0]?.count || 0;
	} else {
		const result = await db.execute(
			sql`
			SELECT COUNT(*) as count
			FROM posts p
			WHERE p.body_tsv @@ plainto_tsquery('english', ${cleanQuery})
				AND p.is_deleted = false
			`
		);

		return (result as any[])[0]?.count || 0;
	}
}
