<script lang="ts">
	// A static, dependency-free board preview for lobby tiles: unicode pieces on a CSS grid,
	// re-rendered on each poll. Interactive boards stay chessground's job (see Board.svelte).
	import { boardGrid } from '$lib/live/boardGrid';
	import { PIECE_TO_UNICODE } from '../utils/fenUtils';

	let { fen, faded = false }: { fen: string | undefined; faded?: boolean } = $props();

	const cells = $derived(boardGrid(fen));
</script>

<div class="mini-board" class:faded aria-hidden="true">
	{#each cells as piece, i (i)}
		<span
			class="flex aspect-square items-center justify-center leading-none
				{(Math.floor(i / 8) + i) % 2 === 0 ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'}
				{piece && piece === piece.toUpperCase() ? 'mini-white' : 'mini-black'}"
		>
			{piece ? PIECE_TO_UNICODE[piece] : ''}
		</span>
	{/each}
</div>

<style>
	.mini-board {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		width: 100%;
		aspect-ratio: 1;
		border-radius: 6px;
		overflow: hidden;
		user-select: none;
		container-type: inline-size;
	}
	.mini-board span {
		font-size: 9.5cqw;
	}
	.mini-white {
		color: #fbfbf7;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.55);
	}
	.mini-black {
		color: #23201c;
	}
	.faded {
		opacity: 0.35;
	}
</style>
