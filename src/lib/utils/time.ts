export function formatTime(date: Date | string): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return new Date(date).toLocaleDateString();
}

export function formatDate(date: Date | string): string {
	const d = new Date(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatAbsoluteTime(date: Date | string, timezone?: string): string {
	const d = new Date(date);
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
	// en-CA gives "YYYY-MM-DD, HH:MM" — normalise to "YYYY-MM-DD HH:MM"
	return fmt.format(d).replace(', ', ' ');
}

export function formatTimeWithAbsolute(
	date: Date | string,
	timezone?: string,
): { relative: string; absolute: string } {
	return {
		relative: formatTime(date),
		absolute: formatAbsoluteTime(date, timezone),
	};
}

export function formatTimeDisplay(date: Date | string, timezone?: string): string {
	const time = formatTimeWithAbsolute(date, timezone);
	return `${time.absolute} (${time.relative})`;
}
