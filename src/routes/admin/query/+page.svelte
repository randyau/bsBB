<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import AdminPageShell from '$components/AdminPageShell.svelte';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();
	let query: string = $state('SELECT * FROM users LIMIT 10;');
	let isLoading: boolean = $state(false);
</script>

<AdminPageShell title="SQL Query Runner" {form}>
	<div class="space-y-6">
		<div class="rounded border border-[rgb(var(--color-warning))] bg-[rgb(var(--color-warning))]/10 px-4 py-3 text-sm" role="alert">
			<p class="font-semibold text-[rgb(var(--color-warning-text,var(--color-text)))]">Security notice</p>
			<p class="mt-1 text-[rgb(var(--color-text-secondary))]">
				This tool executes raw SQL and returns all matching rows. Results may include sensitive data
				including session token hashes and encrypted chat tokens. All queries are logged to the
				moderation audit log.
			</p>
		</div>
		<p class="text-[rgb(var(--color-text-secondary))] text-sm">SELECT queries only. Max 1000 rows, 5 second timeout.</p>

		<form method="POST" use:enhance action="?/run" class="space-y-4">
			<div>
				<label for="query" class="block text-sm font-semibold mb-2">SQL Query</label>
				<textarea
					id="query"
					name="query"
					bind:value={query}
					disabled={isLoading}
					placeholder="SELECT * FROM users LIMIT 10;"
					rows="8"
					class="w-full px-3 py-2 border border-[rgb(var(--color-border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] font-mono text-sm disabled:opacity-50"
				></textarea>
				<div class="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
					<p>Safe queries: SELECT * FROM users, SELECT * FROM posts, SELECT * FROM threads</p>
					<p>Stacked queries (X; Y;) are blocked. Only the last query executes.</p>
				</div>
			</div>

			<div class="flex gap-2">
				<button
					type="submit"
					disabled={isLoading}
					class="bg-[rgb(var(--color-primary))] text-white px-6 py-2 rounded-lg hover:bg-[rgb(var(--color-primary-dark))] disabled:opacity-50"
				>
					{isLoading ? 'Running...' : 'Execute'}
				</button>
				<button
					type="button"
					onclick={() => (query = '')}
					disabled={isLoading}
					class="px-4 py-2 border border-[rgb(var(--color-border))] rounded-lg hover:bg-[rgb(var(--color-bg-secondary))] disabled:opacity-50"
				>
					Clear
				</button>
			</div>
		</form>

		{#if form?.success}
			<div class="space-y-4">
				<div class="alert alert-success">
					<p class="text-sm">
						✓ Query executed in {form.executionMs}ms, returned {form.rowCount} row{form.rowCount !== 1 ? 's' : ''}
					</p>
				</div>

				{#if form.rows && form.rows.length > 0}
					<div class="table-container">
						<table class="w-full text-sm">
							<thead class="table-thead">
								<tr>
									{#each form.columns as col}
										<th class="px-4 py-2 text-left font-semibold">{col}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each form.rows as row}
									<tr class="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-bg-secondary))]">
										{#each form.columns as col}
											<td class="px-4 py-2 font-mono text-xs">
												{JSON.stringify(row[col]).substring(0, 100)}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="box-secondary p-4">
						<p class="text-sm text-[rgb(var(--color-text-secondary))]">No rows returned.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</AdminPageShell>
