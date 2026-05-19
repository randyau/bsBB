import { eq } from 'drizzle-orm';
import { db } from './db';
import { instanceSettings } from './db/schema';

export const DEFAULTS = {
	site_name: 'bsBB',
	homepage_announcement: '',
	theme_primary_light: '',
	theme_primary_dark: '',
	custom_css: '',
	favicon_url: '',
	robots_txt: 'User-agent: *\nDisallow:\n',
	font_body: 'system',
} as const;

type SettingKey = keyof typeof DEFAULTS;

export async function getSetting(key: string, fallback: string): Promise<string> {
	const row = await db.query.instanceSettings.findFirst({
		where: eq(instanceSettings.key, key),
	});
	return row?.value ?? fallback;
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
	const rows = await db.query.instanceSettings.findMany({
		where: (table, { inArray }) => inArray(table.key, keys),
	});
	const result: Record<string, string> = {};
	for (const key of keys) {
		const row = rows.find((r) => r.key === key);
		result[key] = row?.value ?? DEFAULTS[key as SettingKey] ?? '';
	}
	return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
	await db
		.insert(instanceSettings)
		.values({ key, value })
		.onConflictDoUpdate({ target: instanceSettings.key, set: { value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
	const rows = await db.query.instanceSettings.findMany();
	const result: Record<string, string> = { ...DEFAULTS };
	for (const row of rows) {
		result[row.key] = row.value;
	}
	return result;
}
