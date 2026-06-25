<script lang="ts">
	// Thin, store-driven board for the play site. Wraps the low-level Chessground
	// component and binds it to playWithBotStore (fen / legal dests / move callback).
	// Deliberately does NOT reuse lab's ChessgroundBoard, which couples to the trainer
	// and active-game-viewer stores (activeGameStore / trainerStore).
	import Chessground from './lib/Chessground.svelte';
	import '@lichess-org/chessground/assets/chessground.base.css';
	import '@lichess-org/chessground/assets/chessground.brown.css';
	import '@lichess-org/chessground/assets/chessground.cburnett.css';
	import type { Key } from '@lichess-org/chessground/types';
	import { playWithBotStore as store } from '$lib/playWithBot';

	const toCg = (c: 'w' | 'b'): 'white' | 'black' => (c === 'w' ? 'white' : 'black');

	const canMove = $derived(
		store.gameStatus === 'playing' && store.activeColor === store.playerColor,
	);
</script>

<div class="relative w-full max-w-[560px] lg:max-w-[min(560px,calc(100dvh_-_280px))] mx-auto">
	<Chessground
		class="rounded-xl overflow-hidden shadow-lg"
		fen={store.currentBoardFen}
		orientation={toCg(store.playerColor)}
		turnColor={toCg(store.activeColor)}
		movable={{
			free: false,
			color: canMove ? toCg(store.playerColor) : undefined,
			dests: store.legalMovesDests as Map<Key, Key[]>,
			showDests: true,
			events: {
				after: (orig: Key, dest: Key) => store.handleBoardMove(orig as string, dest as string),
			},
		}}
	/>
</div>
