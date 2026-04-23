<script lang="ts">
	import { supabase } from '$lib/supabase';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let loading = $state(false);

	async function signIn(e: Event) {
		e.preventDefault();
		loading = true;
		error = null;
		const { error: err } = await supabase.auth.signInWithPassword({ email, password });
		if (err) {
			error = err.message;
			loading = false;
		}
		// On success, onAuthStateChange in +layout.svelte handles the redirect
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-ctp-base">
	<form onsubmit={signIn} class="w-full max-w-sm rounded-xl bg-ctp-mantle p-8 shadow-xl">
		<h1 class="mb-6 text-center text-xl font-semibold text-ctp-text">My Students</h1>

		{#if error}
			<div class="mb-4 rounded-lg bg-ctp-red/10 px-4 py-3 text-sm text-ctp-red">
				{error}
			</div>
		{/if}

		<div class="space-y-4">
			<div>
				<label for="email" class="mb-1 block text-xs font-medium text-ctp-subtext0">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					class="w-full rounded px-3 py-2 text-sm"
					required
					autocomplete="email"
				/>
			</div>
			<div>
				<label for="password" class="mb-1 block text-xs font-medium text-ctp-subtext0"
					>Password</label
				>
				<input
					id="password"
					type="password"
					bind:value={password}
					class="w-full rounded px-3 py-2 text-sm"
					required
					autocomplete="current-password"
				/>
			</div>
		</div>

		<button
			type="submit"
			disabled={loading}
			class="mt-6 w-full rounded bg-ctp-blue py-2 text-sm font-medium text-ctp-crust transition-colors hover:opacity-90 disabled:opacity-50"
		>
			{loading ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</div>
