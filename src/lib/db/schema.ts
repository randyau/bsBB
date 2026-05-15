import {
	boolean,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
	did: text('did').primaryKey(),
	handle: text('handle').notNull(),
	displayName: text('display_name'),
	avatarUrl: text('avatar_url'),
	lastProfileSync: timestamp('last_profile_sync', { withTimezone: true }).notNull(),
	globalRole: text('global_role').notNull().default('member'),
	notifyViaBluesky: boolean('notify_via_bluesky').notNull().default(false),
	chatSessionEncrypted: text('chat_session_encrypted'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// forums (self-referential parentId resolved via string column + migration FK)
// ---------------------------------------------------------------------------
export const forums = pgTable('forums', {
	id: uuid('id').primaryKey().defaultRandom(),
	parentId: uuid('parent_id'), // FK to forums(id) added in migration SQL
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	slug: text('slug').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// threads
// ---------------------------------------------------------------------------
export const threads = pgTable(
	'threads',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		forumId: uuid('forum_id')
			.notNull()
			.references(() => forums.id),
		authorDid: text('author_did')
			.notNull()
			.references(() => users.did),
		title: text('title').notNull(),
		slug: text('slug').notNull(),
		isLocked: boolean('is_locked').notNull().default(false),
		isPinned: boolean('is_pinned').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		lastPostAt: timestamp('last_post_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique().on(t.forumId, t.slug)],
);

// ---------------------------------------------------------------------------
// posts (self-referential replyToPostId resolved in migration SQL)
// ---------------------------------------------------------------------------
export const posts = pgTable('posts', {
	id: uuid('id').primaryKey().defaultRandom(),
	threadId: uuid('thread_id')
		.notNull()
		.references(() => threads.id),
	authorDid: text('author_did')
		.notNull()
		.references(() => users.did),
	bodyMarkdown: text('body_markdown').notNull(),
	bodyHtml: text('body_html').notNull(),
	replyToPostId: uuid('reply_to_post_id'), // FK to posts(id) added in migration SQL
	linkMetadata: jsonb('link_metadata'),
	isDeleted: boolean('is_deleted').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	editedAt: timestamp('edited_at', { withTimezone: true }),
	// body_tsv TSVECTOR GENERATED ALWAYS AS ... is added as raw SQL in migration
});

// ---------------------------------------------------------------------------
// post_revisions
// ---------------------------------------------------------------------------
export const postRevisions = pgTable(
	'post_revisions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		postId: uuid('post_id')
			.notNull()
			.references(() => posts.id),
		revisionNumber: integer('revision_number').notNull(),
		bodyMarkdown: text('body_markdown').notNull(),
		bodyHtml: text('body_html').notNull(),
		editedByDid: text('edited_by_did')
			.notNull()
			.references(() => users.did),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique().on(t.postId, t.revisionNumber)],
);

// ---------------------------------------------------------------------------
// forum_permissions
// ---------------------------------------------------------------------------
export const forumPermissions = pgTable(
	'forum_permissions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		forumId: uuid('forum_id')
			.notNull()
			.references(() => forums.id),
		role: text('role').notNull(),
		canRead: boolean('can_read').notNull().default(false),
		canPost: boolean('can_post').notNull().default(false),
		canModerate: boolean('can_moderate').notNull().default(false),
	},
	(t) => [unique().on(t.forumId, t.role)],
);

// ---------------------------------------------------------------------------
// user_forum_roles
// ---------------------------------------------------------------------------
export const userForumRoles = pgTable('user_forum_roles', {
	userDid: text('user_did')
		.notNull()
		.references(() => users.did),
	forumId: uuid('forum_id')
		.notNull()
		.references(() => forums.id),
	role: text('role').notNull(),
	assignedBy: text('assigned_by')
		.notNull()
		.references(() => users.did),
	assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// notification_queue
// ---------------------------------------------------------------------------
export const notificationQueue = pgTable('notification_queue', {
	id: uuid('id').primaryKey().defaultRandom(),
	recipientDid: text('recipient_did')
		.notNull()
		.references(() => users.did),
	type: text('type').notNull(),
	payload: jsonb('payload').notNull(),
	status: text('status').notNull().default('pending'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	sentAt: timestamp('sent_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// mod_log
// ---------------------------------------------------------------------------
export const modLog = pgTable('mod_log', {
	id: uuid('id').primaryKey().defaultRandom(),
	moderatorDid: text('moderator_did')
		.notNull()
		.references(() => users.did),
	action: text('action').notNull(),
	targetDid: text('target_did').references(() => users.did),
	targetPostId: uuid('target_post_id').references(() => posts.id),
	targetThreadId: uuid('target_thread_id').references(() => threads.id),
	targetForumId: uuid('target_forum_id').references(() => forums.id),
	reason: text('reason'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// sessions (Lucia-managed)
// ---------------------------------------------------------------------------
export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userDid: text('user_did')
		.notNull()
		.references(() => users.did),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// instance_settings
// ---------------------------------------------------------------------------
export const instanceSettings = pgTable('instance_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

// ---------------------------------------------------------------------------
// rate_limit_buckets
// ---------------------------------------------------------------------------
export const rateLimitBuckets = pgTable('rate_limit_buckets', {
	key: text('key').primaryKey(),
	count: integer('count').notNull().default(0),
	windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});
