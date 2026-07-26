<script lang="ts">
	import type { PlayerGame } from '$lib/games/gamesApi';
	import { parseGameResultsTimeControl } from '$lib/live/timeControls';
	import { formatDate } from '../utils/formatters';
	import BotBadge from './BotBadge.svelte';

	interface Props {
		game: PlayerGame;
	}

	let { game }: Props = $props();

	const opponentName = $derived(game.opponent.name ?? 'Anonymous opponent');
	const playedColor = $derived(game.seat === 'White' ? 'White' : 'Black');
	const timeControl = $derived(parseGameResultsTimeControl(game.timeControl));
	// play-api's termination is a snake_case wire enum ('king_captured', 'draw_agreement', ...) — a
	// generic humaniser rather than an exhaustive label table, so a future termination value the
	// server adds renders sensibly here without this file needing a matching update.
	const termination = $derived(
		game.termination.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
	);

	const RESULT_LABEL: Record<PlayerGame['result'], string> = {
		win: 'Won',
		loss: 'Lost',
		draw: 'Draw',
		unknown: 'Unknown',
	};
	const RESULT_CLASS: Record<PlayerGame['result'], string> = {
		win: 'bg-primary/15 text-primary border-primary/30',
		loss: 'bg-danger/15 text-danger border-danger/30',
		draw: 'bg-surface text-content-muted border-border',
		unknown: 'bg-surface text-content-muted border-border',
	};
</script>

<div
	class="bg-surface/60 border border-border rounded-2xl p-5 flex flex-col gap-4"
	title="Played online — recorded by the server, not this browser"
>
	<div class="flex justify-between items-center gap-2">
		<span
			class="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-badge-accent/10 text-badge-accent border border-badge-accent/20"
		>
			Live
		</span>
		<span class="text-xs text-content-muted font-medium text-right">
			{formatDate(game.finishedAt)}
		</span>
	</div>

	<div class="flex items-center justify-between gap-3">
		<div class="flex flex-col gap-0.5 min-w-0">
			<span class="text-[11px] font-black uppercase tracking-widest text-content-muted/60">vs</span>
			<span class="flex min-w-0 items-center gap-1.5">
				<span class="font-bold text-content text-lg truncate" title={opponentName}
					>{opponentName}</span
				>
				{#if game.opponent.kind === 'Bot'}<BotBadge />{/if}
			</span>
			<span class="text-xs text-content-muted">You played {playedColor}</span>
		</div>
		<span
			class="shrink-0 px-3 py-1 rounded-lg text-sm font-black uppercase tracking-wider border {RESULT_CLASS[
				game.result
			]}"
		>
			{RESULT_LABEL[game.result]}
		</span>
	</div>

	<div
		class="flex justify-between items-center pt-3 border-t border-border-strong/40 text-xs font-semibold text-content-muted"
	>
		<span>{termination}</span>
		<span>{timeControl}</span>
	</div>
</div>
