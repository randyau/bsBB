// Phase 1 stub — always allows. Phase 4 fills in real logic using rate_limit_buckets.
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

export async function checkAbuse(ctx: AbuseContext): Promise<AbuseVerdict> {
	if (process.env.NODE_ENV === 'development') {
		console.debug('[abuse stub]', ctx.type, 'from', 'ip' in ctx ? ctx.ip : '?');
	}
	return { allowed: true };
}
