import { db } from '$lib/db/index.js';
import { users } from '$lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { logger as rootLogger } from '$lib/logger.js';

const log = rootLogger.child({ module: 'auth:profile-sync' });

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Fetches the user's profile from the ATproto PLC Directory and updates cache.
// Fire-and-forget — callers do not await this.
export async function maybeSyncProfile(did: string, lastProfileSync: Date): Promise<void> {
	const age = Date.now() - lastProfileSync.getTime();
	if (age < SYNC_INTERVAL_MS) return;

	// Non-blocking: errors are logged but never thrown to the caller
	syncProfileBackground(did).catch((err) => {
		log.warn({ err, did }, 'background profile sync failed');
	});
}

async function syncProfileBackground(did: string): Promise<void> {
	// Resolve DID document from PLC Directory
	const res = await fetch(`https://plc.directory/${did}`, {
		signal: AbortSignal.timeout(5000),
	});

	if (!res.ok) return;

	const doc = await res.json() as {
		alsoKnownAs?: string[];
	};

	// Extract handle from alsoKnownAs (format: "at://handle.bsky.social")
	const atUri = doc.alsoKnownAs?.find((a: string) => a.startsWith('at://'));
	const handle = atUri ? atUri.replace('at://', '') : null;

	if (!handle) return;

	// Fetch profile via AppView (public, no auth)
	const profileRes = await fetch(
		`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`,
		{ signal: AbortSignal.timeout(5000) }
	);

	let displayName: string | null = null;
	let avatarUrl: string | null = null;

	if (profileRes.ok) {
		const profile = await profileRes.json() as {
			displayName?: string;
			avatar?: string;
		};
		displayName = profile.displayName ?? null;
		avatarUrl = profile.avatar ?? null;
	}

	await db
		.update(users)
		.set({
			handle,
			displayName,
			avatarUrl,
			lastProfileSync: new Date(),
		})
		.where(eq(users.did, did));
}
