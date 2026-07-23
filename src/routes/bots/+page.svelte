<script lang="ts">
	import { resolve } from '$app/paths';
	import { isLiveEnabled } from '$lib/live/liveApi';
	import { fetchCatalog, type CatalogBot } from '$lib/catalog/catalogApi';
	import BotCatalogCard from '../../components/BotCatalogCard.svelte';

	// The human-play bot catalog (ADR-0014): a read-only list over play-api's public GET
	// /lobby/bots. One fetch per visit — like the leaderboard, catalog membership doesn't change
	// fast enough to be worth polling; each card wakes and plays its own bot independently.

	let bots = $state<CatalogBot[]>([]);
	let loaded = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!isLiveEnabled()) return;
		let alive = true;
		fetchCatalog()
			.then((catalog) => {
				if (alive) {
					bots = catalog.bots;
					loaded = true;
					error = null;
				}
			})
			.catch(() => {
				if (alive) error = 'The bot catalog is unavailable right now — try again in a minute.';
			});
		return () => {
			alive = false;
		};
	});
</script>

<svelte:head>
	<title>Play a Bot — Dice Chess</title>
	<meta
		name="description"
		content="Pick a bot and start a timed game — configure the clock and your colour, then play."
	/>
</svelte:head>

<!-- Container matches the lobby (its reciprocal page, reached from the lobby's "Play a bot →"
     link); the app <main> already supplies vertical padding. -->
<section class="mx-auto flex max-w-4xl flex-col gap-5">
	<div class="flex flex-col gap-2">
		<a
			href={resolve('/lobby')}
			class="w-fit text-sm font-semibold text-content-muted transition-colors hover:text-content"
		>
			← Back to the lobby
		</a>
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold text-content">Play a Bot</h2>
			<p class="text-sm text-content-muted">
				Pick a bot below — clicking wakes it and confirms it's ready before you configure a game.
			</p>
		</div>
	</div>

	{#if !isLiveEnabled()}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			The bot catalog needs a configured play server (<code class="font-mono text-xs"
				>VITE_PLAY_API_URL</code
			>) — it is not available in this build.
		</div>
	{:else if error}
		<div
			class="rounded-2xl border border-danger/40 bg-danger/10 p-6 text-center text-danger"
			role="alert"
		>
			{error}
		</div>
	{:else if !loaded}
		<div
			class="animate-pulse rounded-2xl border border-border bg-surface p-6 text-center text-content-muted"
			aria-live="polite"
		>
			Looking for bots…
		</div>
	{:else if bots.length === 0}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			No bots are available for a human game right now — check back later.
		</div>
	{:else}
		<div class="catalog-grid">
			{#each bots as bot (bot.team + '/' + bot.name)}
				<BotCatalogCard {bot} />
			{/each}
		</div>
	{/if}
</section>

<style>
	.catalog-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
		align-items: start;
	}
	@media (max-width: 640px) {
		.catalog-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}
</style>
