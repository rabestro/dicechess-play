<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { localGamesStore } from '$lib/stores/localGamesStore.svelte';
	import GameHistoryCard from '../../components/GameHistoryCard.svelte';

	onMount(() => {
		void localGamesStore.load();
	});
</script>

<section class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold text-content">Your games</h2>
		<p class="text-sm text-content-muted">Every game you've played on this device.</p>
	</div>

	{#if !localGamesStore.loaded && !localGamesStore.error}
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
			{#each Array.from({ length: 4 }) as _, i (i)}
				<div class="h-40 rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
			{/each}
		</div>
	{:else if localGamesStore.error && localGamesStore.games.length === 0}
		<div class="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
			Couldn't load your games: {localGamesStore.error}
		</div>
	{:else if localGamesStore.games.length === 0}
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
			{#each localGamesStore.games as game (game.id)}
				<GameHistoryCard {game} />
			{/each}
		</div>
	{/if}
</section>
