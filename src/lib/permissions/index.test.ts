import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';
import { canRead, canPost } from './index';
import {
	forums,
	forumPermissions,
	userForumRoles,
	users,
	instanceSettings,
} from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const testForumId = '00000000-0000-0000-0000-000000000001';
const testSubForumId = '00000000-0000-0000-0000-000000000002';
const testDid = 'did:plc:test-' + Math.random().toString(36).slice(2, 10);

const testUser = {
	did: testDid,
	handle: 'test.bsky.social',
	displayName: 'Test User',
	avatarUrl: null,
	globalRole: 'member' as const,
};

const testAdmin = {
	did: 'did:plc:admin-' + Math.random().toString(36).slice(2, 10),
	handle: 'admin.bsky.social',
	displayName: 'Admin',
	avatarUrl: null,
	globalRole: 'admin' as const,
};

describe('canRead permission resolution', () => {
	beforeEach(async () => {
		// Clean up test data
		await db.delete(forumPermissions).where(eq(forumPermissions.forumId, testForumId));
		await db.delete(forumPermissions).where(eq(forumPermissions.forumId, testSubForumId));
		await db.delete(userForumRoles).where(eq(userForumRoles.userDid, testDid));
		await db.delete(forums).where(eq(forums.id, testForumId));
		await db.delete(forums).where(eq(forums.id, testSubForumId));
		await db.delete(users).where(eq(users.did, testDid));
		await db.delete(users).where(eq(users.did, testAdmin.did));

		// Create test user + admin in DB
		await db.insert(users).values({
			did: testDid,
			handle: testUser.handle,
			displayName: testUser.displayName,
			avatarUrl: testUser.avatarUrl,
			globalRole: 'member',
			lastProfileSync: new Date(),
			createdAt: new Date(),
		});

		await db.insert(users).values({
			did: testAdmin.did,
			handle: testAdmin.handle,
			displayName: testAdmin.displayName,
			avatarUrl: testAdmin.avatarUrl,
			globalRole: 'admin',
			lastProfileSync: new Date(),
			createdAt: new Date(),
		});

		// Create test forums
		await db.insert(forums).values({
			id: testForumId,
			parentId: null,
			name: 'Test Forum',
			slug: 'test-forum',
			description: 'Test',
			sortOrder: 0,
			createdAt: new Date(),
		});

		await db.insert(forums).values({
			id: testSubForumId,
			parentId: testForumId,
			name: 'Sub Forum',
			slug: 'sub-forum',
			description: 'Subtest',
			sortOrder: 0,
			createdAt: new Date(),
		});

		// Ensure instance_settings for default visibility
		await db.delete(instanceSettings).where(eq(instanceSettings.key, 'default_forum_visibility'));
	});

	it('admin can always read any forum', async () => {
		const result = await canRead(db, testForumId, testAdmin);
		expect(result).toBe(true);
	});

	it('guest cannot read members-only forum (instance default)', async () => {
		// Set instance to members-only
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'members-only',
		});

		const result = await canRead(db, testForumId, null); // null = guest
		expect(result).toBe(false);
	});

	it('guest can read public forum (instance default)', async () => {
		// Set instance to public
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'public',
		});

		const result = await canRead(db, testForumId, null); // null = guest
		expect(result).toBe(true);
	});

	it('member can read public forum', async () => {
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'public',
		});

		const result = await canRead(db, testForumId, testUser);
		expect(result).toBe(true);
	});

	it('member can read members-only forum (instance default)', async () => {
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'members-only',
		});

		const result = await canRead(db, testForumId, testUser);
		expect(result).toBe(true);
	});

	it('explicit forum_permissions overrides instance default', async () => {
		// Set instance to public (guest should be allowed)
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'public',
		});

		// Explicitly deny guest on this forum
		await db.insert(forumPermissions).values({
			forumId: testForumId,
			role: 'guest',
			canRead: false,
			canPost: false,
			canModerate: false,
		});

		const result = await canRead(db, testForumId, null); // null = guest
		expect(result).toBe(false);
	});

	it('explicit allow on forum overrides instance deny', async () => {
		// Set instance to members-only
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'members-only',
		});

		// Explicitly allow guest on this forum
		await db.insert(forumPermissions).values({
			forumId: testForumId,
			role: 'guest',
			canRead: true,
			canPost: false,
			canModerate: false,
		});

		const result = await canRead(db, testForumId, null);
		expect(result).toBe(true);
	});

	it('per-forum moderator role works', async () => {
		// Don't set explicit forum_permissions; rely on user role
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'members-only',
		});

		// User is member globally, but guest cannot read members-only
		// Assign user as moderator in this forum
		await db.insert(userForumRoles).values({
			userDid: testDid,
			forumId: testForumId,
			role: 'moderator',
			assignedBy: testAdmin.did,
			assignedAt: new Date(),
		});

		// Add moderator permission
		await db.insert(forumPermissions).values({
			forumId: testForumId,
			role: 'moderator',
			canRead: true,
			canPost: true,
			canModerate: true,
		});

		const result = await canRead(db, testForumId, testUser);
		expect(result).toBe(true);
	});

	it('child forum inherits parent permission', async () => {
		// Set instance to members-only
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'members-only',
		});

		// No explicit permission on child forum — should inherit from parent
		// Guest cannot read (members-only on parent)
		const result = await canRead(db, testSubForumId, null);
		expect(result).toBe(false);

		// Member can read (member role + members-only parent)
		const memberResult = await canRead(db, testSubForumId, testUser);
		expect(memberResult).toBe(true);
	});

	it('banned user cannot read anything', async () => {
		await db.insert(instanceSettings).values({
			key: 'default_forum_visibility',
			value: 'public',
		});

		const bannedUser = { ...testUser, globalRole: 'banned' as const };
		const result = await canRead(db, testForumId, bannedUser);
		expect(result).toBe(false);
	});
});

describe('canPost permission resolution', () => {
	beforeEach(async () => {
		// Clean up test data
		await db.delete(forumPermissions).where(eq(forumPermissions.forumId, testForumId));
		await db.delete(forumPermissions).where(eq(forumPermissions.forumId, testSubForumId));
		await db.delete(userForumRoles).where(eq(userForumRoles.userDid, testDid));
		await db.delete(forums).where(eq(forums.id, testForumId));
		await db.delete(forums).where(eq(forums.id, testSubForumId));
		await db.delete(users).where(eq(users.did, testDid));
		await db.delete(users).where(eq(users.did, testAdmin.did));

		// Create test user + admin in DB
		await db.insert(users).values({
			did: testDid,
			handle: testUser.handle,
			displayName: testUser.displayName,
			avatarUrl: testUser.avatarUrl,
			globalRole: 'member',
			lastProfileSync: new Date(),
			createdAt: new Date(),
		});

		await db.insert(users).values({
			did: testAdmin.did,
			handle: testAdmin.handle,
			displayName: testAdmin.displayName,
			avatarUrl: testAdmin.avatarUrl,
			globalRole: 'admin',
			lastProfileSync: new Date(),
			createdAt: new Date(),
		});

		// Create test forums
		await db.insert(forums).values({
			id: testForumId,
			parentId: null,
			name: 'Test Forum',
			slug: 'test-forum',
			description: 'Test',
			sortOrder: 0,
			createdAt: new Date(),
		});

		await db.insert(forums).values({
			id: testSubForumId,
			parentId: testForumId,
			name: 'Sub Forum',
			slug: 'sub-forum',
			description: 'Subtest',
			sortOrder: 0,
			createdAt: new Date(),
		});

		// Ensure instance_settings for default visibility
		await db.delete(instanceSettings).where(eq(instanceSettings.key, 'default_forum_visibility'));
	});

	it('admin can always post', async () => {
		const result = await canPost(db, testForumId, testAdmin);
		expect(result).toBe(true);
	});

	it('banned user cannot post', async () => {
		const bannedUser = { ...testUser, globalRole: 'banned' as const };
		const result = await canPost(db, testForumId, bannedUser);
		expect(result).toBe(false);
	});

	it('guest cannot post (no authentication)', async () => {
		const result = await canPost(db, testForumId, null);
		expect(result).toBe(false);
	});

	it('member can post if forum allows it', async () => {
		// Add explicit permission for member to post
		await db.insert(forumPermissions).values({
			forumId: testForumId,
			role: 'member',
			canRead: true,
			canPost: true,
			canModerate: false,
		});

		const result = await canPost(db, testForumId, testUser);
		expect(result).toBe(true);
	});

	it('member cannot post if forum denies it', async () => {
		// Add explicit deny
		await db.insert(forumPermissions).values({
			forumId: testForumId,
			role: 'member',
			canRead: true,
			canPost: false,
			canModerate: false,
		});

		const result = await canPost(db, testForumId, testUser);
		expect(result).toBe(false);
	});

	it('moderator can post', async () => {
		// Assign user as moderator
		await db.insert(userForumRoles).values({
			userDid: testDid,
			forumId: testForumId,
			role: 'moderator',
			assignedBy: testAdmin.did,
			assignedAt: new Date(),
		});

		// Add moderator permission
		await db.insert(forumPermissions).values({
			forumId: testForumId,
			role: 'moderator',
			canRead: true,
			canPost: true,
			canModerate: true,
		});

		const result = await canPost(db, testForumId, testUser);
		expect(result).toBe(true);
	});
});
