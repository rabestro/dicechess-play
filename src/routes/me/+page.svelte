<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { localGamesStore } from '$lib/stores/localGamesStore.svelte';
	import { playerOpponentsStore } from '$lib/stores/playerOpponentsStore.svelte';
	import { getGuestId, setGuestId, resetGuestId } from '$lib/ingest/guestIdentity';
	import { isLiveEnabled } from '$lib/live/liveApi';
	import { toastStore } from '$lib/toastStore.svelte';
	import { buildPlayerRecord, totalGames, winRate } from '$lib/stats/playerRecord';
	import { aggregateOpponents, opponentLabel, opponentVsQuery } from '$lib/stats/lobbyRecord';
	import { vsParamValue } from '$lib/games/gamesFilters';
	import WdlBar from '../../components/WdlBar.svelte';
	import WdlCounts from '../../components/WdlCounts.svelte';
	import WdlSummaryCard from '../../components/WdlSummaryCard.svelte';

	let guestId = $state('');
	let restoreInput = $state('');
	let confirmingReset = $state(false);
	let copied = $state(false);
	let cancelButton = $state<HTMLButtonElement | null>(null);

	// Move focus to the safe Cancel action when the reset confirmation appears, so
	// keyboard / screen-reader focus isn't lost when "Start fresh" unmounts.
	$effect(() => {
		if (confirmingReset) cancelButton?.focus();
	});

	onMount(() => {
		guestId = getGuestId();
		void localGamesStore.load();
		void playerOpponentsStore.load();
	});

	const record = $derived(buildPlayerRecord(localGamesStore.games));
	const overallTotal = $derived(totalGames(record.overall));

	const lobbyOverall = $derived(aggregateOpponents(playerOpponentsStore.opponents));
	const lobbyTotal = $derived(totalGames(lobbyOverall));

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(guestId);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			toastStore.error('Could not copy — select the code and copy it manually.');
		}
	}

	function restore() {
		if (setGuestId(restoreInput)) {
			guestId = getGuestId();
			restoreInput = '';
			toastStore.success('Player code restored.');
			playerOpponentsStore.reset();
			void playerOpponentsStore.load();
		} else {
			toastStore.error('That does not look like a valid player code.');
		}
	}

	function reset() {
		guestId = resetGuestId();
		confirmingReset = false;
		toastStore.info('Started a new identity.');
		playerOpponentsStore.reset();
		void playerOpponentsStore.load();
	}
</script>

<section class="flex flex-col gap-8">
	<div class="flex flex-col gap-1">
		<h2 class="text-2xl font-bold text-content">Your profile</h2>
		<p class="text-sm text-content-muted">Your record against bots and lobby opponents.</p>
	</div>

	<h3 class="text-sm font-bold uppercase tracking-wider text-content-muted">On this device</h3>

	{#if !localGamesStore.loaded && !localGamesStore.error}
		<div class="h-32 rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
	{:else if localGamesStore.error && overallTotal === 0}
		<div class="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
			Couldn't load your record: {localGamesStore.error}
		</div>
	{:else if overallTotal === 0}
		<div
			class="rounded-2xl border border-border bg-surface/40 p-6 flex flex-col items-center gap-3 text-center"
		>
			<p class="text-content-muted">You haven't played any games yet.</p>
			<a
				href={resolve('/play')}
				class="px-5 py-2.5 rounded-xl bg-primary text-primary-content font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
			>
				Play your first game →
			</a>
		</div>
	{:else}
		<WdlSummaryCard counts={record.overall} />

		<div class="flex flex-col gap-2">
			<h3 class="text-sm font-bold uppercase tracking-wider text-content-muted">By opponent</h3>
			{#each record.perBot as bot (bot.algorithm)}
				<a
					href={resolve(
						`/games?vs=${encodeURIComponent(vsParamValue({ kind: 'local', algorithm: bot.algorithm }))}`,
					)}
					class="rounded-xl border border-border bg-surface/40 hover:bg-surface-hover/60 hover:border-primary/50 p-4 flex flex-col gap-2 transition-colors"
				>
					<div class="flex items-center justify-between gap-3">
						<span class="font-bold text-content truncate min-w-0">{bot.label}</span>
						<div class="flex items-center gap-3 shrink-0">
							<WdlCounts counts={bot} />
							<span class="font-mono text-sm font-bold text-content tabular-nums w-12 text-right">
								{Math.round(winRate(bot) * 100)}%
							</span>
						</div>
					</div>
					<WdlBar counts={bot} />
				</a>
			{/each}
		</div>
	{/if}

	<h3 class="text-sm font-bold uppercase tracking-wider text-content-muted">In the lobby</h3>

	{#if !isLiveEnabled()}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			Lobby games need a configured play server (<code class="font-mono text-xs"
				>VITE_PLAY_API_URL</code
			>) — not available in this build.
		</div>
	{:else}
		{#if playerOpponentsStore.error}
			<div
				class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center text-xs text-danger"
			>
				{playerOpponentsStore.error}
			</div>
		{/if}

		{#if !playerOpponentsStore.loaded && !playerOpponentsStore.error}
			<div class="h-32 rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
		{:else if playerOpponentsStore.error}
			<!-- The error banner above already says everything — a failed fetch must never also claim
			     "you haven't played any lobby games", which could be flatly false for this guest. -->
		{:else if lobbyTotal === 0}
			<div
				class="rounded-2xl border border-border bg-surface/40 p-6 flex flex-col items-center gap-3 text-center"
			>
				<p class="text-content-muted">You haven't played any lobby games yet.</p>
				<a
					href={resolve('/lobby')}
					class="px-5 py-2.5 rounded-xl bg-primary text-primary-content font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
				>
					Visit the lobby →
				</a>
			</div>
		{:else}
			<WdlSummaryCard counts={lobbyOverall} />

			<div class="flex flex-col gap-2">
				<h4 class="text-sm font-bold uppercase tracking-wider text-content-muted">By opponent</h4>
				{#each playerOpponentsStore.opponents as opp (opponentVsQuery(opp))}
					<a
						href={resolve(`/games?vs=${encodeURIComponent(opponentVsQuery(opp))}`)}
						class="rounded-xl border border-border bg-surface/40 hover:bg-surface-hover/60 hover:border-primary/50 p-4 flex flex-col gap-2 transition-colors"
					>
						<div class="flex items-center justify-between gap-3">
							<span class="font-bold text-content truncate min-w-0">{opponentLabel(opp)}</span>
							<div class="flex items-center gap-3 shrink-0">
								<WdlCounts counts={opp} />
								<span class="font-mono text-sm font-bold text-content tabular-nums w-12 text-right">
									{Math.round(winRate(opp) * 100)}%
								</span>
							</div>
						</div>
						<WdlBar counts={opp} />
					</a>
				{/each}
			</div>
		{/if}
	{/if}

	<div class="flex flex-col gap-3">
		<h3 class="text-sm font-bold uppercase tracking-wider text-content-muted">Your player code</h3>
		<p class="text-sm text-content-muted">
			This anonymous code is your identity. Save it to keep the same identity — and your lobby
			record — if you switch browser or device. Only the "on this device" history above stays local
			to this browser.
		</p>

		<div class="rounded-2xl border border-border bg-surface/60 p-5 flex flex-col gap-5">
			<div class="flex items-center gap-2">
				<code
					class="flex-1 min-w-0 truncate font-mono text-sm bg-background/50 border border-border rounded-lg px-3 py-2 text-content"
					title={guestId}
				>
					{guestId}
				</code>
				<button
					type="button"
					onclick={copyCode}
					class="shrink-0 px-4 py-2 rounded-lg bg-primary text-primary-content font-bold text-sm hover:bg-primary-hover transition-colors"
				>
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>

			<div class="flex flex-col gap-2 pt-1">
				<label for="restore-code" class="text-xs font-bold text-content-muted">
					Use a code from another device
				</label>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						restore();
					}}
					class="flex items-center gap-2"
				>
					<input
						id="restore-code"
						bind:value={restoreInput}
						placeholder="guest:…"
						spellcheck="false"
						autocomplete="off"
						class="flex-1 min-w-0 font-mono text-sm bg-surface border border-border rounded-lg px-3 py-2 text-content outline-none focus:border-primary transition-colors"
					/>
					<button
						type="submit"
						disabled={!restoreInput.trim()}
						class="shrink-0 px-4 py-2 rounded-lg bg-surface border border-border text-content font-bold text-sm hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						Restore
					</button>
				</form>
			</div>

			<div class="pt-1 border-t border-border">
				{#if confirmingReset}
					<div class="flex flex-col gap-2 pt-3">
						<p class="text-xs text-danger">
							Save your current code first — this starts a brand-new identity. Your games on this
							device stay.
						</p>
						<div class="flex gap-2">
							<button
								type="button"
								onclick={reset}
								class="px-4 py-2 rounded-lg bg-danger/15 text-danger border border-danger/30 font-bold text-sm hover:bg-danger/25 transition-colors"
							>
								Yes, start fresh
							</button>
							<button
								type="button"
								bind:this={cancelButton}
								onclick={() => (confirmingReset = false)}
								class="px-4 py-2 rounded-lg bg-surface border border-border text-content-muted font-bold text-sm hover:text-content transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (confirmingReset = true)}
						class="pt-3 text-sm text-content-muted hover:text-content underline w-fit"
					>
						Start fresh as a new player
					</button>
				{/if}
			</div>
		</div>
	</div>
</section>
