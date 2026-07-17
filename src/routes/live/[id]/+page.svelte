<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Board from '../../../components/Board.svelte';
	import PawnPromotionSelector from '../../../components/PawnPromotionSelector.svelte';
	import PlayerStrip from '../../../components/PlayerStrip.svelte';
	import DicePanel from '../../../components/DicePanel.svelte';
	import MoveHistory from '../../../components/MoveHistory.svelte';
	import GameEndModal from '../../../components/GameEndModal.svelte';
	import { chromeStore } from '$lib/stores/chromeStore.svelte';
	import { LiveGameStore } from '$lib/live/liveGameStore.svelte';
	import { parseSeat } from '$lib/live/seatLink';
	import { publicPlayer, seatDisplayName, seatDisplaySub } from '$lib/live/playerLabel';
	import { preferencesStore } from '$lib/preferencesStore.svelte';
	import { preloadSounds } from '$lib/sound';
	import { endReasonLabel } from '$lib/gameOutcome';
	import type { Seat } from '$lib/live/liveTypes';

	const wideScreen = () =>
		typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

	const live = new LiveGameStore();

	let confirmResign = $state(false);
	let showHistory = $state(wideScreen());

	function setMove(index: number) {
		live.setMoveIndex(index);
	}

	function onKeydown(event: KeyboardEvent) {
		// Disable keyboard navigation during active game play to prevent accidental jumps, unless spectating
		if (live.gameStatus !== 'over' && !live.spectator) return;

		const el = document.activeElement;
		if (
			el &&
			(el.tagName === 'INPUT' ||
				el.tagName === 'TEXTAREA' ||
				el.tagName === 'SELECT' ||
				el.hasAttribute('contenteditable'))
		) {
			return;
		}

		switch (event.key) {
			case 'ArrowLeft':
				setMove(live.currentMoveIndex - 1);
				event.preventDefault();
				break;
			case 'ArrowRight':
				setMove(live.currentMoveIndex + 1);
				event.preventDefault();
				break;
			case 'Home':
				setMove(0);
				event.preventDefault();
				break;
			case 'End':
				setMove(live.maxMoveIndex);
				event.preventDefault();
				break;
		}
	}

	$effect(() => {
		// Reset showHistory to default wideScreen value when game changes
		if (page.params.id) {
			showHistory = wideScreen();
		}
	});

	// Board is shown from the player's side (white for spectators), so the opponent's clock sits on top.
	const bottomSeat = $derived<Seat>(live.playerColor === 'b' ? 'Black' : 'White');
	const topSeat = $derived<Seat>(bottomSeat === 'White' ? 'Black' : 'White');
	const clockMs = (seat: Seat): number | undefined =>
		live.hasClocks ? (seat === 'White' ? live.whiteClockMs : live.blackClockMs) : undefined;
	// Turn highlight follows the PRESENTED position (consistent with board/dice pacing) and is
	// deliberately independent of clocks: tickingClockSeat is null in unlimited games and nulled
	// between turns, which used to leave the highlight dark or blinking.
	const isActiveSeat = (seat: Seat): boolean =>
		live.gameStatus !== 'over' &&
		live.gameStatus !== 'connecting' &&
		(seat === 'White') === (live.activeColor === 'w');

	// One unmistakable your-move cue: a persistent line by the dice panel + a title marker.
	// gameStatus === 'playing' is live truth (my dice are pending). The presented activeColor
	// additionally delays the cue during catch-up pacing until my roll visually lands — but a
	// deliberate manual scrub must NOT flicker it off: it is still my move while I browse.
	const myMove = $derived(
		!live.spectator &&
			live.gameStatus === 'playing' &&
			(live.isManuallyBrowsing || live.activeColor === live.playerColor),
	);
	const turnLine = $derived.by(() => {
		if (live.gameStatus === 'over' || live.gameStatus === 'connecting') return null;
		if (live.spectator) return live.activeColor === 'w' ? 'White to move' : 'Black to move';
		return myMove ? 'Your move' : 'Waiting for opponent…';
	});
	// The end-of-game modal shows once per finished game; dismissing reveals the board with
	// the side-rail card as fallback. Any transition away from 'over' (new game) re-arms it.
	let endModalDismissed = $state(false);
	$effect(() => {
		if (live.gameStatus !== 'over') endModalDismissed = false;
	});
	const showEndModal = $derived(live.gameStatus === 'over' && !endModalDismissed);
	const endTone = $derived(
		live.outcome === 'won'
			? ('win' as const)
			: live.outcome === 'lost'
				? ('loss' as const)
				: ('neutral' as const),
	);

	const seatName = (seat: Seat): string =>
		seatDisplayName(live.players, seat, bottomSeat, live.spectator);
	const seatSub = (seat: Seat): string => seatDisplaySub(live.players, seat, live.spectator);
	const seatIsBot = (seat: Seat): boolean => publicPlayer(live.players, seat)?.kind === 'Bot';

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
		preloadSounds(); // fetch + arm the gesture unlock before the first roll arrives
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
				if (live.termination === 'Aborted') return 'Game aborted.';
				if (live.outcome === 'won') return 'You won! 🎉';
				if (live.outcome === 'lost') return 'You lost.';
				if (live.outcome === 'draw') return 'Draw.';
				return live.winner ? `${live.winner} won.` : 'Game over.';
		}
	});

	// A dropped connection is otherwise invisible whenever dice are on the table (statusText only
	// surfaces via the dice panel's EMPTY state) — this badge is independent of dice/turn state.
	// Skipped for the very first connect: DicePanel's "Connecting…" empty-state already covers it,
	// and the badge would be redundant before there's anything else on screen.
	const connectionBadge = $derived.by(() => {
		if (live.gameStatus === 'over') return null;
		if (live.connection === 'closed') return 'Disconnected';
		if (live.connection === 'connecting' && live.gameStatus !== 'connecting')
			return 'Reconnecting…';
		return null;
	});

	// Human wording for the wire termination enum ('by KingCaptured' read like a debug dump).
	const endReason = $derived.by(() => {
		switch (live.termination) {
			case 'KingCaptured':
				return endReasonLabel('mate');
			case 'Resign':
				return endReasonLabel('resign');
			case 'Timeout':
				return endReasonLabel('timeout');
			default:
				return ''; // Aborted gets its own headline; unknown values stay silent
		}
	});

	// In-panel banner while a no-legal-moves pass is dwelling (see LiveGameStore.passNoticeSeat).
	// Suppressed while deliberately browsing history — the dwell belongs to the live position,
	// not whatever past move the user scrubbed to.
	const passNotice = $derived.by(() => {
		if (live.passNoticeSeat === null || live.isManuallyBrowsing) return null;
		if (live.spectator) return `${live.passNoticeSeat} has no legal moves — turn passed.`;
		const mine = (live.passNoticeSeat === 'White') === (live.playerColor === 'w');
		return mine
			? 'You have no legal moves — turn passed.'
			: 'Opponent has no legal moves — turn passed.';
	});

	let resignTimeout: ReturnType<typeof setTimeout> | undefined;

	function resign() {
		if (!confirmResign) {
			confirmResign = true;
			resignTimeout = setTimeout(() => (confirmResign = false), 3000);
			return;
		}
		clearTimeout(resignTimeout);
		confirmResign = false;
		live.resign();
	}

	$effect(() => () => clearTimeout(resignTimeout));
</script>

{#snippet iconBtn(
	kind: 'back' | 'list' | 'flag' | 'first' | 'prev' | 'next' | 'last' | 'sound-on' | 'sound-off',
)}
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
		{:else if kind === 'list'}
			<path d="M9 6h11M9 12h11M9 18h11" /><circle
				cx="5"
				cy="6"
				r="1.2"
				fill="currentColor"
				stroke="none"
			/><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle
				cx="5"
				cy="18"
				r="1.2"
				fill="currentColor"
				stroke="none"
			/>
		{:else if kind === 'sound-on'}
			<path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z" /><path d="M14.5 9.5a3.6 3.6 0 0 1 0 5" /><path
				d="M17 7.5a6.5 6.5 0 0 1 0 9"
			/>
		{:else if kind === 'sound-off'}
			<path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z" /><path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
		{:else}
			{#if kind === 'first'}
				<path d="M11 6l-6 6 6 6M18 6l-6 6 6 6" />
			{:else if kind === 'prev'}
				<path d="M15 6l-6 6 6 6" />
			{:else if kind === 'next'}
				<path d="M9 6l6 6-6 6" />
			{:else if kind === 'last'}
				<path d="M6 6l6 6-6 6M13 6l6 6-6 6" />
			{:else}
				<path d="M6 20V4M6 5h11l-2 3 2 3H6" />
			{/if}
		{/if}
	</svg>
{/snippet}

<svelte:head>
	<title>{myMove ? '● Your move · Dice Chess' : 'Dice Chess — Play'}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<GameEndModal
	open={showEndModal}
	headline={statusText ?? 'Game over.'}
	tone={endTone}
	reason={endReason}
	onDismiss={() => (endModalDismissed = true)}
>
	<a
		href={resolve('/live')}
		class="w-full rounded-xl bg-primary py-2.5 text-center font-bold text-primary-content shadow-md transition-colors hover:bg-primary-hover"
	>
		New game
	</a>
</GameEndModal>

<section class="w-full">
	<div
		class="flex flex-col gap-2.5 md:grid md:grid-cols-[minmax(0,1fr)_280px] md:items-start md:gap-3 lg:gap-4 {showHistory
			? 'lg:grid-cols-[300px_minmax(0,1fr)_280px]'
			: ''}"
	>
		{#if showHistory}
			<!-- On phones the history acts as a tab: it takes the board's slot and the
			     board/dice hide. From md up it is an extra panel alongside the game. -->
			<aside
				id="move-history-panel"
				class="order-2 h-[70dvh] md:order-none md:col-span-2 md:row-start-2 md:h-[320px] lg:sticky lg:top-4 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:h-[calc(100dvh-2rem)]"
			>
				<MoveHistory
					historyBlocks={live.historyBlocks}
					currentMoveIndex={live.currentMoveIndex}
					maxMoveIndex={live.maxMoveIndex}
					onSetMove={(i) => setMove(i)}
					keyboardNavEnabled={live.gameStatus === 'over' || live.spectator}
				/>
			</aside>
		{/if}

		<!-- Board column — the hero. Player strips sit above and below the board and share
		     its width; the board is width-capped by the column and height-capped by the
		     screen minus the strips. -->
		<div
			class="order-2 min-w-0 justify-center md:order-none md:col-start-1 md:row-start-1 {showHistory
				? 'hidden md:flex lg:col-start-2'
				: 'flex'}"
		>
			<div
				class="flex w-full max-w-[min(560px,calc(100dvh-10rem))] flex-col gap-2.5 md:max-w-[calc(100dvh-11rem)]"
			>
				<PlayerStrip
					name={seatName(topSeat)}
					sub={seatSub(topSeat)}
					bot={seatIsBot(topSeat)}
					active={isActiveSeat(topSeat)}
					clockMs={clockMs(topSeat)}
				/>

				<!-- Relative wrapper so the promotion overlay covers the board. -->
				<div class="relative w-full aspect-square">
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

				{#if live.isManuallyBrowsing}
					<button
						type="button"
						onclick={() => setMove(live.maxMoveIndex)}
						class="w-full rounded-xl border border-primary bg-primary/10 py-2 text-center text-sm font-bold text-primary transition-colors hover:bg-primary/20"
					>
						Viewing history — Return to live
					</button>
				{/if}

				<!-- History navigation buttons under the board -->
				<div class="flex items-center justify-center gap-2 w-full">
					<button
						type="button"
						aria-label="First move"
						onclick={() => setMove(0)}
						disabled={live.currentMoveIndex === 0}
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border text-content hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						{@render iconBtn('first')}
					</button>
					<button
						type="button"
						aria-label="Previous move"
						onclick={() => setMove(live.currentMoveIndex - 1)}
						disabled={live.currentMoveIndex === 0}
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border text-content hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						{@render iconBtn('prev')}
					</button>
					<span class="px-2 text-xs font-mono font-bold text-content-muted tabular-nums">
						{live.currentMoveIndex} / {live.maxMoveIndex}
					</span>
					<button
						type="button"
						aria-label="Next move"
						onclick={() => setMove(live.currentMoveIndex + 1)}
						disabled={live.currentMoveIndex === live.maxMoveIndex}
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border text-content hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						{@render iconBtn('next')}
					</button>
					<button
						type="button"
						aria-label="Last move"
						onclick={() => setMove(live.maxMoveIndex)}
						disabled={live.currentMoveIndex === live.maxMoveIndex}
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border text-content hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						{@render iconBtn('last')}
					</button>
				</div>

				<PlayerStrip
					name={seatName(bottomSeat)}
					sub={seatSub(bottomSeat)}
					bot={seatIsBot(bottomSeat)}
					active={isActiveSeat(bottomSeat)}
					clockMs={clockMs(bottomSeat)}
				/>
			</div>
		</div>

		<!-- Rail: actions, players, dice. On mobile its children interleave around the board. -->
		<div
			class="contents md:sticky md:top-4 md:col-start-2 md:row-start-1 md:flex md:flex-col md:gap-2.5 md:self-stretch md:[max-height:calc(100dvh-2rem)] {showHistory
				? 'lg:col-start-3'
				: ''}"
		>
			<div class="order-1 flex items-center gap-1.5 md:order-none">
				<a
					href={resolve('/live')}
					aria-label="Leave game"
					title="Leave"
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-content-muted transition-colors hover:border-border-strong hover:text-content"
				>
					{@render iconBtn('back')}
				</a>
				<button
					type="button"
					onclick={() => (showHistory = !showHistory)}
					aria-label="Move history"
					aria-expanded={showHistory}
					aria-controls="move-history-panel"
					title="Moves"
					class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {showHistory
						? 'border-primary bg-primary/10 text-content'
						: 'border-border bg-surface text-content-muted hover:border-border-strong hover:text-content'}"
				>
					{@render iconBtn('list')}
				</button>
				<button
					type="button"
					onclick={() => preferencesStore.setSoundEnabled(!preferencesStore.soundEnabled)}
					aria-label="Sound effects"
					aria-pressed={preferencesStore.soundEnabled}
					title={preferencesStore.soundEnabled ? 'Sound on' : 'Sound off'}
					class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface transition-colors hover:border-border-strong hover:text-content {preferencesStore.soundEnabled
						? 'text-content-muted'
						: 'text-content-muted/50'}"
				>
					{@render iconBtn(preferencesStore.soundEnabled ? 'sound-on' : 'sound-off')}
				</button>
				{#if live.canResign}
					<button
						type="button"
						onclick={resign}
						aria-label={confirmResign ? 'Click again to confirm resignation' : 'Resign'}
						title="Resign"
						class="flex h-8 items-center justify-center gap-1.5 rounded-lg border transition-colors {confirmResign
							? 'border-danger/50 bg-danger/15 px-2.5 text-xs font-bold text-danger'
							: 'w-8 border-border bg-surface text-content-muted hover:border-danger/50 hover:text-danger'}"
					>
						{@render iconBtn('flag')}
						{#if confirmResign}Resign?{/if}
					</button>
				{/if}
				{#if connectionBadge || live.spectator}
					<div class="ml-auto flex items-center gap-1.5">
						{#if connectionBadge}
							<span
								class="rounded-lg border px-2.5 py-1.5 text-xs font-bold {live.connection ===
								'closed'
									? 'border-danger/50 bg-danger/15 text-danger'
									: 'border-badge-accent/50 bg-badge-accent/15 text-badge-accent'}"
								role="status"
							>
								{connectionBadge}
							</span>
						{/if}
						{#if live.spectator}
							<span
								class="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-content-muted"
							>
								Spectating
							</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if live.gameStatus === 'over'}
				<div
					class="order-4 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 md:order-none md:flex-1 md:justify-center"
				>
					<p class="text-lg font-bold text-content">{statusText}</p>
					{#if endReason}
						<p class="text-sm text-content-muted">{endReason}</p>
					{/if}
					<a
						href={resolve('/live')}
						class="w-full rounded-xl bg-primary py-2.5 text-center font-bold text-primary-content shadow-md transition-colors hover:bg-primary-hover"
					>
						New game
					</a>
				</div>
			{:else}
				{#if turnLine}
					<p
						class="order-3 text-center text-sm font-semibold md:order-none {myMove
							? 'text-content'
							: 'text-content-muted'}"
						aria-live="polite"
					>
						<!-- Single line: inter-block whitespace renders as a literal space and would
						     off-center the text when the dot is absent. -->
						{#if myMove}<span class="mr-1.5 text-badge-accent">●</span>{/if}{turnLine}
					</p>
				{/if}
				<div class="order-4 md:order-none md:flex md:min-h-0 md:flex-1 md:flex-col">
					<DicePanel
						dice={live.currentDice}
						animating={live.isAnimatingRoll}
						emptyText={live.currentDice.length === 0 ? statusText : undefined}
						statusMessage={passNotice}
					/>
				</div>
			{/if}
		</div>
	</div>
</section>
