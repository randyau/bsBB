import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the logic of claimFirstAdmin by observing what DB calls it makes.
// The implementation does: select → (insert or update) → update users → insert mod_log

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock('$lib/db/index.js', () => ({
	db: {
		select: mockSelect,
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

function mockSelectReturning(rows: object[]) {
	mockSelect.mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				limit: vi.fn().mockResolvedValue(rows),
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
	it('returns true and promotes when setting does not exist yet', async () => {
		// Setting absent — will insert it, then update users + insert mod_log
		mockSelectReturning([]);
		mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
		mockUpdate.mockReturnValue(mockUpdateChain());

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(true);
		expect(mockInsert).toHaveBeenCalledTimes(2); // instanceSettings + mod_log
		expect(mockUpdate).toHaveBeenCalledTimes(1);  // users
	});

	it('returns true and promotes when setting exists but is false', async () => {
		// Setting present as 'false' — will update it, then update users + insert mod_log
		mockSelectReturning([{ value: 'false' }]);
		mockUpdate.mockReturnValue(mockUpdateChain());
		mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(true);
		expect(mockUpdate).toHaveBeenCalledTimes(2); // instanceSettings + users
		expect(mockInsert).toHaveBeenCalledTimes(1); // mod_log
	});

	it('returns false when first_admin_claimed is already true', async () => {
		// Setting present as 'true' — bail out immediately
		mockSelectReturning([{ value: 'true' }]);

		const result = await claimFirstAdmin('did:plc:abc');
		expect(result).toBe(false);
		expect(mockInsert).not.toHaveBeenCalled();
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
