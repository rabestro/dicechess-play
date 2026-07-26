<script lang="ts">
	import { page } from '$app/state';
	import { isLiveEnabled } from '$lib/live/liveApi';
	import { fetchBotProfile, type BotProfile } from '$lib/leaderboard/leaderboardApi';
	import WdlSummaryCard from '../../../../components/WdlSummaryCard.svelte';
	import BotProfileGameCard from '../../../../components/BotProfileGameCard.svelte';
	import BotBadge from '../../../../components/BotBadge.svelte';

	// A bot's public profile (#152 Tier 1) — "almost pure assembly": fetchBotProfile/BotProfile/
	// ProfileRecentGame already existed with zero consumers before this route. This repo's first
	// multi-segment dynamic route; follows the same client-side-fetch-in-$effect pattern
	// games/[id] and live/[id] already establish (no +page.ts load function exists anywhere here).
	// Tier 2 (record vs humans, head-to-head vs other models) and Tier 3 (rating history) are
	// explicitly out of scope — see the issue's own tiering.

	let profile = $state<BotProfile | null>(null);
	let loading = $state(false);
	let notFound = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const team = page.params.team;
		const name = page.params.name;
		profile = null;
		notFound = false;
		error = null;
		if (!team || !name) return;
		if (!isLiveEnabled()) return;
		let alive = true;
		loading = true;
		fetchBotProfile(team, name)
			.then((result) => {
				if (!alive) return;
				profile = result;
			})
			.catch((err: unknown) => {
				if (!alive) return;
				// A 404 means "no such bot" (a stale link, a typo) — a fundamentally different,
				// permanent state from a transient server problem, worth telling apart.
				if (err instanceof Error && err.message.endsWith('404')) notFound = true;
				else error = "This bot's profile isn't available right now.";
			})
			.finally(() => {
				if (alive) loading = false;
			});
		return () => {
			alive = false;
		};
	});

	// Glicko ratings are estimates: whole points are honest enough (the ± shows RD) — same stance
	// as the leaderboard and catalog card, whose exact "±rd / · provisional / left ladder" text
	// conventions this line reuses verbatim.
	const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
</script>

<svelte:head>
	<title>
		{profile ? `${profile.team} ${profile.name}` : 'Bot profile'} — Dice Chess
	</title>
</svelte:head>

<section class="mx-auto flex max-w-2xl flex-col gap-6">
	{#if !isLiveEnabled()}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			Bot profiles need a configured play server (<code class="font-mono text-xs"
				>VITE_PLAY_API_URL</code
			>) — not available in this build.
		</div>
	{:else if loading}
		<div class="h-64 rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
	{:else if notFound}
		<div class="flex flex-col items-center gap-4 py-16 text-center">
			<p class="text-content-muted">
				No bot registered as "{page.params.team}/{page.params.name}".
			</p>
		</div>
	{:else if error}
		<div class="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
			{error}
		</div>
	{:else if profile}
		<div class="flex flex-col gap-1">
			<span class="flex items-center gap-2">
				<h2 class="text-2xl font-bold text-content">{profile.team} {profile.name}</h2>
				<BotBadge sizeClass="text-xs" />
			</span>
			<p class="font-mono text-sm tabular-nums text-content-muted">
				<b class="text-content">{wholeNumber.format(profile.rating)}</b>
				±{wholeNumber.format(profile.rd)}
				{#if profile.provisional}<span class="italic"> · provisional</span>{/if}
				{#if !profile.onLadder}<span class="italic"> · left ladder</span>{/if}
			</p>
		</div>

		<WdlSummaryCard counts={{ wins: profile.wins, draws: profile.draws, losses: profile.losses }} />

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-bold uppercase tracking-wider text-content-muted">Recent games</h3>
			{#if profile.recent.length === 0}
				<p class="py-8 text-center text-content-muted">No recorded games yet.</p>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#each profile.recent as game (game.gameId)}
						<BotProfileGameCard {game} />
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</section>
