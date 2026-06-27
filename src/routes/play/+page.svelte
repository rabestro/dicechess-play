<script lang="ts">
	import { onMount } from 'svelte';
	import { playWithBotStore as store } from '$lib/playWithBot';
	import Board from '../../components/Board.svelte';
	import MoveHistory from '../../components/MoveHistory.svelte';
	import PawnPromotionSelector from '../../components/PawnPromotionSelector.svelte';
	import { flushOutbox } from '$lib/ingest/outbox';
	import { getPieceImage } from '$lib/utils/getPieceImage';
	import { BOTS } from '$lib/bots';

	const COLORS = ['white', 'black', 'random'] as const;

	let selectedAlgo = $state('greedy');
	let selectedColor = $state<(typeof COLORS)[number]>('white');
	let activeMobileTab = $state<'board' | 'history'>('board');

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
	<section
		class="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center w-full"
	>
		<!-- Left Column: History (Desktop Only) -->
		<aside
			class="hidden lg:block w-72 shrink-0 lg:sticky lg:top-24 h-[calc(100dvh_-_240px)] max-h-[560px]"
		>
			<MoveHistory
				historyBlocks={store.historyBlocks}
				currentMoveIndex={store.currentMoveIndex}
				maxMoveIndex={store.maxMoveIndex}
				onSetMove={(i) => store.setMoveIndex(i)}
			/>
		</aside>

		<!-- Center Column: Board + Mobile Dice + Controls -->
		<div class="flex-1 w-full max-w-[560px] flex flex-col gap-4 items-center">
			<!-- Mobile tab switcher -->
			<div
				class="flex lg:hidden w-full bg-surface border border-border rounded-xl p-1 gap-1 shadow-md"
			>
				<button
					type="button"
					onclick={() => (activeMobileTab = 'board')}
					class="flex-1 py-2 rounded-lg font-bold text-sm transition-colors {activeMobileTab ===
					'board'
						? 'bg-primary text-primary-content shadow'
						: 'text-content-muted hover:text-content'}"
				>
					Board
				</button>
				<button
					type="button"
					onclick={() => (activeMobileTab = 'history')}
					class="flex-1 py-2 rounded-lg font-bold text-sm transition-colors {activeMobileTab ===
					'history'
						? 'bg-primary text-primary-content shadow'
						: 'text-content-muted hover:text-content'}"
				>
					History ({store.currentMoveIndex}/{store.maxMoveIndex})
				</button>
			</div>

			<!-- Main Board or Mobile History -->
			{#if activeMobileTab === 'board'}
				<!-- Relative wrapper so the promotion overlay covers the board perfectly. -->
				<div
					class="relative w-full max-w-[560px] lg:max-w-[min(560px,calc(100dvh_-_240px))] mx-auto aspect-square"
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

				<!-- Mobile Dice Bar (hidden on lg) -->
				<div
					class="flex lg:hidden items-center justify-center gap-3 w-full min-h-20 bg-surface/50 border border-border rounded-2xl p-3 shadow-lg"
				>
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
					{:else}
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
							class="px-5 py-2 rounded-lg bg-primary text-primary-content font-bold hover:bg-primary-hover transition-colors shadow-md hover:scale-105 active:scale-95"
						>
							Roll
						</button>
					{/if}

					{#if store.gameStatus === 'bot_thinking'}
						<span class="text-sm text-content-muted italic">Bot is thinking…</span>
					{/if}
				</div>

				<!-- Status / Game Controls -->
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
							class="px-5 py-2 rounded-lg bg-primary text-primary-content font-bold hover:bg-primary-hover transition-colors shadow-md"
						>
							New game
						</button>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => store.resignGame()}
						class="text-sm text-content-muted hover:text-content underline py-1"
					>
						Resign
					</button>
				{/if}
			{:else}
				<!-- Mobile History Tab -->
				<div class="w-full h-[500px] max-h-[70dvh]">
					<MoveHistory
						historyBlocks={store.historyBlocks}
						currentMoveIndex={store.currentMoveIndex}
						maxMoveIndex={store.maxMoveIndex}
						onSetMove={(i) => store.setMoveIndex(i)}
					/>
				</div>
			{/if}
		</div>

		<!-- Right Column: Dice Box (Desktop Only) -->
		<aside
			class="hidden lg:flex flex-col items-center justify-between w-40 bg-surface border border-border rounded-2xl p-5 shadow-2xl shrink-0 lg:sticky lg:top-24 h-[calc(100dvh_-_240px)] max-h-[560px]"
		>
			<div class="flex flex-col items-center gap-1 w-full pb-3 border-b border-border text-center">
				<h3 class="text-content font-extrabold uppercase tracking-[0.2em] text-sm">Active Dice</h3>
				<p class="text-[10px] text-content-muted font-mono">Roll & move</p>
			</div>

			<div class="flex-1 flex flex-col items-center justify-center gap-5 my-4 w-full">
				{#if store.currentDice.length > 0}
					{#each store.currentDice as d, i (i)}
						<div
							class="relative w-16 h-16 rounded-2xl bg-dice-surface border border-border flex items-center justify-center transition-all duration-300
								{d.used ? 'opacity-30 grayscale scale-95' : 'scale-100 shadow-xl ring-2 ring-primary/40'}
								{store.isAnimatingRoll ? 'animate-[spin_0.3s_linear_infinite] opacity-80' : ''}"
						>
							<img
								src={getPieceImage(d.value)}
								alt={d.value}
								class="w-12 h-12 drop-shadow-lg select-none pointer-events-none"
							/>
						</div>
					{/each}
				{:else}
					{#each Array(3) as _, i (i)}
						<div
							class="w-16 h-16 rounded-2xl border border-border flex items-center justify-center opacity-30"
						>
							<span class="text-content-muted font-sans text-sm">-</span>
						</div>
					{/each}
				{/if}
			</div>

			<div class="w-full pt-3 border-t border-border flex flex-col items-center gap-2">
				{#if store.canUserRoll}
					<button
						type="button"
						onclick={() => store.rollDice()}
						class="w-full py-3 rounded-xl bg-primary text-primary-content font-bold hover:bg-primary-hover transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer uppercase tracking-wider text-sm"
					>
						Roll
					</button>
				{/if}
				{#if store.gameStatus === 'bot_thinking'}
					<span class="text-xs text-content-muted italic font-mono animate-pulse"
						>Bot thinking…</span
					>
				{/if}
			</div>
		</aside>
	</section>
{/if}
