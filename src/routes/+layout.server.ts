import type { LayoutServerLoad, Actions } from './$types.js';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/db';
import { userNotifications } from '$lib/db/schema';
import { and, eq, count } from 'drizzle-orm';
import { getSetting, getSettings } from '$lib/settings';
import { invalidateSession, deleteSessionCookie } from '$lib/auth/session.js';

export const actions: Actions = {
	logout: async ({ locals, cookies }) => {
		const { sessionId } = locals;
		if (sessionId) {
			await invalidateSession(sessionId);
		}
		deleteSessionCookie({ cookies } as any);
		redirect(302, '/');
	},
};

export const load: LayoutServerLoad = async ({ locals }) => {
	let unreadNotificationCount = 0;

	if (locals.user) {
		const [result] = await db
			.select({ count: count() })
			.from(userNotifications)
			.where(and(
				eq(userNotifications.recipientDid, locals.user.did),
				eq(userNotifications.isRead, false),
			));
		unreadNotificationCount = result?.count ?? 0;
	}

	const settings = await getSettings([
		'site_name',
		'favicon_url',
		'theme_primary_light',
		'theme_primary_dark',
		'custom_css',
		'font_body',
	]);

	// Generate theme override CSS if primary colors are customized
	let themeOverrideCss = '';
	if (settings.theme_primary_light || settings.theme_primary_dark) {
		themeOverrideCss = ':root {';
		if (settings.theme_primary_light) {
			themeOverrideCss += `\n  [data-theme="light"] { --color-primary: ${settings.theme_primary_light}; }`;
		}
		if (settings.theme_primary_dark) {
			themeOverrideCss += `\n  [data-theme="dark"] { --color-primary: ${settings.theme_primary_dark}; }`;
		}
		themeOverrideCss += '\n}';
	}

	return {
		user: locals.user,
		unreadNotificationCount,
		siteName: settings.site_name,
		faviconUrl: settings.favicon_url,
		themeOverrideCss,
		customCss: settings.custom_css,
		fontBody: settings.font_body,
	};
};
