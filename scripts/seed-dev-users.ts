#!/usr/bin/env npx tsx
// Dev-only seed: inserts fake users for local testing without ATproto OAuth.
// Idempotent: updates roles back to defaults if manually changed.
// Never import or run this in production — it creates users with no real ATproto identity.

import 'dotenv/config';
import { db } from '../src/lib/db/index.js';
import { users } from '../src/lib/db/schema.js';

const DEV_USERS = [
	{
		did: 'did:example:dev-admin',
		handle: 'dev-admin.test',
		displayName: 'Dev Admin',
		globalRole: 'admin' as const,
	},
	{
		did: 'did:example:dev-moderator',
		handle: 'dev-moderator.test',
		displayName: 'Dev Moderator',
		globalRole: 'member' as const, // forum-mod role is set per-forum separately
	},
	{
		did: 'did:example:dev-member',
		handle: 'dev-member.test',
		displayName: 'Dev Member',
		globalRole: 'member' as const,
	},
	{
		did: 'did:example:dev-banned',
		handle: 'dev-banned.test',
		displayName: 'Dev Banned',
		globalRole: 'banned' as const,
	},
];

const now = new Date();

// Seed users, updating roles if they already exist (idempotent: resets permissions on re-run)
for (const u of DEV_USERS) {
	await db
		.insert(users)
		.values({
			...u,
			avatarUrl: null,
			lastProfileSync: now,
			notifyViaBluesky: false,
			chatSessionEncrypted: null,
		})
		.onConflictDoUpdate({
			target: users.did,
			set: {
				globalRole: u.globalRole,
				lastProfileSync: now,
			},
		});
}

console.log('Dev users seeded:');
for (const u of DEV_USERS) {
	console.log(`  ${u.did}  (${u.globalRole})`);
}

process.exit(0);
