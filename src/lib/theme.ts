import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

function createThemeStore() {
	// Get stored theme from localStorage if available
	let initialTheme: Theme = 'dark';

	if (typeof window !== 'undefined') {
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme === 'light' || storedTheme === 'dark') {
			initialTheme = storedTheme;
		}
	}
	const { subscribe, set } = writable<Theme>(initialTheme);

	return {
		subscribe,
		set: (theme: Theme) => {
			set(theme);
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', theme);
				document.documentElement.setAttribute('data-theme', theme);
			}
		},
		toggle: () => {
			let current: Theme = 'dark';
			const unsubscribe = subscribe(t => { current = t; });
			unsubscribe();
			const newTheme = current === 'light' ? 'dark' : 'light';
			set(newTheme);
			if (typeof window !== 'undefined') {
				localStorage.setItem('theme', newTheme);
				document.documentElement.setAttribute('data-theme', newTheme);
			}
		}
	};
}

export const theme = createThemeStore();
