import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB so tests don't need a live Postgres connection
vi.mock('$lib/db/index.js', () => ({
	db: {
		insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				innerJoin: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
		}),
		update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
		delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
	},
}));

vi.mock('$lib/db/schema.js', () => ({
	sessions: {},
	users: {},
}));

// Import after mocks
const { createSession, validateSession, invalidateSession } = await import('./session.js');

describe('session token properties', () => {
	it('createSession returns a 64-char hex token', async () => {
		const token = await createSession('did:plc:test');
		expect(token).toMatch(/^[0-9a-f]{64}$/);
	});

	it('createSession returns a different token each call', async () => {
		const t1 = await createSession('did:plc:test');
		const t2 = await createSession('did:plc:test');
		expect(t1).not.toBe(t2);
	});
});

describe('validateSession', () => {
	it('returns null when session is not found in DB', async () => {
		const result = await validateSession('deadbeef'.repeat(8));
		expect(result).toBeNull();
	});
});

describe('invalidateSession', () => {
	it('calls db.delete without throwing', async () => {
		await expect(invalidateSession('somehash')).resolves.not.toThrow();
	});
});
