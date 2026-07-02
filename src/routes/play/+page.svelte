<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { playWithBotStore as store } from '$lib/playWithBot';
	import Board from '../../components/Board.svelte';
	import MoveHistory from '../../components/MoveHistory.svelte';
	import PawnPromotionSelector from '../../components/PawnPromotionSelector.svelte';
	import PlayerStrip from '../../components/PlayerStrip.svelte';
	import DicePanel from '../../components/DicePanel.svelte';
	import { chromeStore } from '$lib/stores/chromeStore.svelte';
	import { preferencesStore } from '$lib/preferencesStore.svelte';
	import { flushOutbox } from '$lib/ingest/outbox';
	import { BOTS } from '$lib/bots';

	const COLORS = ['white', 'black', 'random'] as const;

	/** Bot-game time controls map onto the store's minutes-limit + seconds-bonus model.
	 * No clock first: a casual bot game shouldn't surprise anyone with a flag fall. */
	const TIME_PRESETS: {
		label: string;
		group: string;
		limit: number | null;
		bonus: number;
	}[] = [
		{ label: 'No clock', group: 'Casual', limit: null, bonus: 0 },
		{ label: '3 + 2', group: 'Blitz', limit: 3, bonus: 2 },
		{ label: '5 min', group: 'Blitz', limit: 5, bonus: 0 },
		{ label: '5 + 3', group: 'Blitz', limit: 5, bonus: 3 },
		{ label: '10 min', group: 'Rapid', limit: 10, bonus: 0 },
		{ label: '10 + 5', group: 'Rapid', limit: 10, bonus: 5 },
		{ label: '15 + 10', group: 'Rapid', limit: 15, bonus: 10 },
	];
	const TIME_GROUPS = ['Casual', 'Blitz', 'Rapid'].map((g) => ({
		label: g,
		presets: TIME_PRESETS.map((p, index) => ({ ...p, index })).filter((p) => p.group === g),
	}));

	// Move history is on by default only where a third column fits.
	const wideScreen = () =>
		typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

	// Reflect the persisted preference so a stored time control is always VISIBLE in the
	// picker — a clock must never tick that the player didn't see coming.
	const storedTimeIndex = () => {
		const i = TIME_PRESETS.findIndex(
			(p) =>
				p.limit === preferencesStore.timeLimit && p.bonus === (preferencesStore.timeBonus ?? 0),
		);
		return i >= 0 ? i : 0;
	};

	let selectedAlgo = $state('greedy');
	let selectedColor = $state<(typeof COLORS)[number]>('white');
	let selectedTime = $state(storedTimeIndex());
	let showHistory = $state(wideScreen());
	let confirmResign = $state(false);

	const inLobby = $derived(store.gameStatus === 'idle');
	const isOver = $derived(
		store.gameStatus === 'victory' || store.gameStatus === 'defeat' || store.gameStatus === 'draw',
	);
	const bot = $derived(BOTS.find((b) => b.id === selectedAlgo));
	const yourColorName = $derived(store.playerColor === 'w' ? 'white' : 'black');
	const botColorName = $derived(store.playerColor === 'w' ? 'black' : 'white');
	const botActive = $derived(!isOver && store.activeColor !== store.playerColor);
	const youActive = $derived(!isOver && store.activeColor === store.playerColor);
	const hasClocks = $derived(store.timeLimit !== null);
	const timeLabel = $derived(TIME_PRESETS[selectedTime]?.label ?? 'No clock');

	function startGame() {
		const t = TIME_PRESETS[selectedTime];
		preferencesStore.setTimeLimit(t.limit);
		preferencesStore.setTimeBonus(t.bonus);
		// Rolling is not a decision in dice chess — the play site always auto-rolls,
		// so the dice panel never needs a Roll button.
		preferencesStore.setAutoRollDice(true);
		store.startNewGame(selectedColor, selectedAlgo);
	}

	// The board is the primary element: hide the app chrome while a game is on screen.
	$effect(() => {
		chromeStore.zen = !inLobby;
		return () => {
			chromeStore.zen = false;
		};
	});

	// Reset transient panel state whenever a new game starts.
	$effect(() => {
		if (inLobby) {
			showHistory = wideScreen();
			confirmResign = false;
		}
	});

	// Flush finished games to the ingest gateway exactly once per game. `flushed` is a
	// plain (non-reactive) flag so this effect depends only on gameStatus.
	let flushed = false;
	$effect(() => {
		const s = store.gameStatus;
		if (s === 'victory' || s === 'defeat' || s === 'draw') {
			if (!flushed) {
				flushed = true;
				void flushOutbox();
			}
		} else {
			flushed = false;
		}
	});

	onMount(() => {
		// Retry games left pending from a previous session.
		void flushOutbox();
	});

	function resign() {
		if (!confirmResign) {
			confirmResign = true;
			setTimeout(() => (confirmResign = false), 3000);
			return;
		}
		confirmResign = false;
		store.resignGame();
	}
</script>

{#snippet iconBtn(kind: 'back' | 'list' | 'flag')}
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
		{:else}
			<path d="M6 20V4M6 5h11l-2 3 2 3H6" />
		{/if}
	</svg>
{/snippet}

{#if inLobby}
	<section class="max-w-md mx-auto flex flex-col gap-6">
		<h2 class="text-2xl font-bold text-content">New game</h2>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-content-muted">Opponent</span>
			{#each BOTS as b (b.id)}
				<button
					type="button"
					onclick={() => (selectedAlgo = b.id)}
					class="flex items-center justify-between px-4 py-3 rounded-lg border transition-colors {selectedAlgo ===
					b.id
						? 'border-primary bg-primary/10 text-content'
						: 'border-border bg-surface text-content-muted hover:text-content'}"
				>
					<span class="font-bold">{b.label}</span>
					<span class="text-xs text-content-muted">Level {b.level}</span>
				</button>
			{/each}
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-content-muted">Your color</span>
			<div class="flex gap-2">
				{#each COLORS as color (color)}
					<button
						type="button"
						onclick={() => (selectedColor = color)}
						class="flex-1 px-3 py-2 rounded-lg border capitalize transition-colors {selectedColor ===
						color
							? 'border-primary bg-primary/10 text-content'
							: 'border-border bg-surface text-content-muted hover:text-content'}"
					>
						{color}
					</button>
				{/each}
			</div>
		</div>

		<fieldset class="flex flex-col gap-3">
			<legend class="text-sm font-bold text-content-muted pb-2">Time control</legend>
			{#each TIME_GROUPS as g (g.label)}
				<div class="flex flex-col gap-1.5">
					<span class="text-[10px] font-bold tracking-widest text-content-muted/80 uppercase">
						{g.label}
					</span>
					<div class="flex flex-wrap gap-2">
						{#each g.presets as p (p.label)}
							<label
								class="cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-bold tabular-nums transition-colors focus-within:ring-2 focus-within:ring-primary/50
									{selectedTime === p.index
									? 'border-primary bg-primary text-primary-content'
									: 'border-border bg-surface text-content-muted hover:text-content'}"
							>
								<input
									type="radio"
									name="botTimeControl"
									value={p.index}
									bind:group={selectedTime}
									class="sr-only"
								/>
								{p.label}
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</fieldset>

		<button
			type="button"
			onclick={startGame}
			class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold text-lg shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
		>
			Start game
		</button>
	</section>
{:else}
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
					class="order-2 h-[70dvh] md:order-none md:col-span-2 md:row-start-2 md:h-[320px] lg:sticky lg:top-4 lg:col-span-1 lg:col-start-1 lg:row-start-1 lg:h-[calc(100dvh-2rem)]"
				>
					<MoveHistory
						historyBlocks={store.historyBlocks}
						currentMoveIndex={store.currentMoveIndex}
						maxMoveIndex={store.maxMoveIndex}
						onSetMove={(i) => store.setMoveIndex(i)}
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
						name={bot?.label ?? 'Bot'}
						sub="bot · {botColorName}"
						active={botActive}
						thinking={store.gameStatus === 'bot_thinking'}
						clockMs={hasClocks ? store.botTimeLeft : undefined}
					/>

					<!-- Relative wrapper so the promotion overlay covers the board. -->
					<div class="relative w-full aspect-square">
						<Board {store} />
						{#if store.pendingPromotion}
							<PawnPromotionSelector
								color={store.pendingPromotion.color}
								availablePieces={store.pendingPromotion.availablePieces}
								onSelect={(p) => store.completePromotion(p)}
								onCancel={() => store.cancelPromotion()}
							/>
						{/if}
					</div>

					<PlayerStrip
						name="You"
						sub="guest · {yourColorName}"
						active={youActive}
						clockMs={hasClocks ? store.playerTimeLeft : undefined}
					/>
				</div>
			</div>

			<!-- Rail: actions and dice. -->
			<div
				class="contents md:sticky md:top-4 md:col-start-2 md:row-start-1 md:flex md:flex-col md:gap-2.5 md:self-stretch md:[max-height:calc(100dvh-2rem)] {showHistory
					? 'lg:col-start-3'
					: ''}"
			>
				<div class="order-1 flex items-center gap-1.5 md:order-none">
					<a
						href={resolve('/')}
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
						aria-pressed={showHistory}
						title="Moves"
						class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors {showHistory
							? 'border-primary bg-primary/10 text-content'
							: 'border-border bg-surface text-content-muted hover:border-border-strong hover:text-content'}"
					>
						{@render iconBtn('list')}
					</button>
					{#if !isOver}
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
					<span
						class="ml-auto truncate rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-content-muted"
					>
						{bot?.label ?? 'Bot'} · lvl {bot?.level ?? '?'}{hasClocks ? ` · ${timeLabel}` : ''}
					</span>
				</div>

				{#if isOver}
					<div
						class="order-4 flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 md:order-none md:flex-1 md:justify-center {showHistory
							? 'hidden md:flex'
							: 'flex'}"
					>
						<p class="text-lg font-bold text-content">
							{#if store.gameStatus === 'victory'}You won! 🎉
							{:else if store.gameStatus === 'defeat'}You lost.
							{:else}Draw.{/if}
						</p>
						{#if store.gameEndReason === 'timeout'}
							<p class="text-sm text-content-muted">on time</p>
						{/if}
						<button
							type="button"
							onclick={startGame}
							class="w-full rounded-xl bg-primary py-2.5 font-bold text-primary-content shadow-md transition-colors hover:bg-primary-hover"
						>
							New game
						</button>
						<button
							type="button"
							onclick={() => store.endSession()}
							class="text-sm text-content-muted underline transition-colors hover:text-content"
						>
							Change opponent
						</button>
					</div>
				{:else}
					<div
						class="order-4 md:order-none md:min-h-0 md:flex-1 md:flex-col {showHistory
							? 'hidden md:flex'
							: 'md:flex'}"
					>
						<DicePanel
							dice={store.currentDice}
							animating={store.isAnimatingRoll}
							canRoll={store.canUserRoll && !preferencesStore.autoRollDice}
							onRoll={() => store.rollDice()}
						/>
					</div>
				{/if}
			</div>
		</div>
	</section>
{/if}
