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
	// Check if already claimed
	const existing = await db
		.select({ value: instanceSettings.value })
		.from(instanceSettings)
		.where(eq(instanceSettings.key, 'first_admin_claimed'))
		.limit(1);

	// If the setting exists and is 'true', already claimed
	if (existing.length > 0 && existing[0].value === 'true') {
		return false;
	}

	// Either doesn't exist or is 'false' — claim it for this user
	if (existing.length === 0) {
		// Insert if it doesn't exist
		await db.insert(instanceSettings).values({
			key: 'first_admin_claimed',
			value: 'true',
		});
	} else {
		// Update if it exists and is 'false'
		await db
			.update(instanceSettings)
			.set({ value: 'true' })
			.where(eq(instanceSettings.key, 'first_admin_claimed'));
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
