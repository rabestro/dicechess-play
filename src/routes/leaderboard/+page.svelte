<script lang="ts">
	import { resolve } from '$app/paths';
	import { isLiveEnabled } from '$lib/live/liveApi';
	import { fetchLeaderboard, type LeaderRow } from '$lib/leaderboard/leaderboardApi';
	import BotBadge from '../../components/BotBadge.svelte';

	// The bot rating ladder (D.3): a read-only board over play-api's public GET /leaderboard.
	// One fetch per visit — ratings move on the server's own batch cadence (about a minute),
	// not per-request, so live polling would only reload identical data.

	let leaders = $state<LeaderRow[]>([]);
	let loaded = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (!isLiveEnabled()) return;
		let alive = true;
		fetchLeaderboard()
			.then((board) => {
				if (alive) {
					leaders = board.leaders;
					loaded = true;
					error = null;
				}
			})
			.catch(() => {
				if (alive) error = 'The leaderboard is unavailable right now — try again in a minute.';
			});
		return () => {
			alive = false;
		};
	});

	// Glicko ratings are estimates: whole points are honest enough for a board (the ± shows RD).
	const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
	const fmt = (value: number): string => wholeNumber.format(value);
</script>

<svelte:head>
	<title>Bot Leaderboard — Dice Chess</title>
	<meta
		name="description"
		content="Glicko-2 rating ladder of Dice Chess bots: server-paired, mirrored-dice rated games."
	/>
</svelte:head>

<section class="mx-auto flex w-full max-w-3xl flex-col gap-5 py-6">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div class="flex flex-col gap-1">
			<h2 class="text-2xl font-bold text-content">Bot Leaderboard</h2>
			<p class="text-sm text-content-muted">
				Glicko-2 ratings from server-paired rated games — same dice for both colours, so luck
				cancels out. New bots stay off the board until their rating converges.
			</p>
		</div>
	</div>

	{#if !isLiveEnabled()}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			The leaderboard needs a configured play server (<code class="font-mono text-xs"
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
			Loading the board…
		</div>
	{:else if leaders.length === 0}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			No rated bots yet — fresh entrants appear here once their rating converges.
		</div>
	{:else}
		<div class="overflow-x-auto rounded-2xl border border-border bg-surface">
			<table class="w-full text-sm">
				<caption class="sr-only">Bots ranked by Glicko-2 rating, best first</caption>
				<thead>
					<tr
						class="border-b border-border text-left text-[11px] font-bold uppercase tracking-wider text-content-muted"
					>
						<th scope="col" class="px-4 py-3 text-right">#</th>
						<th scope="col" class="px-4 py-3">Bot</th>
						<th scope="col" class="px-4 py-3 text-right">Rating</th>
						<th scope="col" class="hidden px-4 py-3 text-right sm:table-cell">Games</th>
						<th scope="col" class="px-4 py-3 text-right">W · D · L</th>
					</tr>
				</thead>
				<tbody>
					{#each leaders as leader (leader.team + '/' + leader.name)}
						<tr
							class="border-b border-border/50 last:border-b-0 {leader.onLadder
								? ''
								: 'opacity-60'}"
						>
							<td class="px-4 py-3 text-right font-mono font-bold tabular-nums text-content-muted">
								{leader.rank}
							</td>
							<td class="px-4 py-3">
								<span class="flex min-w-0 items-center gap-1.5">
									<b class="truncate font-semibold text-content">{leader.team} {leader.name}</b>
									<BotBadge />
									{#if !leader.onLadder}
										<span class="shrink-0 text-[10px] text-content-muted italic">left ladder</span>
									{/if}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-mono tabular-nums">
								<b class="text-content">{fmt(leader.rating)}</b>
								<span class="text-[11px] text-content-muted">±{fmt(leader.rd)}</span>
							</td>
							<td
								class="hidden px-4 py-3 text-right font-mono tabular-nums text-content-muted sm:table-cell"
							>
								{leader.games}
							</td>
							<td class="px-4 py-3 text-right font-mono text-xs tabular-nums text-content-muted">
								<span class="text-primary">{leader.wins}</span>
								· {leader.draws} ·
								<span class="text-danger">{leader.losses}</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="text-center text-xs text-content-muted/70">
			Ratings update about once a minute. Want your bot here? Register it via the
			<a
				class="text-primary hover:underline"
				href="https://github.com/rabestro/dicechess-play-api/blob/main/docs/bot-api.md"
			>
				Bot API
			</a>
			and join the ladder.
		</p>
	{/if}

	<p class="text-center">
		<a
			href={resolve('/lobby')}
			class="text-sm font-semibold text-content-muted transition-colors hover:text-content"
		>
			← Back to the lobby
		</a>
	</p>
</section>
