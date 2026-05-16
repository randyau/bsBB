import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Required for WSL2 on Windows filesystem mounts (/mnt/e/...)
		watch: {
			usePolling: true,
			interval: 500
		}
	},
	build: {
		// Disable minification in dev for readable HTML debugging
		minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
