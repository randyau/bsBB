import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { modLog } from '$lib/db/schema';
import { fail } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';

const MAX_ROWS = 1000;
const QUERY_TIMEOUT_MS = 5000;

export const load: PageServerLoad = async () => {
	return {
		history: []
	};
};

export const actions: Actions = {
	run: async ({ locals, request }) => {
		const form = await request.formData();
		const query = String(form.get('query') ?? '').trim();

		if (!query) {
			return fail(422, { error: 'Query is required' });
		}

		// Validate: must start with SELECT
		const upperQuery = query.toUpperCase();
		if (!upperQuery.startsWith('SELECT')) {
			return fail(422, { error: 'Only SELECT queries are allowed' });
		}

		// Prevent stacked queries (e.g. "SELECT 1; DROP TABLE users;")
		if (query.includes(';') && !/;\s*$/.test(query)) {
			return fail(422, { error: 'Stacked queries are not allowed' });
		}

		try {
			const startTime = Date.now();

			// Execute with timeout
			const result = await Promise.race([
				db.execute(sql.raw(query)),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS))
			]);

			const executionMs = Date.now() - startTime;

			// Cap results at MAX_ROWS
			const rows = (result as any[]).slice(0, MAX_ROWS);
			const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

			// Log query to mod_log
			try {
				await db.insert(modLog).values({
					moderatorDid: locals.user!.did,
					action: 'admin_query',
					reason: query.substring(0, 200)
				});
			} catch (err) {
				console.error('[mod_log error]', err);
			}

			return {
				success: true,
				columns,
				rows,
				rowCount: rows.length,
				executionMs
			};
		} catch (err: any) {
			const message = err?.message || String(err);
			console.error('[query error]', message);
			return fail(500, { error: `Query failed: ${message}` });
		}
	}
};
