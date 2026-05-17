import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { emojify } from 'node-emoji';
import { posts, users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { db } from '$lib/db';

type Db = typeof db;

export async function expandQuoteMarkers(markdown: string, database?: Db): Promise<string> {
	if (!database) return markdown;

	// Replace >!quote uuid with a formatted header
	const quoteRegex = />!quote\s+([a-f0-9-]+)/g;
	let result = markdown;
	const matches = [...markdown.matchAll(quoteRegex)];

	for (const match of matches) {
		const postId = match[1];
		const post = await database.query.posts.findFirst({
			where: eq(posts.id, postId),
			columns: { authorDid: true },
		});

		if (post) {
			// Query the author separately
			const author = await database.query.users.findFirst({
				where: eq(users.did, post.authorDid),
				columns: { handle: true, displayName: true },
			});

			const authorDisplay = author?.displayName || author?.handle || 'Unknown';
			const replacement = `> **Quoting ${authorDisplay}** [post](#post-${postId})`;
			result = result.replace(match[0], replacement);
		}
	}

	return result;
}

export async function renderMarkdown(markdown: string, database?: Db): Promise<string> {
	// Expand quote markers first
	const expanded = await expandQuoteMarkers(markdown, database);

	const result = await unified()
		.use(remarkParse)
		.use(remarkRehype)
		.use(rehypeSanitize)
		.use(rehypeStringify)
		.process(expanded);

	let html = String(result);

	// Convert emoji shortcodes to unicode emoji (e.g., :wave: → 👋)
	html = emojify(html);

	return html;
}
