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
	import { flushOutbox } from '$lib/ingest/outbox';
	import { BOTS } from '$lib/bots';

	const COLORS = ['white', 'black', 'random'] as const;

	let selectedAlgo = $state('greedy');
	let selectedColor = $state<(typeof COLORS)[number]>('white');
	let showHistory = $state(false);
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
			showHistory = false;
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

		<button
			type="button"
			onclick={() => store.startNewGame(selectedColor, selectedAlgo)}
			class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold text-lg shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
		>
			Start game
		</button>
	</section>
{:else}
	<section class="w-full">
		<div
			class="flex flex-col gap-2.5 lg:grid lg:items-start lg:gap-4 {showHistory
				? 'lg:grid-cols-[240px_minmax(0,1fr)_280px]'
				: 'lg:grid-cols-[minmax(0,1fr)_280px]'}"
		>
			{#if showHistory}
				<aside
					class="order-6 h-[320px] lg:sticky lg:top-4 lg:order-none lg:col-start-1 lg:row-start-1 lg:h-[calc(100dvh-2rem)] lg:max-h-[720px]"
				>
					<MoveHistory
						historyBlocks={store.historyBlocks}
						currentMoveIndex={store.currentMoveIndex}
						maxMoveIndex={store.maxMoveIndex}
						onSetMove={(i) => store.setMoveIndex(i)}
					/>
				</aside>
			{/if}

			<!-- Board — the hero. Relative wrapper so the promotion overlay covers it. -->
			<div
				class="order-2 flex min-w-0 justify-center lg:order-none lg:row-start-1 {showHistory
					? 'lg:col-start-2'
					: 'lg:col-start-1'}"
			>
				<div
					class="relative w-full max-w-[560px] lg:max-w-[min(640px,calc(100dvh-7rem))] aspect-square"
				>
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
			</div>

			<!-- Rail: actions, players, dice. On mobile its children interleave around the board. -->
			<div
				class="contents lg:sticky lg:top-4 lg:row-start-1 lg:flex lg:flex-col lg:gap-2.5 lg:self-stretch lg:[max-height:calc(100dvh-2rem)] {showHistory
					? 'lg:col-start-3'
					: 'lg:col-start-2'}"
			>
				<div class="order-1 flex items-center gap-1.5 lg:order-none">
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
						class="ml-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold text-content-muted"
					>
						{bot?.label ?? 'Bot'} · lvl {bot?.level ?? '?'}
					</span>
				</div>

				<div class="order-1 lg:order-none">
					<PlayerStrip
						name={bot?.label ?? 'Bot'}
						sub="bot · {botColorName}"
						active={botActive}
						thinking={store.gameStatus === 'bot_thinking'}
					/>
				</div>

				{#if isOver}
					<div
						class="order-4 flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 lg:order-none lg:flex-1 lg:justify-center"
					>
						<p class="text-lg font-bold text-content">
							{#if store.gameStatus === 'victory'}You won! 🎉
							{:else if store.gameStatus === 'defeat'}You lost.
							{:else}Draw.{/if}
						</p>
						<button
							type="button"
							onclick={() => store.startNewGame(selectedColor, selectedAlgo)}
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
					<div class="order-4 lg:order-none lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
						<DicePanel
							dice={store.currentDice}
							animating={store.isAnimatingRoll}
							canRoll={store.canUserRoll}
							onRoll={() => store.rollDice()}
						/>
					</div>
				{/if}

				<div class="order-3 lg:order-none">
					<PlayerStrip name="You" sub="guest · {yourColorName}" active={youActive} />
				</div>
			</div>
		</div>
	</section>
{/if}
