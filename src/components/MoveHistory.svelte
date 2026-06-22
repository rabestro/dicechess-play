<script lang="ts">
    import { formatGameResult, type GameResult } from '../utils/formatters';
    import type { TurnBlock } from '../lib/types';

    // Props definition using Svelte 5 runes syntax
    interface Props {
        historyBlocks: TurnBlock[];
        currentMoveIndex: number;
        maxMoveIndex: number;
        onSetMove: (index: number) => void;
        gameResult?: GameResult | number | null;
        loadingGame?: boolean;
        gameError?: string | null;
        syncingMoves?: boolean;
    }

    let {
        historyBlocks,
        currentMoveIndex,
        maxMoveIndex,
        onSetMove,
        gameResult = null,
        loadingGame = false,
        gameError = null,
        syncingMoves = false
    }: Props = $props();

    const formattedGameResult = $derived(formatGameResult(gameResult));
</script>

{#if loadingGame}
    <div class="bg-gray-800 p-6 rounded-xl flex items-center justify-center flex-grow text-gray-400">
        {syncingMoves ? 'Downloading game maneuvers...' : 'Loading game...'}
    </div>
{:else if gameError}
    <div class="bg-red-900/30 p-6 rounded-xl border border-red-800 flex items-center justify-center flex-grow text-red-300">
        {gameError}
    </div>
{:else}
    <div class="bg-[#13221e] p-4 rounded-xl shadow-lg border border-[#1e3b33] flex-grow flex flex-col overflow-hidden min-h-[250px] lg:flex">
        <h2 class="text-md font-semibold text-gray-300 mb-3 text-center tracking-widest uppercase flex-shrink-0">Game History</h2>

        <div class="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-2 text-sm text-gray-300 font-mono">
            <div class="flex flex-col gap-1 mb-2">
                <p class="text-xs text-gray-500">Use ← / → arrows to navigate</p>
                <div class="flex justify-between text-xs text-gray-400">
                    <span>Move {currentMoveIndex} of {maxMoveIndex}</span>
                </div>
            </div>

            <!-- Formatted history view -->
            <div class="flex flex-col gap-2 text-xs font-mono pb-2">
                {#each historyBlocks as turn}
                    <div class="bg-[#1a332a] p-2 rounded border border-[#2a4d40] flex flex-col gap-2">
                        <!-- Turn header -->
                        <div class="flex justify-between items-center text-gray-500 font-bold border-b border-[#2a4d40] border-opacity-50 pb-1 flex-shrink-0">
                            <span>Turn {turn.turnNumber}</span>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <!-- White Moves -->
                            <div class="flex flex-col gap-1 pr-2 border-r border-[#2a4d40] border-opacity-50">
                                {#each turn.whiteMoves as m}
                                    <button
                                        type="button"
                                        onclick={() => onSetMove(m.index)}
                                        class="flex items-center justify-start gap-2 px-1.5 py-1 rounded transition {currentMoveIndex === m.index ? 'bg-green-600 text-white shadow' : 'bg-[#0f1d18] text-gray-300 hover:bg-[#2d5849]'} w-full text-left">
                                        <span class="text-base font-sans leading-none opacity-90 w-4 text-center text-gray-200">{m.pieceIcon}</span>
                                        <span>{m.text}</span>
                                    </button>
                                {/each}
                            </div>

                            <!-- Black Moves -->
                            <div class="flex flex-col gap-1 pl-1">
                                {#each turn.blackMoves as m}
                                    <button
                                        type="button"
                                        onclick={() => onSetMove(m.index)}
                                        class="flex items-center justify-start gap-2 px-1.5 py-1 rounded transition {currentMoveIndex === m.index ? 'bg-green-600 text-white shadow' : 'bg-[#0f1d18] text-gray-300 hover:bg-[#2d5849]'} w-full text-left">
                                        <span class="text-base font-sans leading-none opacity-90 w-4 text-center text-gray-400 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]">{m.pieceIcon}</span>
                                        <span>{m.text}</span>
                                    </button>
                                {/each}
                            </div>
                        </div>

                        {#if turn.events.length > 0}
                            <div class="mt-1 flex flex-col gap-1">
                                {#each turn.events as evt}
                                    <button type="button" onclick={() => onSetMove(evt.index)}
                                        class="w-full text-yellow-500 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-800/50 italic text-center text-xs hover:bg-yellow-900/50 transition">
                                        {evt.text}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}

                {#if formattedGameResult}
                    <div
                        class="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-950/70 px-3 py-2 text-center text-sm font-semibold text-emerald-100 shadow-sm"
                    >
                        {formattedGameResult}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
