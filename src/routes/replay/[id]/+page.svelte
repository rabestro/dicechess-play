<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { isLiveEnabled } from '$lib/live/liveApi';
	import { fetchGameHistory, type GameHistory } from '$lib/live/historyApi';
	import { reconstructServerHistory } from '$lib/history/reconstructServerHistory';
	import { buildTurnBlocks } from '$lib/playWithBot/turnBlocks';
	import BotBadge from '../../../components/BotBadge.svelte';
	import { formatDate } from '../../../utils/formatters';
	import MoveHistory from '../../../components/MoveHistory.svelte';
	import Chessground from '../../../components/lib/Chessground.svelte';
	import type { Key } from '@lichess-org/chessground/types';
	import '@lichess-org/chessground/assets/chessground.base.css';
	import '@lichess-org/chessground/assets/chessground.brown.css';
	import '@lichess-org/chessground/assets/chessground.cburnett.css';

	// Public replay for a server-recorded (lobby/live) game — play-api #178, fed by
	// GET /games/{id}/history. Distinct from /games/[id] (the IndexedDB-backed local replay): this
	// route has no "my" identity at all — the wire is neutral/anonymized (see historyApi.ts) — so
	// unlike the local route there is no fixed orientation to derive; a flip toggle covers both
	// colours (the DoD's "both colors' POV supported") for a bare shared link just as well as a
	// click from My Games.

	let loading = $state(true);
	let history = $state<GameHistory | null>(null);
	// Distinct from `history === null` after loading: `notFound` is the explicit "history
	// unavailable" state (an unknown id, or a known game with no archive row — pre-archive history,
	// never backfilled); `error` is everything else (network, 5xx) and gets its own banner, per the
	// games-list error-banner convention (#148).
	let notFound = $state(false);
	let error = $state<string | null>(null);
	let currentMoveIndex = $state(0);
	let orientation = $state<'white' | 'black'>('white');
	let copiedSeed = $state(false);

	$effect(() => {
		const id = page.params.id;
		if (!id || !isLiveEnabled()) {
			history = null;
			loading = false;
			return;
		}

		let active = true;
		loading = true;
		notFound = false;
		error = null;
		currentMoveIndex = 0;

		fetchGameHistory(id)
			.then((result) => {
				if (!active) return;
				history = result;
				notFound = result === null;
				loading = false;
			})
			.catch(() => {
				if (!active) return;
				error = "Couldn't load this replay — try again in a minute.";
				loading = false;
			});

		return () => {
			active = false;
		};
	});

	const reconstructed = $derived(
		history ? reconstructServerHistory(history.initialDfen, history.turns) : null,
	);
	const historyMap = $derived(reconstructed?.historyMap ?? {});
	const maxMoveIndex = $derived(reconstructed?.maxMoveIndex ?? 0);
	const historyBlocks = $derived(buildTurnBlocks(historyMap, maxMoveIndex));

	const currentState = $derived(historyMap[String(currentMoveIndex)] ?? null);
	const currentFen = $derived(currentState?.fen ?? '');
	const lastMove = $derived(
		currentState?.gameMoveHistoryMove?.from
			? ([currentState.gameMoveHistoryMove.from, currentState.gameMoveHistoryMove.to] as Key[])
			: undefined,
	);

	const hasReplay = $derived(maxMoveIndex > 0);

	// Neutral result framing (white-POV, not "you"): this endpoint carries no requester identity.
	const resultLabel = $derived.by(() => {
		if (!history) return '';
		if (history.result === 0) return 'Draw';
		return history.result === 1 ? 'White won' : 'Black won';
	});
	// play-api's termination is a snake_case wire enum ('king_captured', 'draw_agreement', ...) —
	// humanised generically (same one-liner LiveGameHistoryCard uses) so a future value the server
	// adds still renders sensibly here without a matching update.
	const terminationLabel = $derived(
		history ? history.termination.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '',
	);

	const fairnessRevealed = $derived(!!history?.fairness.seed);

	function setMove(index: number) {
		currentMoveIndex = Math.max(0, Math.min(index, maxMoveIndex));
	}

	function flipBoard() {
		orientation = orientation === 'white' ? 'black' : 'white';
	}

	async function copySeed() {
		if (!history?.fairness.seed || !navigator.clipboard) return;
		try {
			await navigator.clipboard.writeText(history.fairness.seed);
			copiedSeed = true;
			setTimeout(() => (copiedSeed = false), 1500);
		} catch {
			// Clipboard write was blocked/rejected; the value stays selectable for manual copy.
		}
	}

	function onKeydown(event: KeyboardEvent) {
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
				setMove(currentMoveIndex - 1);
				event.preventDefault();
				break;
			case 'ArrowRight':
				setMove(currentMoveIndex + 1);
				event.preventDefault();
				break;
			case 'Home':
				setMove(0);
				event.preventDefault();
				break;
			case 'End':
				setMove(maxMoveIndex);
				event.preventDefault();
				break;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<section class="flex flex-col gap-6">
	<a
		href={resolve('/games')}
		class="text-sm text-content-muted hover:text-content transition-colors w-fit"
	>
		← Back to games
	</a>

	{#if !isLiveEnabled()}
		<div class="rounded-2xl border border-border bg-surface p-6 text-center text-content-muted">
			Game replay needs a configured play server (<code class="font-mono text-xs"
				>VITE_PLAY_API_URL</code
			>) — it is not available in this build.
		</div>
	{:else if error}
		<div
			class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-center text-sm text-danger"
		>
			{error}
		</div>
	{:else if loading}
		<div class="h-[480px] rounded-2xl bg-surface/40 border border-border animate-pulse"></div>
	{:else if notFound}
		<div class="flex flex-col items-center gap-4 py-16 text-center">
			<p class="text-content-muted">History isn't available for this game.</p>
			<p class="text-xs text-content-muted/70 max-w-sm">
				Either the game hasn't been archived yet, or it was played before replay existed.
			</p>
			<a
				href={resolve('/games')}
				class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
			>
				Back to your games
			</a>
		</div>
	{:else if history}
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-col gap-1 min-w-0">
				<div class="flex items-center gap-2 flex-wrap">
					<span class="flex items-center gap-1">
						<span class="font-bold text-content">{history.players.white.name ?? 'Anonymous'}</span>
						{#if history.players.white.kind === 'Bot'}<BotBadge />{/if}
					</span>
					<span class="text-[11px] font-black uppercase tracking-widest text-content-muted/60"
						>vs</span
					>
					<span class="flex items-center gap-1">
						<span class="font-bold text-content">{history.players.black.name ?? 'Anonymous'}</span>
						{#if history.players.black.kind === 'Bot'}<BotBadge />{/if}
					</span>
				</div>
				<span class="text-xs text-content-muted">
					{formatDate(history.finishedAt)} · {terminationLabel}
				</span>
			</div>
			<span
				class="shrink-0 px-3 py-1 rounded-lg text-sm font-black uppercase tracking-wider border bg-surface text-content-muted border-border"
			>
				{resultLabel}
			</span>
		</div>

		{#if !hasReplay}
			<div
				class="rounded-2xl border border-border bg-surface/40 p-6 text-center text-content-muted"
			>
				No moves were recorded for this game.
			</div>
		{:else}
			<div class="flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
				<div class="flex-1 w-full max-w-[480px] flex flex-col gap-4 items-center">
					<div class="relative w-full max-w-[480px] mx-auto aspect-square">
						<Chessground
							class="rounded-xl overflow-hidden shadow-lg"
							fen={currentFen}
							{orientation}
							{lastMove}
							viewOnly={true}
						/>
					</div>

					<div class="flex items-center justify-center gap-2 w-full">
						<button
							type="button"
							aria-label="First move"
							onclick={() => setMove(0)}
							disabled={currentMoveIndex === 0}
							class="px-3 py-2 rounded-lg bg-surface border border-border text-content font-bold hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							⏮
						</button>
						<button
							type="button"
							aria-label="Previous move"
							onclick={() => setMove(currentMoveIndex - 1)}
							disabled={currentMoveIndex === 0}
							class="px-3 py-2 rounded-lg bg-surface border border-border text-content font-bold hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							◀
						</button>
						<span class="px-2 text-xs font-mono font-bold text-content-muted tabular-nums">
							{currentMoveIndex} / {maxMoveIndex}
						</span>
						<button
							type="button"
							aria-label="Next move"
							onclick={() => setMove(currentMoveIndex + 1)}
							disabled={currentMoveIndex === maxMoveIndex}
							class="px-3 py-2 rounded-lg bg-surface border border-border text-content font-bold hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							▶
						</button>
						<button
							type="button"
							aria-label="Last move"
							onclick={() => setMove(maxMoveIndex)}
							disabled={currentMoveIndex === maxMoveIndex}
							class="px-3 py-2 rounded-lg bg-surface border border-border text-content font-bold hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
						>
							⏭
						</button>
						<button
							type="button"
							aria-label="Flip board"
							onclick={flipBoard}
							class="px-3 py-2 rounded-lg bg-surface border border-border text-content font-bold hover:bg-surface-hover transition-colors"
						>
							⇅
						</button>
					</div>
				</div>

				<aside class="w-full lg:w-72 shrink-0 h-[420px] lg:h-[540px]">
					<MoveHistory
						{historyBlocks}
						{currentMoveIndex}
						{maxMoveIndex}
						onSetMove={(i) => setMove(i)}
						keyboardNavEnabled={true}
					/>
				</aside>
			</div>
		{/if}

		<div class="rounded-2xl border border-border bg-surface/40 p-5 flex flex-col gap-2">
			<h3 class="text-xs font-bold uppercase tracking-wider text-content-muted">
				Provably-fair dice
			</h3>
			{#if fairnessRevealed && history.fairness.commit && history.fairness.seed}
				<p class="text-xs text-content-muted">
					Every roll can be independently re-derived from the commitment and the revealed seed.
				</p>
				<div class="flex flex-col gap-1.5 font-mono text-xs">
					<span class="text-content-muted"
						>Commit: <span class="text-content">{history.fairness.commit}</span></span
					>
					<div class="flex items-center gap-2">
						<span class="text-content-muted">Seed:</span>
						<code
							class="flex-1 min-w-0 truncate bg-background/50 border border-border rounded px-2 py-1 text-content"
						>
							{history.fairness.seed}
						</code>
						<button
							type="button"
							onclick={copySeed}
							class="shrink-0 px-3 py-1 rounded-lg bg-primary text-primary-content font-bold text-xs hover:bg-primary-hover transition-colors"
						>
							{copiedSeed ? 'Copied' : 'Copy'}
						</button>
					</div>
				</div>
			{:else}
				<p class="text-xs text-content-muted">
					The dice commitment is published, but the seed is withheld until this game's paired ladder
					match also concludes — it will appear here once both are over.
				</p>
			{/if}
		</div>
	{/if}
</section>
