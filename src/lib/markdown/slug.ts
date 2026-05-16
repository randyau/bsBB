export function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.slice(0, 80)
		.replace(/^-|-$/g, '');
}
