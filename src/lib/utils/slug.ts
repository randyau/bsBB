// Converts a title string into a URL-safe slug.
export function slugify(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}
