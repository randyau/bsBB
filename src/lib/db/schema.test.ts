import { describe, it, expect } from 'vitest';
import * as schema from './schema.js';

describe('schema exports', () => {
	const expectedTables = [
		'users',
		'forums',
		'threads',
		'posts',
		'postRevisions',
		'forumPermissions',
		'userForumRoles',
		'notificationQueue',
		'modLog',
		'sessions',
		'instanceSettings',
		'rateLimitBuckets',
	];

	for (const name of expectedTables) {
		it(`exports table: ${name}`, () => {
			expect(schema).toHaveProperty(name);
			expect(schema[name as keyof typeof schema]).toBeDefined();
		});
	}
});
