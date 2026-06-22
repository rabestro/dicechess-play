<script lang="ts">
    import "@lichess-org/chessground/assets/chessground.base.css";
    import "@lichess-org/chessground/assets/chessground.brown.css";
    import "@lichess-org/chessground/assets/chessground.cburnett.css";

    interface Props {
        color: 'w' | 'b';
        availablePieces?: string[]; // e.g. ['q', 'r', 'b', 'n']
        onSelect: (piece: string) => void;
        onCancel: () => void;
    }

    let {
        color,
        availablePieces = ['q', 'r', 'b', 'n'],
        onSelect,
        onCancel
    }: Props = $props();

    const colorClass = $derived(color === 'w' ? 'white' : 'black');

    const pieceMap: Record<string, string> = {
        'q': 'queen',
        'r': 'rook',
        'b': 'bishop',
        'n': 'knight'
    };

    // Filter to ensure we only render known pieces
    const piecesToRender = $derived(
        availablePieces.filter(p => pieceMap[p.toLowerCase()])
    );

    function getPieceClass(p: string): string {
        return pieceMap[p.toLowerCase()] || '';
    }
</script>

<div class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-sm md:rounded-xl">
    <div class="bg-[#1e293b] border border-gray-700 rounded-xl shadow-2xl p-6 flex flex-col items-center gap-6 max-w-sm w-[90%] md:w-auto">
        <h3 class="text-xl font-semibold text-white">Promote to:</h3>

        <!-- Provide a cg-board context so the piece classes load SVGs correctly -->
        <div class="flex flex-wrap justify-center gap-4 cg-wrap cg-board-wrap is2d">
            <cg-board class="!static !w-auto !h-auto !bg-transparent flex flex-wrap justify-center gap-4">
                {#each piecesToRender as p}
                    <button
                        onclick={() => onSelect(p)}
                        class="w-16 h-16 md:w-20 md:h-20 hover:scale-110 hover:bg-slate-700 transition-all duration-200 rounded-lg flex items-center justify-center relative cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label="Promote to {pieceMap[p.toLowerCase()]}"
                    >
                        <piece class="{getPieceClass(p)} {colorClass} !static !w-full !h-full"></piece>
                    </button>
                {/each}
            </cg-board>
        </div>

        <button
            onclick={onCancel}
            class="mt-2 px-6 py-2 text-sm font-medium text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
            Cancel
        </button>
    </div>
</div>

<style>
    /* Override chessground piece absolute positioning to work in our flex layout */
    piece {
        position: relative !important;
        display: block;
        transform: none !important;
    }
</style>
