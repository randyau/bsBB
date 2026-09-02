import { db } from '$lib/db/index.js';
import { users, instanceSettings, modLog } from '$lib/db/schema.js';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Upsert user from ATproto session data
// ---------------------------------------------------------------------------
export async function upsertUser(
	did: string,
	session: { did: string; handle?: string }
): Promise<void> {
	const handle = session.handle ?? did;
	const now = new Date();

	await db
		.insert(users)
		.values({
			did,
			handle,
			displayName: null,
			avatarUrl: null,
			lastProfileSync: now,
			globalRole: 'member',
		})
		.onConflictDoUpdate({
			target: users.did,
			set: {
				handle,
				lastProfileSync: now,
			},
		});
}

// ---------------------------------------------------------------------------
// First-admin gate: promotes the first user to log in
// Returns true if this user was promoted (for flash banner)
// ---------------------------------------------------------------------------
export async function claimFirstAdmin(did: string): Promise<boolean> {
	// Atomic claim: insert-or-update in one statement so two concurrent first
	// logins can't both read value='false' and both promote themselves.
	// The DO UPDATE only fires (and only returns a row) when the row is still 'false'.
	const claimed = await db
		.insert(instanceSettings)
		.values({ key: 'first_admin_claimed', value: 'true' })
		.onConflictDoUpdate({
			target: instanceSettings.key,
			set: { value: 'true' },
			setWhere: eq(instanceSettings.value, 'false'),
		})
		.returning({ key: instanceSettings.key });

	if (claimed.length === 0) {
		// Row already existed with value='true' — already claimed by someone else
		return false;
	}

	// Promote this user to admin
	await db.update(users).set({ globalRole: 'admin' }).where(eq(users.did, did));

	// Write mod_log entry
	await db.insert(modLog).values({
		moderatorDid: did,
		action: 'promote_admin',
		targetDid: did,
		reason: 'first login — auto-promoted as instance first admin',
	});

	return true;
}
