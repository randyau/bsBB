import { redirect } from '@sveltejs/kit';
import { getAllSettings, setSetting } from '$lib/settings';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || locals.user.globalRole !== 'admin') {
		redirect(302, '/');
	}

	const allSettings = await getAllSettings();
	return {
		settings: allSettings,
	};
};

export const actions: Actions = {
	set: async ({ request, locals }) => {
		if (!locals.user || locals.user.globalRole !== 'admin') {
			return { error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const key = formData.get('key') as string;
		const value = formData.get('value') as string;

		if (!key) {
			return { error: 'Missing key' };
		}

		await setSetting(key, value ?? '');

		return { success: true };
	},
};
