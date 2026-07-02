import { describe, expect, it } from 'vitest';
import { timeControlGroups, timeControlLabel, timeControlPresets } from './timeControls';

describe('timeControlPresets', () => {
	it('defaults (index 0) to a timed control so new games get clocks', () => {
		// Both the lobby and the play-a-friend page start their picker at index 0. If the first
		// preset were Unlimited, a quickly-created game would silently have no clocks.
		expect(timeControlPresets[0].value).not.toBeNull();
	});

	it('still offers Unlimited as an explicit choice', () => {
		expect(timeControlPresets.some((p) => p.value === null)).toBe(true);
	});

	it('labels every preset consistently with timeControlLabel', () => {
		for (const p of timeControlPresets) {
			expect(timeControlLabel(p.value)).toBe(p.label);
		}
	});
});

describe('timeControlGroups', () => {
	it('covers every preset exactly once', () => {
		const indexes = timeControlGroups.flatMap((g) => g.presets.map((e) => e.index));
		expect([...indexes].sort((a, b) => a - b)).toEqual(timeControlPresets.map((_, i) => i));
	});

	it('resolves every entry to its preset', () => {
		for (const g of timeControlGroups) {
			for (const e of g.presets) {
				expect(timeControlPresets[e.index]).toBe(e.preset);
			}
		}
	});
});
