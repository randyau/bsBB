<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import Toast from '$components/Toast.svelte';
	import { enhance } from '$app/forms';
	import MarkdownToolbar from '$components/MarkdownToolbar.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	function rgbToHex(rgb: string): string {
		if (!rgb) return '#3B82F6'; // default blue
		const parts = rgb.trim().split(/\s+/).map(Number);
		if (parts.length !== 3) return '#3B82F6';
		return '#' + parts.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
	}

	function hexToRgb(hex: string): string {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (!result) return '';
		return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
	}

	let submitting = $state(false);
	let toastMessage = $state('');
	let toastType: 'success' | 'error' = $state('success');
	let announcementValue = $state('');

	function handleSubmit() {
		submitting = true;
		toastMessage = 'Saving...';
	}

	$effect(() => {
		announcementValue = data.settings.homepage_announcement ?? '';
	});

	$effect(() => {
		if (form && submitting) {
			submitting = false;
			if (form.error) {
				toastMessage = form.error;
				toastType = 'error';
			} else {
				toastMessage = 'Saved successfully!';
				toastType = 'success';
			}
		}
	});
</script>

<Toast message={toastMessage} type={toastType} />

<div class="p-8">
	<h1 class="page-title mb-8">Forum Settings</h1>

	<!-- Site Name Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">Site Name</h2>
		<form method="POST" action="?/set" onsubmit={handleSubmit} use:enhance>
			<input type="hidden" name="key" value="site_name" />
			<div>
				<label for="site_name" class="form-label">Forum Name</label>
				<input
					type="text"
					id="site_name"
					name="value"
					class="form-control"
					value={data.settings.site_name}
					required
				/>
				<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
					This name appears in the navigation bar and page titles.
				</p>
			</div>
			<button type="submit" class="btn btn-primary mt-4" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save'}
			</button>
		</form>
	</section>

	<!-- Homepage Announcement Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">Homepage Announcement</h2>
		<form method="POST" action="?/set" onsubmit={handleSubmit} use:enhance>
			<input type="hidden" name="key" value="homepage_announcement" />
			<div>
				<label for="announcement" class="form-label">Announcement (Markdown)</label>
				<textarea
					id="announcement"
					name="value"
					class="form-control form-textarea"
					rows="6"
					placeholder="Enter markdown text to display on the homepage. Leave empty to hide."
					bind:value={announcementValue}
				>{data.settings.homepage_announcement}</textarea>
				<MarkdownToolbar value={announcementValue} onEmojiSelect={(emoji) => announcementValue += emoji} />
				<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
					Leave empty to hide the announcement box.
				</p>
			</div>
			<button type="submit" class="btn btn-primary mt-4" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save'}
			</button>
		</form>
	</section>

	<!-- Theme Customization Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">Theme Customization</h2>
		<p class="text-sm text-[rgb(var(--color-text-secondary))] mb-4">
			Customize the primary color and inject global CSS.
		</p>

		<!-- Primary Color Light -->
		<form method="POST" action="?/set" onsubmit={handleSubmit} class="mb-6">
			<input type="hidden" name="key" value="theme_primary_light" />
			<label for="primary_light" class="form-label">Primary Color (Light Theme)</label>
			<div class="flex gap-3 items-end">
				<div class="flex-1">
					<input
						type="color"
						id="primary_light"
						value={rgbToHex(data.settings.theme_primary_light)}
						onchange={(e) => {
							const input = e.currentTarget.form?.querySelector('input[name="value"]') as HTMLInputElement;
							if (input) {
								input.value = hexToRgb(e.currentTarget.value);
							}
						}}
						class="w-20 h-10 border rounded cursor-pointer"
					/>
				</div>
				<input
					type="text"
					name="value"
					class="form-control flex-1"
					placeholder="59 130 246"
					value={data.settings.theme_primary_light}
				/>
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					{submitting ? '...' : 'Save'}
				</button>
			</div>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				Use the color picker or enter as RGB triplet (e.g., 59 130 246). Leave empty to use default.
			</p>
		</form>

		<!-- Primary Color Dark -->
		<form method="POST" action="?/set" onsubmit={handleSubmit} class="mb-6">
			<input type="hidden" name="key" value="theme_primary_dark" />
			<label for="primary_dark" class="form-label">Primary Color (Dark Theme)</label>
			<div class="flex gap-3 items-end">
				<div class="flex-1">
					<input
						type="color"
						id="primary_dark"
						value={rgbToHex(data.settings.theme_primary_dark)}
						onchange={(e) => {
							const input = e.currentTarget.form?.querySelector('input[name="value"]') as HTMLInputElement;
							if (input) {
								input.value = hexToRgb(e.currentTarget.value);
							}
						}}
						class="w-20 h-10 border rounded cursor-pointer"
					/>
				</div>
				<input
					type="text"
					name="value"
					class="form-control flex-1"
					placeholder="59 130 246"
					value={data.settings.theme_primary_dark}
				/>
				<button type="submit" class="btn btn-primary" disabled={submitting}>
					{submitting ? '...' : 'Save'}
				</button>
			</div>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				Use the color picker or enter as RGB triplet (e.g., 59 130 246). Leave empty to use default.
			</p>
		</form>

		<!-- Custom CSS -->
		<form method="POST" action="?/set" onsubmit={handleSubmit} use:enhance>
			<input type="hidden" name="key" value="custom_css" />
			<label for="custom_css" class="form-label">Custom CSS</label>
			<textarea
				id="custom_css"
				name="value"
				class="form-control form-textarea font-mono text-sm"
				rows="8"
				placeholder="Enter custom CSS here. This will be injected globally."
			>{data.settings.custom_css}</textarea>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				⚠️ This CSS will be injected into the page for all visitors. Use with care.
			</p>
			<button type="submit" class="btn btn-primary mt-4" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save'}
			</button>
		</form>
	</section>

	<!-- Favicon Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">Favicon</h2>
		<form method="POST" action="?/set" onsubmit={handleSubmit} use:enhance>
			<input type="hidden" name="key" value="favicon_url" />
			<label for="favicon_url" class="form-label">Favicon URL</label>
			<input
				type="url"
				id="favicon_url"
				name="value"
				class="form-control"
				placeholder="https://example.com/favicon.ico"
				value={data.settings.favicon_url}
			/>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				Enter a full URL to an image file. Leave empty to use the default. Appears in the browser tab.
			</p>
			{#if data.settings.favicon_url}
				<div class="mt-4">
					<p class="text-sm font-semibold mb-2">Preview:</p>
					<img src={data.settings.favicon_url} alt="Favicon" class="w-8 h-8 border rounded" />
				</div>
			{/if}
			<button type="submit" class="btn btn-primary mt-4" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save'}
			</button>
		</form>
	</section>

	<!-- robots.txt Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">robots.txt</h2>
		<form method="POST" action="?/set" onsubmit={handleSubmit} use:enhance>
			<input type="hidden" name="key" value="robots_txt" />
			<label for="robots_txt" class="form-label">robots.txt Content</label>
			<textarea
				id="robots_txt"
				name="value"
				class="form-control form-textarea font-mono text-sm"
				rows="8"
			>{data.settings.robots_txt}</textarea>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				Controls how search engines crawl your site.
				<a href="https://www.robotstxt.org/" target="_blank" rel="noopener" class="underline">
					Learn more
				</a>
			</p>
			<button type="submit" class="btn btn-primary mt-4" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save'}
			</button>
		</form>
	</section>

	<!-- Font Selection Section -->
	<section class="mb-8 card p-6">
		<h2 class="text-xl font-bold mb-4">Font Selection</h2>
		<form method="POST" action="?/set" onsubmit={handleSubmit} use:enhance>
			<input type="hidden" name="key" value="font_body" />
			<label for="font_body" class="form-label">Body Font</label>
			<select id="font_body" name="value" class="form-control">
				<option value="system" selected={data.settings.font_body === 'system'}>
					System Font (default)
				</option>
				<option value="inter" selected={data.settings.font_body === 'inter'}>Inter</option>
				<option value="lora" selected={data.settings.font_body === 'lora'}>Lora</option>
				<option value="source-serif-4" selected={data.settings.font_body === 'source-serif-4'}>
					Source Serif 4
				</option>
				<option value="jetbrains-mono" selected={data.settings.font_body === 'jetbrains-mono'}>
					JetBrains Mono
				</option>
			</select>
			<p class="text-xs text-[rgb(var(--color-text-muted))] mt-2">
				Choose the default font for the forum body text.
			</p>
			<button type="submit" class="btn btn-primary mt-4" disabled={submitting}>
				{submitting ? 'Saving...' : 'Save'}
			</button>
		</form>
	</section>
</div>

<style>
	.card {
		background-color: rgb(var(--color-bg-secondary));
		border: 1px solid rgb(var(--color-border));
	}

	.page-title {
		font-size: var(--text-3xl);
		font-weight: bold;
		color: rgb(var(--color-text));
	}
</style>
