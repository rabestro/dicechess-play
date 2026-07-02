<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Board from '../../../components/Board.svelte';
	import PawnPromotionSelector from '../../../components/PawnPromotionSelector.svelte';
	import PlayerStrip from '../../../components/PlayerStrip.svelte';
	import DicePanel from '../../../components/DicePanel.svelte';
	import { chromeStore } from '$lib/stores/chromeStore.svelte';
	import { LiveGameStore } from '$lib/live/liveGameStore.svelte';
	import { parseSeat } from '$lib/live/seatLink';
	import type { Seat } from '$lib/live/liveTypes';

	const live = new LiveGameStore();

	let confirmResign = $state(false);

	// Board is shown from the player's side (white for spectators), so the opponent's clock sits on top.
	const bottomSeat = $derived<Seat>(live.playerColor === 'b' ? 'Black' : 'White');
	const topSeat = $derived<Seat>(bottomSeat === 'White' ? 'Black' : 'White');
	const clockMs = (seat: Seat): number | undefined =>
		live.hasClocks ? (seat === 'White' ? live.whiteClockMs : live.blackClockMs) : undefined;
	const isTicking = (seat: Seat): boolean => live.tickingClockSeat === seat;
	const seatName = (seat: Seat): string =>
		live.spectator ? seat : seat === bottomSeat ? 'You' : 'Opponent';
	const seatSub = (seat: Seat): string =>
		`${live.spectator ? 'live' : 'guest'} · ${seat.toLowerCase()}`;

	// The board is the primary element: hide the app chrome while on the live board.
	$effect(() => {
		chromeStore.zen = true;
		return () => {
			chromeStore.zen = false;
		};
	});

	// (Re)connect when the game id changes; tear the socket down on teardown/navigation.
	$effect(() => {
		const id = page.params.id;
		if (!id) return;
		const { token, as } = parseSeat(page.url);
		live.connect(id, token, as);
		return () => live.dispose();
	});

	const statusText = $derived.by(() => {
		// A dropped connection should show through whatever the last game status was (until it's over).
		if (live.connection === 'closed' && live.gameStatus !== 'over') return 'Disconnected.';
		// Mid-game 'connecting' means a reconnect is in flight (the initial connect still says "Connecting…").
		if (
			live.connection === 'connecting' &&
			live.gameStatus !== 'connecting' &&
			live.gameStatus !== 'over'
		)
			return 'Reconnecting…';
		switch (live.gameStatus) {
			case 'connecting':
				return 'Connecting…';
			case 'playing':
				return 'Your turn.';
			case 'waiting':
				return 'Waiting for your opponent…';
			case 'over':
				if (live.outcome === 'won') return 'You won! 🎉';
				if (live.outcome === 'lost') return 'You lost.';
				if (live.outcome === 'draw') return 'Draw.';
				return live.winner ? `${live.winner} won.` : 'Game over.';
		}
	});

	function resign() {
		if (!confirmResign) {
			confirmResign = true;
			setTimeout(() => (confirmResign = false), 3000);
			return;
		}
		confirmResign = false;
		live.resign();
	}
</script>

{#snippet iconBtn(kind: 'back' | 'flag')}
	<svg
		viewBox="0 0 24 24"
		class="h-[17px] w-[17px]"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if kind === 'back'}
			<path d="M19 12H6M11 6l-6 6 6 6" />
		{:else}
			<path d="M6 20V4M6 5h11l-2 3 2 3H6" />
		{/if}
	</svg>
{/snippet}

<section class="w-full">
	<div
		class="flex flex-col gap-2.5 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-4"
	>
		<!-- Board — the hero. Relative wrapper so the promotion overlay covers it. -->
		<div class="order-2 flex min-w-0 justify-center lg:order-none lg:col-start-1 lg:row-start-1">
			<div
				class="relative w-full max-w-[560px] lg:max-w-[min(640px,calc(100dvh-7rem))] aspect-square"
			>
				<Board store={live} />
				{#if live.pendingPromotion}
					<PawnPromotionSelector
						color={live.pendingPromotion.color}
						availablePieces={live.pendingPromotion.availablePieces}
						onSelect={(p) => live.completePromotion(p)}
						onCancel={() => live.cancelPromotion()}
					/>
				{/if}
			</div>
		</div>

		<!-- Rail: actions, players, dice. On mobile its children interleave around the board. -->
		<div
			class="contents lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col lg:gap-2.5 lg:self-stretch lg:[max-height:calc(100dvh-2rem)]"
		>
			<div class="order-1 flex items-center gap-1.5 lg:order-none">
				<a
					href={resolve('/live')}
					aria-label="Leave game"
					title="Leave"
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-content-muted transition-colors hover:border-border-strong hover:text-content"
				>
					{@render iconBtn('back')}
				</a>
				{#if live.canResign}
					<button
						type="button"
						onclick={resign}
						aria-label="Resign"
						title="Resign"
						class="flex h-8 items-center justify-center gap-1.5 rounded-lg border transition-colors {confirmResign
							? 'border-danger/50 bg-danger/15 px-2.5 text-xs font-bold text-danger'
							: 'w-8 border-border bg-surface text-content-muted hover:border-danger/50 hover:text-danger'}"
					>
						{@render iconBtn('flag')}
						{#if confirmResign}Resign?{/if}
					</button>
				{/if}
				{#if live.spectator}
					<span
						class="ml-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-content-muted"
					>
						Spectating
					</span>
				{/if}
			</div>

			<div class="order-1 lg:order-none">
				<PlayerStrip
					name={seatName(topSeat)}
					sub={seatSub(topSeat)}
					active={isTicking(topSeat)}
					clockMs={clockMs(topSeat)}
				/>
			</div>

			{#if live.gameStatus === 'over'}
				<div
					class="order-4 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 lg:order-none lg:flex-1 lg:justify-center"
				>
					<p class="text-lg font-bold text-content">{statusText}</p>
					{#if live.termination}
						<p class="text-sm text-content-muted">by {live.termination}</p>
					{/if}
					<a
						href={resolve('/live')}
						class="w-full rounded-xl bg-primary py-2.5 text-center font-bold text-primary-content shadow-md transition-colors hover:bg-primary-hover"
					>
						New game
					</a>
				</div>
			{:else}
				<div class="order-4 lg:order-none lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
					<DicePanel
						dice={live.currentDice}
						emptyText={live.currentDice.length === 0 ? statusText : undefined}
					/>
				</div>
			{/if}

			<div class="order-3 lg:order-none">
				<PlayerStrip
					name={seatName(bottomSeat)}
					sub={seatSub(bottomSeat)}
					active={isTicking(bottomSeat)}
					clockMs={clockMs(bottomSeat)}
				/>
			</div>
		</div>
	</div>
</section>
