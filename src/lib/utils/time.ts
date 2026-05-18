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

export function formatAbsoluteTime(date: Date | string, timeZoneOffset?: number): string {
	const d = new Date(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hours = String(d.getHours()).padStart(2, '0');
	const minutes = String(d.getMinutes()).padStart(2, '0');

	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatTimeWithAbsolute(date: Date | string): { relative: string; absolute: string } {
	return {
		relative: formatTime(date),
		absolute: formatAbsoluteTime(date),
	};
}

export function formatTimeDisplay(date: Date | string): string {
	const time = formatTimeWithAbsolute(date);
	return `${time.absolute} (${time.relative})`;
}
