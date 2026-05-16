import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/db';
import { forums, threads, posts } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { error, redirect, fail } from '@sveltejs/kit';
import { canRead, canPost } from '$lib/permissions/index.js';
import { renderMarkdown } from '$lib/markdown/index.js';
import { fetchLinkMetadata } from '$lib/markdown/og.js';
import { generateSlug } from '$lib/markdown/slug.js';
import { checkAbuse } from '$lib/abuse/index.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const forum = await db.query.forums.findFirst({
		where: eq(forums.slug, params.forumSlug),
	});

	if (!forum) {
		throw error(404, 'Forum not found');
	}

	const canAccess = await canRead(db, forum.id, locals.user);
	if (!canAccess) {
		throw error(403, 'Access denied');
	}

	return {
		forum,
		user: locals.user,
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request, getClientAddress }) => {
		if (!locals.user) {
			return redirect(303, '/login');
		}

		const forum = await db.query.forums.findFirst({
			where: eq(forums.slug, params.forumSlug),
		});

		if (!forum) {
			throw error(404, 'Forum not found');
		}

		const canPostHere = await canPost(db, forum.id, locals.user);
		if (!canPostHere) {
			return fail(403, { error: 'You do not have permission to post in this forum' });
		}

		const ip = getClientAddress();
		const verdict = await checkAbuse({ type: 'thread_create', did: locals.user.did, ip });
		if (!verdict.allowed) {
			return fail(429, { error: 'Too many requests. Please try again later.' });
		}

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const body = String(form.get('body') ?? '').trim();

		if (!title || title.length < 1 || title.length > 300) {
			return fail(422, { error: 'Title must be 1-300 characters', title, body });
		}

		if (!body || body.length < 1 || body.length > 50000) {
			return fail(422, { error: 'Body must be 1-50,000 characters', title, body });
		}

		let slug = generateSlug(title);
		let threadId: string | undefined;

		// Retry slug uniqueness up to 5 times
		for (let i = 2; i <= 5; i++) {
			try {
				const bodyHtml = await renderMarkdown(body);
				const linkMetadata = await fetchLinkMetadata(body, ip);

				const result = await db.transaction(async (tx) => {
					const threadResult = await tx
						.insert(threads)
						.values({
							forumId: forum.id,
							authorDid: locals.user!.did,
							title,
							slug,
						})
						.returning({ id: threads.id });

					const newThreadId = threadResult[0]?.id;
					if (!newThreadId) throw new Error('Failed to create thread');

					await tx.insert(posts).values({
						threadId: newThreadId,
						authorDid: locals.user!.did,
						bodyMarkdown: body,
						bodyHtml,
						linkMetadata,
					});

					await tx
						.update(threads)
						.set({ lastPostAt: new Date() })
						.where(eq(threads.id, newThreadId));

					return newThreadId;
				});

				threadId = result;
				break;
			} catch (err: any) {
				// Check for unique constraint violation (code 23505) in either err or err.cause
				const errorCode = err.code || err.cause?.code;
				if (errorCode === '23505' && i < 5) {
					slug = `${generateSlug(title)}-${i}`;
					continue;
				}
				console.error('[thread creation error]', err);
				return fail(500, { error: 'Failed to create thread', title, body });
			}
		}

		if (!threadId) {
			return fail(500, { error: 'Failed to create thread', title, body });
		}

		throw redirect(303, `/f/${forum.slug}/t/${slug}`);
	},
};
