import type { TimeControl } from './liveTypes';

export interface TimeControlPreset {
	label: string;
	value: TimeControl | null; // null = Unlimited (the field is omitted on create)
}

/** The time-control choices offered when creating a game or a seek. */
export const timeControlPresets: TimeControlPreset[] = [
	{ label: 'Unlimited', value: null },
	{ label: '5 min', value: { SuddenDeath: { initialSeconds: 300 } } },
	{ label: '10 min', value: { SuddenDeath: { initialSeconds: 600 } } },
	{ label: '5 + 3', value: { Fischer: { initialSeconds: 300, incrementSeconds: 3 } } },
	{ label: '30s / move', value: { PerMove: { secondsPerMove: 30 } } },
];

/** A short human label for any time control (e.g. to show a seek's control in the lobby list). */
export function timeControlLabel(tc: TimeControl): string {
	if ('SuddenDeath' in tc) return `${Math.round(tc.SuddenDeath.initialSeconds / 60)} min`;
	if ('Fischer' in tc)
		return `${Math.round(tc.Fischer.initialSeconds / 60)} + ${tc.Fischer.incrementSeconds}`;
	if ('PerMove' in tc) return `${tc.PerMove.secondsPerMove}s / move`;
	return 'Unlimited';
}
