import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { db } from '$lib/db';
import { users, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { logger as rootLogger } from '$lib/logger';

const log = rootLogger.child({ module: 'routes:api:test' });

export const GET: RequestHandler = async ({ url }) => {
	// Only available in development mode
	if (!dev) {
		return error(404, 'Not found');
	}

	const did = url.searchParams.get('did');
	const handle = url.searchParams.get('handle') || 'testuser';
	const displayName = url.searchParams.get('displayName') || 'Test User';

	if (!did) {
		return json(
			{
				error: 'Missing required parameter: did',
				example:
					'/api/test/session?did=did:plc:test123&handle=testuser&displayName=Test%20User'
			},
			{ status: 400 }
		);
	}

	try {
		// Upsert user
		await db
			.insert(users)
			.values({
				did,
				handle,
				displayName,
				lastProfileSync: new Date()
			})
			.onConflictDoUpdate({
				target: users.did,
				set: {
					handle,
					displayName,
					lastProfileSync: new Date()
				}
			});

		// Generate session token (32 bytes = 256 bits)
		const token = crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

		// Create session
		await db.insert(sessions).values({
			id: tokenHash,
			userDid: did,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
		});

		// Return session token for curl usage
		return json({
			success: true,
			token,
			did,
			handle,
			displayName,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
			curlExample: `curl -H "Cookie: session=${token}" http://localhost:5173/admin`,
			curlExampleJson: `curl -H "Cookie: session=${token}" -H "Accept: application/json" http://localhost:5173/api/user`
		});
	} catch (err) {
		log.error({ err }, 'Test session creation failed:');
		return json({ error: 'Failed to create test session' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	// Only available in development mode
	if (!dev) {
		return error(404, 'Not found');
	}

	try {
		const body = await request.json();
		const { did, handle = 'testuser', displayName = 'Test User', globalRole = 'member' } = body;

		if (!did) {
			return json({ error: 'Missing required field: did' }, { status: 400 });
		}

		// Upsert user
		await db
			.insert(users)
			.values({
				did,
				handle,
				displayName,
				globalRole,
				lastProfileSync: new Date()
			})
			.onConflictDoUpdate({
				target: users.did,
				set: {
					handle,
					displayName,
					globalRole,
					lastProfileSync: new Date()
				}
			});

		// Generate session token
		const token = crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

		// Create session
		await db.insert(sessions).values({
			id: tokenHash,
			userDid: did,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
		});

		return json({
			success: true,
			token,
			did,
			handle,
			displayName,
			globalRole,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
		});
	} catch (err) {
		log.error({ err }, 'Test session creation failed:');
		return json({ error: 'Failed to create test session' }, { status: 500 });
	}
};
