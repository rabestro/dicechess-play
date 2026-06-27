<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Board from '../../../components/Board.svelte';
	import PawnPromotionSelector from '../../../components/PawnPromotionSelector.svelte';
	import { getPieceImage } from '$lib/utils/getPieceImage';
	import { LiveGameStore } from '$lib/live/liveGameStore.svelte';
	import { parseSeat } from '$lib/live/seatLink';

	const live = new LiveGameStore();

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
</script>

<section class="flex flex-col items-center gap-4 w-full max-w-[560px] mx-auto">
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

	<!-- Dice bar -->
	<div
		class="flex items-center justify-center gap-3 w-full min-h-20 bg-surface/50 border border-border rounded-2xl p-3 shadow-lg"
	>
		{#if live.currentDice.length > 0}
			<div class="flex items-center gap-2.5" aria-label="Dice">
				{#each live.currentDice as d, i (i)}
					<div
						class="relative w-14 h-14 rounded-xl bg-dice-surface border border-border flex items-center justify-center transition-all duration-300
							{d.used ? 'opacity-30 grayscale scale-95' : 'scale-100 shadow-md ring-1 ring-border-strong'}"
					>
						<img
							src={getPieceImage(d.value)}
							alt={d.value}
							class="w-10 h-10 drop-shadow-md select-none pointer-events-none"
						/>
					</div>
				{/each}
			</div>
		{:else}
			<span class="text-content-muted text-sm">{statusText}</span>
		{/if}
	</div>

	<p class="text-lg font-bold text-content">{statusText}</p>

	{#if live.gameStatus === 'over'}
		{#if live.termination}<p class="text-sm text-content-muted">by {live.termination}</p>{/if}
		<a href={resolve('/live')} class="text-sm text-content-muted hover:text-content underline"
			>New game</a
		>
	{:else if live.canResign}
		<button
			type="button"
			onclick={() => live.resign()}
			class="text-sm text-content-muted hover:text-content underline py-1"
		>
			Resign
		</button>
	{/if}
</section>
