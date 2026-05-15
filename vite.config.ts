import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Required for WSL2 on Windows filesystem mounts (/mnt/e/...)
		watch: {
			usePolling: true,
			interval: 500
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
