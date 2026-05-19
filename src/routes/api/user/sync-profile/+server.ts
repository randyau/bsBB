import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/db';
import { users } from '$lib/db/schema.js';
import { eq } from 'drizzle-orm';

const SYNC_COOLDOWN_MS = 60 * 1000; // 60 seconds

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return error(401, 'Not authenticated');
	}

	const did = locals.user.did;

	// Check cooldown
	const user = await db
		.select({ lastProfileSync: users.lastProfileSync })
		.from(users)
		.where(eq(users.did, did))
		.limit(1);

	if (!user.length) {
		return error(404, 'User not found');
	}

	const lastSync = user[0].lastProfileSync.getTime();
	const timeSinceSync = Date.now() - lastSync;

	if (timeSinceSync < SYNC_COOLDOWN_MS) {
		const secondsRemaining = Math.ceil((SYNC_COOLDOWN_MS - timeSinceSync) / 1000);
		return error(429, `Please wait ${secondsRemaining}s before syncing again`);
	}

	// Trigger sync
	const res = await fetch(`https://plc.directory/${did}`, {
		signal: AbortSignal.timeout(5000),
	}).catch(() => null);

	if (!res?.ok) {
		return error(500, 'Failed to fetch profile from PLC');
	}

	const doc = await res.json() as { alsoKnownAs?: string[] };
	const atUri = doc.alsoKnownAs?.find((a: string) => a.startsWith('at://'));
	const handle = atUri ? atUri.replace('at://', '') : null;

	let displayName: string | null = null;
	let avatarUrl: string | null = null;

	if (handle) {
		const profileRes = await fetch(
			`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${did}`,
			{ signal: AbortSignal.timeout(5000) }
		).catch(() => null);

		if (profileRes?.ok) {
			const profile = await profileRes.json() as {
				displayName?: string;
				avatar?: string;
			};
			displayName = profile.displayName ?? null;
			avatarUrl = profile.avatar ?? null;
		}
	}

	const currentUser = await db
		.select({ displayName: users.displayName })
		.from(users)
		.where(eq(users.did, did))
		.limit(1);

	// Preserve user-customized displayName if it exists, otherwise use ATproto version
	const finalDisplayName = currentUser[0]?.displayName || displayName;

	await db
		.update(users)
		.set({
			...(handle !== null && { handle }),
			displayName: finalDisplayName,
			avatarUrl,
			lastProfileSync: new Date(),
		})
		.where(eq(users.did, did));

	return json({
		success: true,
		handle,
		displayName: finalDisplayName,
		avatarUrl,
		redirectUrl: handle ? `/user/${handle}` : null,
	});
};
