<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { localGamesStore } from '$lib/stores/localGamesStore.svelte';
	import { playerGamesStore } from '$lib/stores/playerGamesStore.svelte';
	import { playerOpponentsStore } from '$lib/stores/playerOpponentsStore.svelte';
	import { mergeGameHistory } from '$lib/stores/gameHistoryMerge';
	import { paginateGameHistory } from '$lib/stores/gameHistoryPagination';
	import {
		parseGamesFilters,
		serverVsParam,
		filterLocalGames,
		liveGamesVisible,
		opponentOptions,
		computeHeadToHead,
		vsParamValue,
		type GamesFilters,
	} from '$lib/games/gamesFilters';
	import { totalGames } from '$lib/stats/playerRecord';
	import GameHistoryCard from '../../components/GameHistoryCard.svelte';
	import LiveGameHistoryCard from '../../components/LiveGameHistoryCard.svelte';
	import GamesFilterBar from '../../components/GamesFilterBar.svelte';
	import WdlSummaryCard from '../../components/WdlSummaryCard.svelte';
	import BotBadge from '../../components/BotBadge.svelte';

	// "Show more" grows the render cap by one page (#150); 24 renders as 12 rows of the 2-column
	// grid below.
	const PAGE_SIZE = 24;

	onMount(() => {
		void localGamesStore.load();
		void playerOpponentsStore.load();
	});

	// The query string is the source of truth for every filter (#151) — shareable, back-button
	// friendly. Re-parsed reactively; a filter-only navigation never remounts this page (same
	// route), so this is the only thing that notices the change.
	const filters = $derived(parseGamesFilters(page.url));

	// vs/result narrow the *live* half on the server (#173) — never client-side over an
	// already-fetched page, which would break pagination (sparse pages, wrong hasMore). `source`
	// alone never needs a new request (the server has no notion of it), so this only reloads when
	// the server-relevant signature actually changed — a bare $effect over `filters` would
	// over-fire on every source-only change. reset() discards a request from before the change if
	// it lands after the new one (playerGamesStore's own guard).
	let lastServerFilterKey: string | null = null;
	$effect(() => {
		const vs = serverVsParam(filters.vs);
		const result = filters.result ?? undefined;
		const key = `${vs ?? ''}|${result ?? ''}`;
		if (key === lastServerFilterKey) return;
		lastServerFilterKey = key;
		playerGamesStore.reset();
		void playerGamesStore.load({ vs, result });
	});

	// A newly filtered (or unfiltered) view starts its own reveal progress from the top — including
	// a source-only change, which the effect above deliberately does NOT refetch for.
	let renderCap = $state(PAGE_SIZE);
	$effect(() => {
		void filters;
		renderCap = PAGE_SIZE;
	});

	function updateFilters(next: GamesFilters): void {
		const params = new URLSearchParams();
		if (next.vs) params.set('vs', vsParamValue(next.vs));
		if (next.result) params.set('result', next.result);
		if (next.source) params.set('source', next.source);
		const query = params.toString();
		void goto(query ? resolve(`/games?${query}`) : resolve('/games'), {
			noScroll: true,
			keepFocus: true,
		});
	}

	const hasActiveFilters = $derived(
		filters.vs !== null || filters.result !== null || filters.source !== null,
	);

	// The local list (IndexedDB, near-instant) governs the loading/empty gates below, unchanged
	// from before live games were added: it must render promptly regardless of play-api's health,
	// so nothing here waits on the network fetch. A guest with live games but no local ones may
	// briefly see the empty state until that fetch resolves a moment later — a narrow, self-correcting
	// tradeoff in favour of never blocking the local list on network I/O.
	const filteredLocal = $derived(filterLocalGames(localGamesStore.games, filters));
	const showLive = $derived(liveGamesVisible(filters));
	const effectiveLive = $derived(showLive ? playerGamesStore.games : []);
	// A live fetch failure is treated the same as "nothing more is coming" for boundary purposes
	// (see gameHistoryPagination.ts): a boundary that can never resolve further must not leave
	// local games permanently held back.
	const effectiveHasMore = $derived(
		showLive && !playerGamesStore.error && playerGamesStore.hasMore,
	);
	const history = $derived(mergeGameHistory(filteredLocal, effectiveLive));
	const paginated = $derived(
		paginateGameHistory(history, effectiveLive, effectiveHasMore, renderCap),
	);

	function showMore(): void {
		const needsFetch = paginated.needsFetch;
		renderCap += PAGE_SIZE;
		if (needsFetch) void playerGamesStore.loadMore();
	}

	const options = $derived(opponentOptions(localGamesStore.games, playerOpponentsStore.opponents));

	// The head-to-head summary shown above the list when `vs=` is active — always the true overall
	// record against that opponent, deliberately unaffected by result/source (see
	// computeHeadToHead's own doc comment for why).
	const headToHead = $derived(
		computeHeadToHead(
			filters.vs,
			localGamesStore.games,
			playerOpponentsStore.opponents,
			playerGamesStore.games,
			showLive,
		),
	);

	// "Showing X of N" only when N is exact: a specific opponent (the same total the head-to-head
	// card already shows), or no filters at all (every local game plus the guest's whole lobby
	// total, #174). A result/source-only filter has no cheap exact denominator, so the line just
	// shows a bare count rather than a misleading mismatched one.
	const totalMatchingFilters = $derived.by(() => {
		if (filters.vs) return headToHead ? totalGames(headToHead.counts) : null;
		if (hasActiveFilters) return null;
		const lobbyTotal = playerOpponentsStore.opponents.reduce((sum, o) => sum + o.games, 0);
		return localGamesStore.games.length + lobbyTotal;
	});
</script>

<section class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold text-content">Your games</h2>
		<p class="text-sm text-content-muted">
			Every game you've played — on this device and in the lobby.
		</p>
	</div>

	<GamesFilterBar {filters} {options} onChange={updateFilters} />

	{#if headToHead}
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-2">
				<h3 class="text-lg font-bold text-content">{headToHead.label}</h3>
				{#if headToHead.isBot}<BotBadge />{/if}
			</div>
			<WdlSummaryCard counts={headToHead.counts} />
		</div>
	{/if}

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
			{#if hasActiveFilters}
				<p class="text-content-muted">No games match these filters.</p>
				<button
					type="button"
					onclick={() => updateFilters({ vs: null, result: null, source: null })}
					class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
				>
					Reset filters
				</button>
			{:else}
				<p class="text-content-muted">You haven't played any games yet.</p>
				<a
					href={resolve('/play')}
					class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
				>
					Play your first game →
				</a>
			{/if}
		</div>
	{:else}
		{#if localGamesStore.error}
			<div
				class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center text-xs text-danger"
			>
				Couldn't refresh your games: {localGamesStore.error}
			</div>
		{/if}
		<p class="text-xs text-content-muted">
			Showing {paginated.visible.length}{totalMatchingFilters !== null
				? ` of ${totalMatchingFilters}`
				: ''} game{paginated.visible.length === 1 ? '' : 's'}
		</p>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{#each paginated.visible as item (item.source === 'local' ? item.game.id : item.game.gameId)}
				{#if item.source === 'local'}
					<GameHistoryCard game={item.game} />
				{:else}
					<LiveGameHistoryCard game={item.game} />
				{/if}
			{/each}
		</div>
		{#if paginated.canShowMore}
			<button
				type="button"
				onclick={showMore}
				disabled={playerGamesStore.loading}
				class="self-center px-6 py-2.5 rounded-xl bg-surface border border-border text-content font-bold hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{playerGamesStore.loading ? 'Loading…' : 'Show more'}
			</button>
		{/if}
	{/if}
</section>
