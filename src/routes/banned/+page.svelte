<svelte:head>
	<title>Account Banned — bsBB</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center">
	<div class="max-w-md space-y-4 p-8 text-center">
		<h1 class="text-2xl font-bold">Account Suspended</h1>
		<p class="text-gray-600">
			Your account has been suspended from this forum. If you believe this is an error,
			please contact the forum administrators.
		</p>
		<form method="POST" action="/logout">
			<button type="submit" class="rounded bg-gray-200 px-4 py-2 hover:bg-gray-300">
				Sign out
			</button>
		</form>
	</div>
</main>
