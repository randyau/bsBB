import { eq, and, isNull } from 'drizzle-orm';
import { forums, forumPermissions, userForumRoles, instanceSettings } from '$lib/db/schema';
import type { SessionUser } from '$lib/auth/session';
import type { db as dbType } from '$lib/db';

/**
 * Check if a user can read a specific forum.
 * Admin always true, banned always false, others: check explicit roles + instance default.
 */
export async function canRead(
	db: typeof dbType,
	forumId: string,
	user: SessionUser | null
): Promise<boolean> {
	// Admins can read everything
	if (user?.globalRole === 'admin') {
		return true;
	}

	// Banned users cannot read anything
	if (user?.globalRole === 'banned') {
		return false;
	}

	// Determine the user's effective role for this forum
	let effectiveRole = 'guest';

	if (user) {
		// Check if user has a per-forum moderator role
		const userRole = await db.query.userForumRoles.findFirst({
			where: and(eq(userForumRoles.userDid, user.did), eq(userForumRoles.forumId, forumId)),
		});

		if (userRole) {
			effectiveRole = userRole.role;
		} else {
			// Fall back to global role (member or other)
			effectiveRole = user.globalRole || 'guest';
		}
	}

	// Walk up the parent forum chain looking for an explicit permission row
	const parentChain = await getParentChain(db, forumId);

	for (const chainForumId of parentChain) {
		const perm = await db.query.forumPermissions.findFirst({
			where: and(
				eq(forumPermissions.forumId, chainForumId),
				eq(forumPermissions.role, effectiveRole)
			),
		});

		if (perm && perm.canRead) {
			return true;
		}

		// If a row exists but can_read is false, don't check parents (explicit deny)
		if (perm) {
			return false;
		}
	}

	// No explicit permission found — fall back to instance default
	const defaultVisibility = await db.query.instanceSettings.findFirst({
		where: eq(instanceSettings.key, 'default_forum_visibility'),
	});

	const visibility = defaultVisibility?.value || 'public';

	if (visibility === 'public') {
		return true; // Everyone can read public forums
	}

	// visibility === 'members-only'
	return effectiveRole !== 'guest'; // Members and above can read
}

/**
 * Check if a user can post in a specific forum.
 * Admin always true, banned always false, others: check explicit roles + instance default (always deny for guests).
 */
export async function canPost(
	db: typeof dbType,
	forumId: string,
	user: SessionUser | null
): Promise<boolean> {
	// Admins can post everywhere
	if (user?.globalRole === 'admin') {
		return true;
	}

	// Banned users cannot post
	if (user?.globalRole === 'banned') {
		return false;
	}

	// Unauthenticated guests cannot post
	if (!user) {
		return false;
	}

	// Determine the user's effective role for this forum
	let effectiveRole: string = user.globalRole || 'guest';

	const userRole = await db.query.userForumRoles.findFirst({
		where: and(eq(userForumRoles.userDid, user.did), eq(userForumRoles.forumId, forumId)),
	});

	if (userRole) {
		effectiveRole = userRole.role;
	}

	// Walk up the parent forum chain looking for an explicit permission row
	const parentChain = await getParentChain(db, forumId);

	for (const chainForumId of parentChain) {
		const perm = await db.query.forumPermissions.findFirst({
			where: and(
				eq(forumPermissions.forumId, chainForumId),
				eq(forumPermissions.role, effectiveRole)
			),
		});

		if (perm && perm.canPost) {
			return true;
		}

		// If a row exists but can_post is false, don't check parents (explicit deny)
		if (perm) {
			return false;
		}
	}

	// No explicit permission found — members can post by default, only guests cannot
	return true;
}

/**
 * Get the forum hierarchy chain from forumId up to the root.
 * Returns array of forum IDs: [forumId, parentId, grandparentId, ..., root]
 */
async function getParentChain(db: typeof dbType, forumId: string): Promise<string[]> {
	const chain: string[] = [forumId];
	let currentId = forumId;

	// Traverse up the parent chain until we reach a root forum (parent_id IS NULL)
	// Safety limit to 10 levels to prevent infinite loops
	let depth = 0;
	const maxDepth = 10;

	while (depth < maxDepth) {
		const forum = await db.query.forums.findFirst({
			where: eq(forums.id, currentId),
			columns: { parentId: true },
		});

		if (!forum || !forum.parentId) {
			break; // Reached root
		}

		chain.push(forum.parentId);
		currentId = forum.parentId;
		depth++;
	}

	return chain;
}
