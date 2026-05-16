<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let form: ActionData = $state(undefined);
	let query: string = $state('SELECT * FROM users LIMIT 10;');
	let isLoading: boolean = $state(false);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold mb-2">SQL Query Runner</h1>
		<p class="text-gray-600 text-sm">SELECT queries only. Max 1000 rows, 5 second timeout.</p>
	</div>

	{#if form?.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">
			{form.error}
		</div>
	{/if}

	<form method="POST" action="?/run" class="space-y-4">
		<div>
			<label for="query" class="block text-sm font-semibold mb-2">SQL Query</label>
			<textarea
				id="query"
				name="query"
				bind:value={query}
				disabled={isLoading}
				placeholder="SELECT * FROM users LIMIT 10;"
				rows="8"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm disabled:opacity-50"
			></textarea>
			<div class="mt-2 text-xs text-gray-500">
				<p>Safe queries: SELECT * FROM users, SELECT * FROM posts, SELECT * FROM threads</p>
				<p>Stacked queries (X; Y;) are blocked. Only the last query executes.</p>
			</div>
		</div>

		<div class="flex gap-2">
			<button
				type="submit"
				disabled={isLoading}
				class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
			>
				{isLoading ? 'Running...' : 'Execute'}
			</button>
			<button
				type="button"
				onclick={() => (query = '')}
				disabled={isLoading}
				class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
			>
				Clear
			</button>
		</div>
	</form>

	{#if form?.success}
		<div class="space-y-4">
			<div class="rounded-lg bg-green-50 border border-green-200 p-4">
				<p class="text-sm text-green-800">
					✓ Query executed in {form.executionMs}ms, returned {form.rowCount} row{form.rowCount !== 1 ? 's' : ''}
				</p>
			</div>

			{#if form.rows && form.rows.length > 0}
				<div class="rounded-lg border border-gray-200 overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-100 border-b border-gray-200">
							<tr>
								{#each form.columns as col}
									<th class="px-4 py-2 text-left font-semibold">{col}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each form.rows as row}
								<tr class="border-b border-gray-200 hover:bg-gray-50">
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
				<div class="rounded-lg bg-gray-50 border border-gray-200 p-4">
					<p class="text-sm text-gray-600">No rows returned.</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
