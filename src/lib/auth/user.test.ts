import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the logic of claimFirstAdmin by observing what DB calls it makes.
// The key invariant: it uses a conditional UPDATE so only one caller ever wins.

const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('$lib/db/index.js', () => ({
	db: {
		insert: mockInsert,
		update: mockUpdate,
	},
}));
vi.mock('$lib/db/schema.js', () => ({
	users: { did: 'did' },
	instanceSettings: { key: 'key', value: 'value' },
	modLog: {},
}));

const { claimFirstAdmin, upsertUser } = await import('./user.js');

beforeEach(() => {
	vi.clearAllMocks();
});

describe('claimFirstAdmin', () => {
	it('returns true and promotes when first_admin_claimed is false', async () => {
		// Simulate UPDATE returning one row (the flag was 'false' and got set to 'true')
		mockUpdate.mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ key: 'first_admin_claimed' }]),
				}),
			}),
		});
		mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(true);
		// Should have updated users table (promote to admin) and inserted mod_log
		expect(mockUpdate).toHaveBeenCalledTimes(2); // instanceSettings + users
		expect(mockInsert).toHaveBeenCalledTimes(1); // mod_log
	});

	it('returns false when first_admin_claimed is already true', async () => {
		// Simulate UPDATE returning no rows (condition not met — already claimed)
		mockUpdate.mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([]),
				}),
			}),
		});

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(false);
		expect(mockInsert).not.toHaveBeenCalled();
	});
});

describe('upsertUser', () => {
	it('calls db.insert with onConflictDoUpdate', async () => {
		const mockOnConflict = vi.fn().mockResolvedValue(undefined);
		mockInsert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				onConflictDoUpdate: mockOnConflict,
			}),
		});

		await upsertUser('did:plc:test', { did: 'did:plc:test', handle: 'alice.bsky.social' });

		expect(mockInsert).toHaveBeenCalled();
		expect(mockOnConflict).toHaveBeenCalledWith(
			expect.objectContaining({ target: expect.anything() })
		);
	});
});
