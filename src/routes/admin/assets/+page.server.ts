import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db';
import { adminAssets } from '$lib/db/schema';
import { generateAssetSlug, getAssetUrl, canAccessAssets, SLUG_PATTERN } from '$lib/assets';
import { eq } from 'drizzle-orm';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad, Actions } from './$types';

const UPLOADS_DIR = join(process.cwd(), 'uploads/assets');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/svg+xml',
	'application/pdf',
	'application/zip',
	'application/x-rar-compressed',
	'application/gzip',
	'application/x-7z-compressed',
	'text/plain',
]);

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !canAccessAssets(locals.user)) {
		redirect(302, '/');
	}

	const assets = await db.query.adminAssets.findMany({
		orderBy: (table, { desc }) => desc(table.createdAt),
		limit: 500,
	});

	return {
		assets: assets.map((a) => ({
			...a,
			url: getAssetUrl(a.slug),
		})),
	};
};

export const actions: Actions = {
	uploadAsset: async ({ request, locals }) => {
		if (!locals.user || !canAccessAssets(locals.user)) {
			return { error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return { error: 'No file provided' };
		}

		if (!ALLOWED_MIME_TYPES.has(file.type)) {
			return { error: `File type not allowed: ${file.type}` };
		}

		if (file.size > MAX_FILE_SIZE) {
			return { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const slug = generateAssetSlug(file.name);
		const filePath = join(UPLOADS_DIR, slug);

		try {
			writeFileSync(filePath, buffer);

			await db.insert(adminAssets).values({
				slug,
				originalFilename: file.name,
				mimeType: file.type,
				size: file.size,
				uploadedByDid: locals.user.did,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			return {
				success: true,
				slug,
				url: getAssetUrl(slug),
				filename: file.name,
			};
		} catch (err) {
			// Clean up file if DB insert fails
			try {
				unlinkSync(filePath);
			} catch {
				/* ignore */
			}
			console.error('Asset upload failed:', err);
			return { error: 'Upload failed. Please try again.' };
		}
	},

	deleteAsset: async ({ request, locals }) => {
		if (!locals.user || !canAccessAssets(locals.user)) {
			return { error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const slug = formData.get('slug') as string;

		if (!slug) {
			return { error: 'No slug provided' };
		}

		if (!SLUG_PATTERN.test(slug)) {
			return { error: 'Invalid slug' };
		}

		try {
			// Delete file first — if this fails the DB record is untouched and the asset is still accessible
			const filePath = join(UPLOADS_DIR, slug);
			try {
				unlinkSync(filePath);
			} catch {
				// File already missing — proceed to clean up the DB record
			}

			await db.delete(adminAssets).where(eq(adminAssets.slug, slug));

			return { success: true };
		} catch (err) {
			console.error('Asset delete failed:', err);
			return { error: 'Delete failed. Please try again.' };
		}
	},

	renameAsset: async ({ request, locals }) => {
		if (!locals.user || !canAccessAssets(locals.user)) {
			return { error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const slug = formData.get('slug') as string;
		const newFilename = formData.get('newFilename') as string;

		if (!slug || !newFilename) {
			return { error: 'Missing slug or filename' };
		}

		if (!SLUG_PATTERN.test(slug)) {
			return { error: 'Invalid slug' };
		}

		const trimmedFilename = newFilename.trim();
		if (!trimmedFilename) {
			return { error: 'Filename cannot be empty' };
		}
		if (trimmedFilename.length > MAX_FILENAME_LENGTH) {
			return { error: `Filename too long (max ${MAX_FILENAME_LENGTH} characters)` };
		}
		// Reject control characters, null bytes, and path separators
		if (/[\x00-\x1f\x7f/\\]/.test(trimmedFilename)) {
			return { error: 'Filename contains invalid characters' };
		}

		try {
			await db
				.update(adminAssets)
				.set({ originalFilename: trimmedFilename, updatedAt: new Date() })
				.where(eq(adminAssets.slug, slug));

			return { success: true };
		} catch (err) {
			console.error('Asset rename failed:', err);
			return { error: 'Rename failed. Please try again.' };
		}
	},
};
