import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveGameStore } from './liveGameStore.svelte';
import type { PublicGameState, ServerEvent } from './liveTypes';
import { getPieceFromFen } from '../../utils/fenUtils';
import { playDiceSound } from '../sound';

// The store triggers real audio through the shared sound service; stub it so tests can
// assert WHEN a roll sounds (aligned with its presented spin) without touching Audio.
vi.mock('../sound', () => ({
	playDiceSound: vi.fn(),
	preloadSounds: vi.fn(),
}));

// Minimal WebSocket stand-in: the store opens one via LiveClient; we drive events through it.
class MockWebSocket {
	static readonly OPEN = 1;
	static last: MockWebSocket | null = null;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	readyState = MockWebSocket.OPEN;
	constructor(public url: string) {
		MockWebSocket.last = this;
	}
	send() {}
	close() {
		this.onclose?.();
	}
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const START_FEN_BLACK = START_FEN.replace(' w ', ' b '); // side-to-move must agree with activeSeat
// After Black plays Nb8-c6 and Ng8-f6 from the start position.
const AFTER_BLACK_KNIGHTS = 'r1bqkb1r/pppppppp/2n2n2/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 2 2';
// After White plays Nb1-c3 and Ng1-f3 from the start position.
const AFTER_WHITE_KNIGHTS = 'rnbqkbnr/pppppppp/8/8/8/2N2N2/PPPPPPPP/R1BQKB1R b KQkq - 2 2';

function snapshot(overrides: Partial<PublicGameState> = {}): ServerEvent {
	return {
		Snapshot: {
			v: 0,
			state: {
				version: 0,
				dfen: `${START_FEN} N`,
				activeSeat: 'White',
				dicePending: true,
				status: { Active: {} },
				clocks: null,
				...overrides,
			},
		},
	};
}

describe('LiveGameStore pacing', () => {
	let live: LiveGameStore;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
		MockWebSocket.last = null;
		live = new LiveGameStore();
		live.connect('g', 'tok', 'white');
		MockWebSocket.last!.onopen?.();
	});

	afterEach(() => {
		live.dispose();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const deliver = (ev: ServerEvent) =>
		MockWebSocket.last!.onmessage?.({ data: JSON.stringify(ev) });

	it("paces the opponent's dice roll with a 600ms spin, blocking interaction meanwhile", async () => {
		deliver(snapshot());
		deliver({
			DiceRolled: {
				v: 1,
				seat: 'Black',
				dice: [2],
				dfen: `${START_FEN.replace(' w ', ' b ')} n`,
				clocks: null,
			},
		});

		expect(live.isAnimatingRoll).toBe(true);
		// The position/dice are already correct underneath the spin (only the CSS animation is
		// pending) — legalMovesDests/handleBoardMove stay blocked regardless, via the independent
		// activeColor !== playerColor check, since it's the opponent's turn either way.
		expect(live.isViewingHistory).toBe(false);
		expect(live.activeColor).toBe('b');

		await vi.advanceTimersByTimeAsync(600);

		expect(live.isAnimatingRoll).toBe(false);
		expect(live.isViewingHistory).toBe(false);
	});

	it("reveals the opponent's multi-move turn one micro-move at a time, pausing on the old position first", async () => {
		deliver(snapshot({ dfen: `${START_FEN_BLACK} nn`, activeSeat: 'Black' }));
		deliver({
			TurnPlayed: { v: 1, seat: 'Black', moves: ['b8c6', 'g8f6'], fenAfter: AFTER_BLACK_KNIGHTS },
		});

		// Nothing revealed yet — still showing the pre-turn position.
		expect(getPieceFromFen(live.currentBoardFen, 'b8')).toBe('n');
		expect(live.isViewingHistory).toBe(true);

		await vi.advanceTimersByTimeAsync(1000);
		expect(getPieceFromFen(live.currentBoardFen, 'b8')).toBeNull();
		expect(getPieceFromFen(live.currentBoardFen, 'c6')).toBe('n');
		expect(getPieceFromFen(live.currentBoardFen, 'g8')).toBe('n'); // second move not revealed yet
		expect(live.isViewingHistory).toBe(true);

		await vi.advanceTimersByTimeAsync(1000);
		expect(getPieceFromFen(live.currentBoardFen, 'g8')).toBeNull();
		expect(getPieceFromFen(live.currentBoardFen, 'f6')).toBe('n');
		expect(live.isViewingHistory).toBe(false);
	});

	it("paces the player's own dice roll: spin + sound, no moves until it lands", async () => {
		deliver(snapshot()); // index 0: White's first roll, seeded by initHistory (never paced)
		deliver({
			DiceRolled: { v: 1, seat: 'White', dice: [2], dfen: `${START_FEN} N`, clocks: null },
		}); // index 1: White's second roll, through recordRoll -> schedulePresentation

		// The spin presents immediately (values already visible underneath), with its sound…
		expect(live.isAnimatingRoll).toBe(true);
		expect(vi.mocked(playDiceSound)).toHaveBeenCalledTimes(1);
		// …and the board is NOT playable until the spin lands.
		expect(live.legalMovesDests.size).toBe(0);

		await vi.advanceTimersByTimeAsync(600);

		expect(live.isAnimatingRoll).toBe(false);
		expect(live.legalMovesDests.size).toBeGreaterThan(0); // knight die: b1/g1 can move
		expect(live.isViewingHistory).toBe(false);
		expect(live.currentMoveIndex).toBe(1);
	});

	it('aligns the own-roll spin and sound with presentation during catch-up, not event arrival', async () => {
		deliver(snapshot({ dfen: `${START_FEN_BLACK} nn`, activeSeat: 'Black' }));
		deliver({
			TurnPlayed: { v: 1, seat: 'Black', moves: ['b8c6', 'g8f6'], fenAfter: AFTER_BLACK_KNIGHTS },
		});
		deliver({
			DiceRolled: {
				v: 2,
				seat: 'White',
				dice: [2],
				dfen: `${AFTER_BLACK_KNIGHTS} N`,
				clocks: null,
			},
		});

		// The opponent's two knight moves are still revealing — the own roll must wait its turn.
		expect(vi.mocked(playDiceSound)).not.toHaveBeenCalled();
		expect(live.isAnimatingRoll).toBe(false);

		await vi.advanceTimersByTimeAsync(1000); // first knight move lands
		expect(vi.mocked(playDiceSound)).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000); // second knight move lands -> roll presents
		expect(vi.mocked(playDiceSound)).toHaveBeenCalledTimes(1);
		expect(live.isAnimatingRoll).toBe(true);
		expect(live.legalMovesDests.size).toBe(0);

		await vi.advanceTimersByTimeAsync(600);
		expect(live.isAnimatingRoll).toBe(false);
		expect(live.legalMovesDests.size).toBeGreaterThan(0);
	});

	it("does not pace the player's own confirmed multi-move turn", () => {
		deliver(snapshot({ dfen: `${START_FEN} NN` }));
		deliver({
			TurnPlayed: { v: 1, seat: 'White', moves: ['b1c3', 'g1f3'], fenAfter: AFTER_WHITE_KNIGHTS },
		});

		expect(live.isViewingHistory).toBe(false);
		expect(live.currentMoveIndex).toBe(2);
		expect(getPieceFromFen(live.currentBoardFen, 'c3')).toBe('N');
		expect(getPieceFromFen(live.currentBoardFen, 'f3')).toBe('N');
	});

	it("does not pace the player's own pass", () => {
		deliver(snapshot());
		deliver({ TurnPlayed: { v: 1, seat: 'White', moves: [], fenAfter: START_FEN } });

		expect(live.isViewingHistory).toBe(false);
		expect(live.currentMoveIndex).toBe(1);
	});

	it('paces both sides for a spectator, including a pass', async () => {
		live.dispose();
		live = new LiveGameStore();
		live.connect('g', 'tok', null); // spectator: no seat is "already seen live"
		MockWebSocket.last!.onopen?.();

		deliver(snapshot());
		deliver({ TurnPlayed: { v: 1, seat: 'White', moves: [], fenAfter: START_FEN } });

		expect(live.isViewingHistory).toBe(true);
		await vi.advanceTimersByTimeAsync(1000);
		expect(live.isViewingHistory).toBe(false);
	});

	it('clears isAnimatingRoll immediately if the game ends mid-roll-reveal, and it stays cleared', async () => {
		deliver(snapshot());
		deliver({
			DiceRolled: {
				v: 1,
				seat: 'Black',
				dice: [2],
				dfen: `${START_FEN.replace(' w ', ' b ')} n`,
				clocks: null,
			},
		});
		expect(live.isAnimatingRoll).toBe(true);

		deliver({
			GameEnded: { v: 2, over: { result: { Win: { side: 'White' } }, termination: 'Resign' } },
		});
		expect(live.isAnimatingRoll).toBe(false);

		// The suspended loop wakes up after its 600ms sleep — must not resurrect the flag.
		await vi.advanceTimersByTimeAsync(600);
		expect(live.isAnimatingRoll).toBe(false);
	});

	it('cleanly invalidates an in-flight catch-up when the store reconnects to a different game', async () => {
		deliver(snapshot({ dfen: `${START_FEN_BLACK} nn`, activeSeat: 'Black' }));
		deliver({
			TurnPlayed: { v: 1, seat: 'Black', moves: ['b8c6', 'g8f6'], fenAfter: AFTER_BLACK_KNIGHTS },
		});
		expect(live.isViewingHistory).toBe(true); // mid catch-up, first move not yet revealed

		// Reconnect to a different game before the pump finishes.
		live.connect('g2', 'tok2', 'white');
		MockWebSocket.last!.onopen?.();

		expect(live.isViewingHistory).toBe(false);
		expect(Object.keys(live.historyMap)).toEqual([]);

		// The orphaned loop's timer still fires — must be harmless (no throw, no stray mutation).
		await vi.advanceTimersByTimeAsync(1000);
		expect(live.isViewingHistory).toBe(false);
	});

	it('keeps clocks ticking in real time while a roll is being presented', async () => {
		deliver(snapshot());
		deliver({
			DiceRolled: {
				v: 1,
				seat: 'Black',
				dice: [2],
				dfen: `${START_FEN.replace(' w ', ' b ')} n`,
				clocks: { white: 60_000, black: 60_000 },
			},
		});
		expect(live.isAnimatingRoll).toBe(true);
		expect(live.tickingClockSeat).toBe('Black'); // the server already started Black's clock underneath the spin

		await vi.advanceTimersByTimeAsync(300); // less than the 600ms spin — still mid-animation
		expect(live.isAnimatingRoll).toBe(true);
		expect(live.blackClockMs).toBeLessThanOrEqual(59_700);
		expect(live.blackClockMs).toBeGreaterThan(59_000); // ticked down in real time regardless of pacing
	});

	it('keeps isManuallyBrowsing false during ordinary catch-up, true only after a deliberate scrub', async () => {
		deliver(snapshot({ dfen: `${START_FEN_BLACK} nn`, activeSeat: 'Black' }));
		deliver({
			TurnPlayed: { v: 1, seat: 'Black', moves: ['b8c6', 'g8f6'], fenAfter: AFTER_BLACK_KNIGHTS },
		});

		expect(live.isViewingHistory).toBe(true);
		expect(live.isManuallyBrowsing).toBe(false);

		live.setMoveIndex(0);
		expect(live.isViewingHistory).toBe(true);
		expect(live.isManuallyBrowsing).toBe(true);
	});

	it('starts a fresh pump for a new event delivered synchronously right after a zero-delay one completes', () => {
		deliver(snapshot()); // index 0 via initHistory
		// White's own second roll: alreadySeenLive, so its pump resolves with zero awaits — this used
		// to leave pumpingEpoch cleared only on a later microtask (via a caller-side .finally()), which
		// could race a same-tick delivery below. Both delivers happen with no await between them.
		deliver({
			DiceRolled: { v: 1, seat: 'White', dice: [2], dfen: `${START_FEN} N`, clocks: null },
		});
		// Immediately, same tick: the opponent's roll arrives and needs a real pump.
		deliver({
			DiceRolled: {
				v: 2,
				seat: 'Black',
				dice: [2],
				dfen: `${START_FEN.replace(' w ', ' b ')} n`,
				clocks: null,
			},
		});

		// The second pump must have actually started, not been silently dropped by a stale pumpingEpoch.
		expect(live.isAnimatingRoll).toBe(true);
	});
});
