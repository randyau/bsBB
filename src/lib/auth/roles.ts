import type { SessionUser } from './session';

/**
 * True only for global admins. Use for structural operations: forum config,
 * role management, settings, SQL query, promoting/demoting admins.
 */
export function isAdmin(user: SessionUser | null | undefined): boolean {
	return user?.globalRole === 'admin';
}

/**
 * True for global admins and global moderators. Use for all moderation
 * operations: hide/restore posts, lock threads, ban/unban users, approval queue.
 * Any new role that should inherit moderation access gets added here only.
 */
export function isModerator(user: SessionUser | null | undefined): boolean {
	return user?.globalRole === 'admin' || user?.globalRole === 'moderator';
}
