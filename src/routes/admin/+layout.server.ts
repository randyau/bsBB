import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user?.did) {
		throw error(403, 'Not authenticated');
	}

	if (locals.user.globalRole !== 'admin') {
		throw error(403, 'Admin access required');
	}

	return {
		user: locals.user
	};
};
