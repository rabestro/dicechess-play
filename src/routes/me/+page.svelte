<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { localGamesStore } from '$lib/stores/localGamesStore.svelte';
	import {
		buildPlayerRecord,
		totalGames,
		winRate,
		outcomeShares,
		type OutcomeCounts,
	} from '$lib/stats/playerRecord';

	onMount(() => {
		void localGamesStore.load();
	});

	const record = $derived(buildPlayerRecord(localGamesStore.games));
	const overallTotal = $derived(totalGames(record.overall));
</script>

{#snippet wdlBar(counts: OutcomeCounts)}
	{@const shares = outcomeShares(counts)}
	<div class="flex h-2 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
		<div class="bg-primary" style="width: {shares.win * 100}%"></div>
		<div class="bg-content-muted/40" style="width: {shares.draw * 100}%"></div>
		<div class="bg-danger" style="width: {shares.loss * 100}%"></div>
	</div>
{/snippet}

{#snippet counts(c: OutcomeCounts)}
	<span class="font-mono text-sm text-content-muted whitespace-nowrap">
		<span class="text-primary font-bold">{c.wins}W</span>
		· {c.draws}D ·
		<span class="text-danger font-bold">{c.losses}L</span>
	</span>
{/snippet}

<section class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold text-content">Your profile</h2>
		<p class="text-sm text-content-muted">Your record against the bots on this device.</p>
	</div>

	{#if !localGamesStore.loaded && !localGamesStore.error}
		<div class="h-32 rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
	{:else if localGamesStore.error && overallTotal === 0}
		<div class="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
			Couldn't load your record: {localGamesStore.error}
		</div>
	{:else if overallTotal === 0}
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
		<div class="rounded-2xl border border-border bg-surface/60 p-6 flex flex-col gap-4">
			<div class="flex items-end justify-between gap-4">
				<div class="flex flex-col">
					<span class="text-4xl font-black text-content tabular-nums">
						{Math.round(winRate(record.overall) * 100)}%
					</span>
					<span class="text-xs font-bold uppercase tracking-wider text-content-muted">win rate</span
					>
				</div>
				<div class="flex flex-col items-end gap-1">
					{@render counts(record.overall)}
					<span class="text-xs text-content-muted">{overallTotal} games</span>
				</div>
			</div>
			{@render wdlBar(record.overall)}
		</div>

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-bold uppercase tracking-wider text-content-muted">By opponent</h3>
			{#each record.perBot as bot (bot.algorithm)}
				<div class="rounded-xl border border-border bg-surface/40 p-4 flex flex-col gap-2">
					<div class="flex items-center justify-between gap-3">
						<span class="font-bold text-content truncate">{bot.label}</span>
						<div class="flex items-center gap-3 shrink-0">
							{@render counts(bot)}
							<span class="font-mono text-sm font-bold text-content tabular-nums w-10 text-right">
								{Math.round(winRate(bot) * 100)}%
							</span>
						</div>
					</div>
					{@render wdlBar(bot)}
				</div>
			{/each}
		</div>
	{/if}
</section>
