import { describe, expect, it } from 'vitest';
import { timeControlLabel, timeControlPresets } from './timeControls';

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
			if (p.value === null) continue; // the Unlimited label is the picker's own wording
			expect(timeControlLabel(p.value)).toBe(p.label);
		}
	});
});
