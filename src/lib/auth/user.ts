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
	// Check atomically: only promote if 'first_admin_claimed' is still 'false'
	const result = await db
		.update(instanceSettings)
		.set({ value: 'true' })
		.where(
			sql`${instanceSettings.key} = 'first_admin_claimed' AND ${instanceSettings.value} = 'false'`
		)
		.returning({ key: instanceSettings.key });

	if (result.length === 0) return false; // already claimed

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
