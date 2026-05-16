import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

function createThemeStore() {
	const storedTheme = typeof window !== 'undefined'
		? localStorage.getItem('theme') as Theme | null
		: null;

	const prefersDark = typeof window !== 'undefined'
		? window.matchMedia('(prefers-color-scheme: dark)').matches
		: false;

	const initialTheme = storedTheme || 'dark';
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
			let newTheme: Theme;
			let current: Theme;
			subscribe(t => { current = t; })();
			newTheme = current === 'light' ? 'dark' : 'light';
			localStorage.setItem('theme', newTheme);
			document.documentElement.setAttribute('data-theme', newTheme);
			set(newTheme);
		}
	};
}

export const theme = createThemeStore();
