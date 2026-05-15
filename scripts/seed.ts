// Seed script: inserts instance_settings defaults and the General forum.
// Run after migrate.sh on a fresh database.
// Usage: npx tsx scripts/seed.ts

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://forum:forum@localhost:5432/forum';
const sql = postgres(DATABASE_URL);

async function seed() {
	console.log('Seeding instance_settings...');

	// instance_settings rows — ON CONFLICT DO NOTHING so it's safe to re-run
	await sql`
		INSERT INTO instance_settings (key, value) VALUES
			('setup_complete',               'false'),
			('first_admin_claimed',          'false'),
			('default_forum_visibility',     'public'),
			('og_fetch_enabled',             'true'),
			('new_account_cooldown_hours',   '24'),
			('rl_post_submit_per_min',       '10'),
			('rl_post_submit_per_hour',      '60'),
			('rl_thread_create_per_10min',   '3'),
			('rl_thread_create_per_hour',    '10'),
			('rl_login_attempt_per_10min',   '10'),
			('rl_preview_per_min',           '10'),
			('rl_flag_per_10min',            '5')
		ON CONFLICT (key) DO NOTHING
	`;

	console.log('Seeding General forum...');

	await sql`
		INSERT INTO forums (id, name, description, slug, sort_order)
		VALUES (gen_random_uuid(), 'General', 'General discussion', 'general', 0)
		ON CONFLICT (slug) DO NOTHING
	`;

	console.log('Seed complete.');
	await sql.end();
}

seed().catch((err) => {
	console.error('Seed failed:', err);
	process.exit(1);
});
