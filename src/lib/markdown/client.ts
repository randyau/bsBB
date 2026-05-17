import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { emojify } from 'node-emoji';

const md = new MarkdownIt({
	html: false,
	breaks: true,
	linkify: true,
	typographer: false,
});

export function renderMarkdownClient(markdown: string): string {
	if (!markdown.trim()) return '';

	try {
		// Pre-process: expand quote markers to placeholder (will be replaced on server)
		let processed = markdown.replace(/>!quote\s+([a-f0-9-]+)/g, '> **[Post quoted — will show author on submit]**');

		// Parse markdown to HTML
		let html = md.render(processed);

		// Convert emoji shortcodes to unicode emoji (e.g., :wave: → 👋)
		html = emojify(html);

		// Sanitize the HTML to prevent XSS
		const sanitized = DOMPurify.sanitize(html, {
			ALLOWED_TAGS: [
				'p',
				'br',
				'strong',
				'em',
				'u',
				'h1',
				'h2',
				'h3',
				'h4',
				'h5',
				'h6',
				'ul',
				'ol',
				'li',
				'blockquote',
				'code',
				'pre',
				'a',
				'img',
				'table',
				'thead',
				'tbody',
				'tr',
				'th',
				'td',
				'hr',
			],
			ALLOWED_ATTR: ['href', 'title', 'src', 'alt'],
			KEEP_CONTENT: true,
		});

		return sanitized;
	} catch (err) {
		console.error('[markdown render error]', err);
		return '<p style="color: red;">Failed to render preview</p>';
	}
}
