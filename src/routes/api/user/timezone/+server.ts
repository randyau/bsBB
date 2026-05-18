import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const VALID_TIMEZONES = [
	'America/New_York',
	'America/Chicago',
	'America/Denver',
	'America/Los_Angeles',
	'America/Mexico_City',
	'America/Toronto',
	'Europe/London',
	'Europe/Paris',
	'Europe/Berlin',
	'Asia/Tokyo',
	'Asia/Shanghai',
	'Asia/Hong_Kong',
	'Australia/Sydney',
	'Pacific/Auckland',
	'UTC'
];

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) {
		return error(401, 'Not authenticated');
	}

	const { timezone } = await event.request.json();

	if (!timezone || !VALID_TIMEZONES.includes(timezone)) {
		return error(400, `Invalid timezone: ${timezone}`);
	}

	await db.update(users).set({ timezone }).where(eq(users.did, user.did));

	return json({ success: true, timezone });
};
