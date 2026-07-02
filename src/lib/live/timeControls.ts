import type { TimeControl } from './liveTypes';

export interface TimeControlPreset {
	label: string;
	value: TimeControl | null; // null = Unlimited (the field is omitted on create)
}

/** The time-control choices offered when creating a game or a seek. The first preset is the
 * default (both pickers start at index 0), so it must be a timed control — with Unlimited first,
 * a quickly-created game silently had no clocks. Unlimited stays available as a deliberate,
 * last choice. */
export const timeControlPresets: TimeControlPreset[] = [
	{ label: '5 + 3', value: { Fischer: { initialSeconds: 300, incrementSeconds: 3 } } },
	{ label: '5 min', value: { SuddenDeath: { initialSeconds: 300 } } },
	{ label: '10 min', value: { SuddenDeath: { initialSeconds: 600 } } },
	{ label: '30s / move', value: { PerMove: { secondsPerMove: 30 } } },
	{ label: 'Unlimited', value: null },
];

/** A short human label for any time control (e.g. to show a seek's control in the lobby list). Tolerates a
 * missing control (treated as Unlimited) so a malformed response can never throw. */
export function timeControlLabel(tc: TimeControl | null | undefined): string {
	if (!tc) return 'Unlimited';
	if ('SuddenDeath' in tc) return `${Math.round(tc.SuddenDeath.initialSeconds / 60)} min`;
	if ('Fischer' in tc)
		return `${Math.round(tc.Fischer.initialSeconds / 60)} + ${tc.Fischer.incrementSeconds}`;
	if ('PerMove' in tc) return `${tc.PerMove.secondsPerMove}s / move`;
	return 'Unlimited';
}
