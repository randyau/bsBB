<!--
  TableSearch — reusable search/filter bar for admin tables.

  Two modes:
  - server: renders a GET form that navigates to ?[name]=value (default)
  - client: calls onFilter(value) reactively as the user types (no form submit)

  Props:
  - value: string        current search value (bind or pass data.q)
  - name: string         form field name for server mode (default "q")
  - placeholder: string
  - clearHref: string    href for the Clear button (server mode, e.g. "/admin/users")
  - onFilter: fn         callback for client mode — if provided, switches to client mode
-->
<script lang="ts">
	interface Props {
		value?: string;
		name?: string;
		placeholder?: string;
		clearHref?: string;
		extraParams?: Record<string, string>;
		onFilter?: (v: string) => void;
	}

	let {
		value = $bindable(''),
		name = 'q',
		placeholder = 'Search...',
		clearHref,
		extraParams = {},
		onFilter
	}: Props = $props();

	const clientMode = $derived(typeof onFilter === 'function');

	function handleInput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value;
		value = v;
		onFilter?.(v);
	}
</script>

{#if clientMode}
	<div class="flex gap-2 items-center">
		<label for="table-search-client" class="sr-only">Search</label>
		<input
			id="table-search-client"
			type="text"
			{value}
			oninput={handleInput}
			{placeholder}
			class="form-control flex-1 max-w-sm"
		/>
		{#if value}
			<button
				type="button"
				onclick={() => { value = ''; onFilter?.(''); }}
				class="btn btn-sm btn-secondary"
			>
				Clear
			</button>
		{/if}
	</div>
{:else}
	<form method="GET" class="flex gap-2 items-center">
		{#each Object.entries(extraParams) as [k, v]}
			<input type="hidden" name={k} value={v} />
		{/each}
		<label for="table-search-server" class="sr-only">Search</label>
		<input
			id="table-search-server"
			type="text"
			{name}
			{value}
			{placeholder}
			class="form-control flex-1 max-w-sm"
		/>
		<button type="submit" class="btn btn-sm btn-primary">Search</button>
		{#if value && clearHref}
			<a href={clearHref} class="btn btn-sm btn-secondary">Clear</a>
		{/if}
	</form>
{/if}
