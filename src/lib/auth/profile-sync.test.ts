import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/db/index.js', () => ({
	db: {
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
		}),
	},
}));
vi.mock('$lib/db/schema.js', () => ({ users: {} }));

const { maybeSyncProfile } = await import('./profile-sync.js');

describe('maybeSyncProfile', () => {
	it('skips sync when last sync was < 24h ago', async () => {
		const recent = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h ago
		const fetchSpy = vi.spyOn(global, 'fetch');
		await maybeSyncProfile('did:plc:test', recent);
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});

	it('triggers sync when last sync was > 24h ago (fire-and-forget, does not throw)', async () => {
		const old = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
		vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
		// Should not throw even if fetch returns unexpected data
		await expect(maybeSyncProfile('did:plc:test', old)).resolves.not.toThrow();
		vi.restoreAllMocks();
	});
});
