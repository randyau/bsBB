import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { adminAssets } from '$lib/db/schema';
import { canAccessAssets, getAssetUrl } from '$lib/assets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !canAccessAssets(locals.user)) {
		return json({ error: 'Unauthorized' }, { status: 403 });
	}

	const assets = await db.query.adminAssets.findMany({
		orderBy: (table, { desc }) => desc(table.createdAt),
		limit: 500,
	});

	return json(
		assets.map((a) => ({
			id: a.id,
			slug: a.slug,
			originalFilename: a.originalFilename,
			mimeType: a.mimeType,
			size: a.size,
			createdAt: a.createdAt,
			url: getAssetUrl(a.slug),
		}))
	);
};
