<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { store } from '$lib/store.svelte';

	let { children } = $props();
	let ready = $state(false);

	$effect(() => {
		let sub: { unsubscribe(): void } | null = null;

		(async () => {
			const {
				data: { session }
			} = await supabase.auth.getSession();

			if (session) {
				await store.init(session.user.id);
				ready = true;
			} else if (window.location.pathname === '/login') {
				ready = true;
			} else {
				await goto('/login');
				ready = true;
			}

			const {
				data: { subscription }
			} = supabase.auth.onAuthStateChange(async (event, session) => {
				if (event === 'SIGNED_OUT') {
					store.clear();
					goto('/login');
				} else if (event === 'SIGNED_IN' && session && window.location.pathname === '/login') {
					await store.init(session.user.id);
					goto('/');
				}
			});
			sub = subscription;
		})();

		return () => sub?.unsubscribe();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if ready}
	{@render children()}
{:else}
	<div class="flex min-h-screen items-center justify-center bg-ctp-base">
		<p class="text-sm text-ctp-overlay0">Loading…</p>
	</div>
{/if}
