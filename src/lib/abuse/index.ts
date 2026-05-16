import { db } from '$lib/db';
import { sql } from 'drizzle-orm';

// All call sites must use this function; no inline rate-limit checks anywhere else.

export type AbuseContext =
	| { type: 'post_submit'; did: string; ip: string }
	| { type: 'thread_create'; did: string; ip: string }
	| { type: 'login_attempt'; ip: string }
	| { type: 'preview_request'; did: string | null; ip: string }
	| { type: 'flag_submit'; did: string; ip: string }
	| { type: 'og_fetch'; ip: string };

export type AbuseVerdict =
	| { allowed: true }
	| { allowed: false; reason: string; retryAfterSeconds?: number };

const LIMITS: Record<string, { window: number; limit: number }> = {
	thread_create: { window: 3600 * 1000, limit: 10 },
	post_submit: { window: 3600 * 1000, limit: 30 },
	preview_request: { window: 3600 * 1000, limit: 60 },
	login_attempt: { window: 15 * 60 * 1000, limit: 10 },
	flag_submit: { window: 3600 * 1000, limit: 20 },
	og_fetch: { window: 3600 * 1000, limit: 20 }
};

export async function checkAbuse(ctx: AbuseContext): Promise<AbuseVerdict> {
	const identifier = 'did' in ctx && ctx.did ? ctx.did : ctx.ip;
	const key = `${ctx.type}:${identifier}`;
	const config = LIMITS[ctx.type] || { window: 3600 * 1000, limit: 20 };
	const now = Date.now();
	const windowStart = new Date(Math.floor(now / config.window) * config.window);

	try {
		// Atomic upsert: increment count if same window, reset if new window
		const windowStartIso = windowStart.toISOString();
		const result = await db.execute(
			sql`
			INSERT INTO rate_limit_buckets (key, count, window_start)
			VALUES (${key}, 1, ${windowStartIso}::timestamptz)
			ON CONFLICT (key) DO UPDATE
			SET count = CASE
				WHEN rate_limit_buckets.window_start = ${windowStartIso}::timestamptz THEN rate_limit_buckets.count + 1
				ELSE 1
			END,
			window_start = ${windowStartIso}::timestamptz
			RETURNING count
			`
		);

		const count = Number((result as Array<{ count: unknown }>)[0]?.count ?? 0);

		if (count > config.limit) {
			return {
				allowed: false,
				reason: `Rate limit exceeded for ${ctx.type}`,
				retryAfterSeconds: Math.ceil((windowStart.getTime() + config.window - now) / 1000)
			};
		}

		return { allowed: true };
	} catch (err) {
		// If rate_limit_buckets doesn't exist yet, log and allow (graceful fallback)
		console.error('[abuse check error]', String(err));
		return { allowed: true };
	}
}
