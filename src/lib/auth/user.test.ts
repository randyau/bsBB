import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the logic of claimFirstAdmin by observing what DB calls it makes.
// The implementation does one atomic insert-on-conflict (conditional on value='false')
// to decide the claim, then update users + insert mod_log only if the claim succeeded.

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

function mockClaimInsert(returningRows: object[]) {
	mockInsert.mockReturnValueOnce({
		values: vi.fn().mockReturnValue({
			onConflictDoUpdate: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue(returningRows),
			}),
		}),
	});
}

function mockUpdateChain() {
	return {
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	};
}

describe('claimFirstAdmin', () => {
	it('returns true and promotes when the atomic claim succeeds', async () => {
		mockClaimInsert([{ key: 'first_admin_claimed' }]);
		mockUpdate.mockReturnValue(mockUpdateChain());
		mockInsert.mockReturnValueOnce({ values: vi.fn().mockResolvedValue(undefined) }); // mod_log

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(true);
		expect(mockInsert).toHaveBeenCalledTimes(2); // instanceSettings claim + mod_log
		expect(mockUpdate).toHaveBeenCalledTimes(1); // users
	});

	it('returns false when the claim was already taken (no row returned)', async () => {
		mockClaimInsert([]);

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(false);
		expect(mockUpdate).not.toHaveBeenCalled();
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
