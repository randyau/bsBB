import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { isModerator } from '$lib/auth/roles.js';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user?.did) {
		throw error(403, 'Not authenticated');
	}

	if (!isModerator(locals.user)) {
		throw error(403, 'Moderator access required');
	}

	return {
		user: locals.user
	};
};
