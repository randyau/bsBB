import { db } from '$lib/db';
import { sql } from 'drizzle-orm';
import { logger as rootLogger } from '$lib/logger.js';

const log = rootLogger.child({ module: 'abuse' });

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

async function checkBucket(key: string, config: { window: number; limit: number }, now: number): Promise<{ count: number; windowStart: Date }> {
	const windowStart = new Date(Math.floor(now / config.window) * config.window);
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
	const count = Number((result as unknown as Array<{ count: unknown }>)[0]?.count ?? 0);
	return { count, windowStart };
}

export async function checkAbuse(ctx: AbuseContext): Promise<AbuseVerdict> {
	const config = LIMITS[ctx.type] || { window: 3600 * 1000, limit: 20 };
	const now = Date.now();

	// For post_submit and thread_create, enforce both a per-DID and a per-IP bucket.
	// This prevents abuse via multiple ATproto accounts from the same IP.
	const dualCheck = (ctx.type === 'post_submit' || ctx.type === 'thread_create') &&
		'did' in ctx && ctx.did && ctx.ip;

	const primaryIdentifier = 'did' in ctx && ctx.did ? ctx.did : ctx.ip;
	const primaryKey = `${ctx.type}:${primaryIdentifier}`;

	try {
		const primary = await checkBucket(primaryKey, config, now);
		if (primary.count > config.limit) {
			log.warn({ type: ctx.type, identifier: primaryIdentifier, count: primary.count, limit: config.limit }, 'rate limit exceeded');
			return {
				allowed: false,
				reason: `Rate limit exceeded for ${ctx.type}`,
				retryAfterSeconds: Math.ceil((primary.windowStart.getTime() + config.window - now) / 1000),
			};
		}

		if (dualCheck) {
			const ipKey = `${ctx.type}:ip:${(ctx as { ip: string }).ip}`;
			const ipBucket = await checkBucket(ipKey, config, now);
			if (ipBucket.count > config.limit) {
				log.warn({ type: ctx.type, ip: (ctx as { ip: string }).ip, count: ipBucket.count, limit: config.limit }, 'rate limit exceeded (IP bucket)');
				return {
					allowed: false,
					reason: `Rate limit exceeded for ${ctx.type}`,
					retryAfterSeconds: Math.ceil((ipBucket.windowStart.getTime() + config.window - now) / 1000),
				};
			}
		}

		return { allowed: true };
	} catch (err) {
		log.error({ err, type: ctx.type }, 'abuse check DB error; failing closed in production');
		// In production, fail closed (deny) to prevent abuse during DB issues.
		// In development, fail open (allow) to avoid blocking during setup/testing.
		if (process.env.NODE_ENV === 'production') {
			return { allowed: false, reason: 'Rate limiter unavailable', retryAfterSeconds: 60 };
		}
		return { allowed: true };
	}
}
