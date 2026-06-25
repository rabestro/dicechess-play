<script lang="ts">
	import { onMount } from 'svelte';
	import { playWithBotStore as store } from '$lib/playWithBot';
	import Board from '../../components/Board.svelte';
	import MoveHistory from '../../components/MoveHistory.svelte';
	import PawnPromotionSelector from '../../components/PawnPromotionSelector.svelte';
	import { flushOutbox } from '$lib/ingest/outbox';
	import { getPieceImage } from '$lib/utils/getPieceImage';

	// The six playable bots (ADR: hardcoded — do not trust engine getAvailableBots()).
	const BOTS = [
		{ id: 'random', label: 'Random', level: 1 },
		{ id: 'checkmate-aware', label: 'Checkmate-aware', level: 2 },
		{ id: 'greedy', label: 'Greedy', level: 3 },
		{ id: 'aggressive', label: 'Aggressive', level: 5 },
		{ id: 'aggressive-book', label: 'Aggressive + Book', level: 5 },
		{ id: 'monte-carlo', label: 'Monte-Carlo', level: 6 },
	];
	const COLORS = ['white', 'black', 'random'] as const;

	let selectedAlgo = $state('greedy');
	let selectedColor = $state<(typeof COLORS)[number]>('white');

	const inLobby = $derived(store.gameStatus === 'idle');
	const isOver = $derived(
		store.gameStatus === 'victory' || store.gameStatus === 'defeat' || store.gameStatus === 'draw',
	);

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
</script>

{#if inLobby}
	<section class="max-w-md mx-auto flex flex-col gap-6">
		<h2 class="text-2xl font-bold text-content">New game</h2>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-content-muted">Opponent</span>
			{#each BOTS as bot (bot.id)}
				<button
					type="button"
					onclick={() => (selectedAlgo = bot.id)}
					class="flex items-center justify-between px-4 py-3 rounded-lg border transition-colors {selectedAlgo ===
					bot.id
						? 'border-primary bg-primary/10 text-content'
						: 'border-border bg-surface text-content-muted hover:text-content'}"
				>
					<span class="font-bold">{bot.label}</span>
					<span class="text-xs text-content-muted">Level {bot.level}</span>
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
	<section class="flex flex-col lg:flex-row gap-6 items-start">
		<div class="flex-1 w-full flex flex-col gap-4 items-center">
			<!-- Relative wrapper so the promotion overlay covers the board. -->
			<div class="relative w-full max-w-[560px] mx-auto">
				<Board />
				{#if store.pendingPromotion}
					<PawnPromotionSelector
						color={store.pendingPromotion.color}
						availablePieces={store.pendingPromotion.availablePieces}
						onSelect={(p) => store.completePromotion(p)}
						onCancel={() => store.cancelPromotion()}
					/>
				{/if}
			</div>

			<div class="flex items-center gap-3 min-h-20">
				{#if store.currentDice.length > 0}
					<div class="flex items-center gap-2.5" aria-label="Dice">
						{#each store.currentDice as d, i (i)}
							<div
								class="relative w-14 h-14 md:w-16 md:h-16 rounded-xl bg-dice-surface border border-border flex items-center justify-center transition-all duration-300
									{d.used ? 'opacity-30 grayscale scale-95' : 'scale-100 shadow-md ring-1 ring-border-strong'}
									{store.isAnimatingRoll ? 'animate-[spin_0.3s_linear_infinite] opacity-80' : ''}"
							>
								<img
									src={getPieceImage(d.value)}
									alt={d.value}
									class="w-10 h-10 md:w-12 md:h-12 drop-shadow-md select-none pointer-events-none"
								/>
							</div>
						{/each}
					</div>
				{:else if store.canUserRoll}
					<div class="flex items-center gap-2.5" aria-label="Dice">
						{#each Array(3) as _, i (i)}
							<div
								class="w-14 h-14 md:w-16 md:h-16 rounded-xl border border-border flex items-center justify-center opacity-30"
							>
								<span class="text-content-muted font-sans text-sm">-</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if store.canUserRoll}
					<button
						type="button"
						onclick={() => store.rollDice()}
						class="px-5 py-2 rounded-lg bg-primary text-primary-content font-bold hover:bg-primary-hover transition-colors"
					>
						Roll
					</button>
				{/if}

				{#if store.gameStatus === 'bot_thinking'}
					<span class="text-sm text-content-muted italic">Bot is thinking…</span>
				{/if}
			</div>

			{#if isOver}
				<div class="flex flex-col items-center gap-3 py-2">
					<p class="text-xl font-bold text-content">
						{#if store.gameStatus === 'victory'}You won! 🎉
						{:else if store.gameStatus === 'defeat'}You lost.
						{:else}Draw.{/if}
					</p>
					<button
						type="button"
						onclick={() => store.startNewGame(selectedColor, selectedAlgo)}
						class="px-5 py-2 rounded-lg bg-primary text-primary-content font-bold hover:bg-primary-hover transition-colors"
					>
						New game
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => store.resignGame()}
					class="text-sm text-content-muted hover:text-content underline"
				>
					Resign
				</button>
			{/if}
		</div>

		<aside class="w-full lg:w-80 shrink-0 lg:sticky lg:top-24 lg:h-[calc(100dvh_-_8rem)]">
			<MoveHistory
				historyBlocks={store.historyBlocks}
				currentMoveIndex={store.currentMoveIndex}
				maxMoveIndex={store.maxMoveIndex}
				onSetMove={(i) => store.setMoveIndex(i)}
			/>
		</aside>
	</section>
{/if}
