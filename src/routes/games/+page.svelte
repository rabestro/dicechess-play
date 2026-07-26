<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { localGamesStore } from '$lib/stores/localGamesStore.svelte';
	import { playerGamesStore } from '$lib/stores/playerGamesStore.svelte';
	import { mergeGameHistory } from '$lib/stores/gameHistoryMerge';
	import GameHistoryCard from '../../components/GameHistoryCard.svelte';
	import LiveGameHistoryCard from '../../components/LiveGameHistoryCard.svelte';

	onMount(() => {
		void localGamesStore.load();
		void playerGamesStore.load();
	});

	// The local list (IndexedDB, near-instant) governs the loading/empty gates below, unchanged
	// from before live games were added: it must render promptly regardless of play-api's health,
	// so nothing here waits on the network fetch. A guest with live games but no local ones may
	// briefly see the empty state until that fetch resolves a moment later — a narrow, self-correcting
	// tradeoff in favour of never blocking the local list on network I/O.
	const history = $derived(mergeGameHistory(localGamesStore.games, playerGamesStore.games));
</script>

<section class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold text-content">Your games</h2>
		<p class="text-sm text-content-muted">
			Every game you've played — on this device and in the lobby.
		</p>
	</div>

	<!-- Hoisted above the branches below (rather than duplicated inside the non-empty one): a guest
	     whose local list is empty but who HAS played lobby games must still be told the live fetch
	     failed, not shown a bare "you haven't played any games yet" that contradicts what they know
	     to be true. -->
	{#if playerGamesStore.error}
		<div
			class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center text-xs text-danger"
		>
			{playerGamesStore.error}
		</div>
	{/if}

	{#if !localGamesStore.loaded && !localGamesStore.error}
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
			{#each Array.from({ length: 4 }) as _, i (i)}
				<div class="h-40 rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
			{/each}
		</div>
	{:else if localGamesStore.error && history.length === 0}
		<div class="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
			Couldn't load your games: {localGamesStore.error}
		</div>
	{:else if history.length === 0}
		<div class="flex flex-col items-center gap-4 py-16 text-center">
			<p class="text-content-muted">You haven't played any games yet.</p>
			<a
				href={resolve('/play')}
				class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
			>
				Play your first game →
			</a>
		</div>
	{:else}
		{#if localGamesStore.error}
			<div
				class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center text-xs text-danger"
			>
				Couldn't refresh your games: {localGamesStore.error}
			</div>
		{/if}
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each history as item (item.source === 'local' ? item.game.id : item.game.gameId)}
				{#if item.source === 'local'}
					<GameHistoryCard game={item.game} />
				{:else}
					<LiveGameHistoryCard game={item.game} />
				{/if}
			{/each}
		</div>
	{/if}
</section>
