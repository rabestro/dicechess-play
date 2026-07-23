import type { TimeControl } from './liveTypes';

export interface TimeControlPreset {
	label: string;
	value: TimeControl | null; // null = Unlimited (the field is omitted on create)
}

/** The time-control choices offered when creating a game or a seek. The first preset is the
 * default (both pickers start at index 0). */
export const timeControlPresets: readonly TimeControlPreset[] = [
	{ label: '5 + 3', value: { Fischer: { initialSeconds: 300, incrementSeconds: 3 } } },
	{ label: '3 + 2', value: { Fischer: { initialSeconds: 180, incrementSeconds: 2 } } },
	{ label: '5 min', value: { SuddenDeath: { initialSeconds: 300 } } },
	{ label: '5 + 5', value: { Fischer: { initialSeconds: 300, incrementSeconds: 5 } } },
	{ label: '10 min', value: { SuddenDeath: { initialSeconds: 600 } } },
	{ label: '10 + 5', value: { Fischer: { initialSeconds: 600, incrementSeconds: 5 } } },
	{ label: '10 + 10', value: { Fischer: { initialSeconds: 600, incrementSeconds: 10 } } },
	{ label: '15 + 10', value: { Fischer: { initialSeconds: 900, incrementSeconds: 10 } } },
];

export interface TimeControlGroup {
	label: string;
	presets: { index: number; preset: TimeControlPreset }[];
}

/** Presets arranged for display: a dice-chess turn is a roll plus up to three moves, so
 * increment controls lead each group. Every preset appears in exactly one group (pinned
 * by a test). */
export const timeControlGroups: readonly TimeControlGroup[] = (
	[
		['Blitz', ['3 + 2', '5 + 3', '5 + 5', '5 min']],
		['Rapid', ['10 + 5', '10 + 10', '15 + 10', '10 min']],
	] as [string, string[]][]
).map(([label, labels]) => ({
	label,
	presets: labels.map((l) => {
		const index = timeControlPresets.findIndex((p) => p.label === l);
		// Fail fast at module load — a drifted label would otherwise surface later
		// as an opaque TypeError in the picker.
		if (index === -1) throw new Error(`timeControlGroups: no preset labelled "${l}"`);
		return { index, preset: timeControlPresets[index] };
	}),
}));

export interface BotTimeControlPreset {
	label: string;
	value: TimeControl; // never null: a catalog game is never unlimited (ADR-0014)
}

/** The 6 presets offered when starting a game against a catalog bot (ADR-0014) — a curated subset,
 * not a 1:1 mirror of `timeControlPresets` (no unlimited; fewer, rounder options). */
export const botTimeControlPresets: readonly BotTimeControlPreset[] = [
	{ label: '1 + 1', value: { Fischer: { initialSeconds: 60, incrementSeconds: 1 } } },
	{ label: '3 + 3', value: { Fischer: { initialSeconds: 180, incrementSeconds: 3 } } },
	{ label: '5 min', value: { SuddenDeath: { initialSeconds: 300 } } },
	{ label: '5 + 5', value: { Fischer: { initialSeconds: 300, incrementSeconds: 5 } } },
	{ label: '10 min', value: { SuddenDeath: { initialSeconds: 600 } } },
	{ label: '10 + 10', value: { Fischer: { initialSeconds: 600, incrementSeconds: 10 } } },
];

/** Index of the default preset (5 + 5) — looked up by label, so a reorder can't silently point the
 * default at the wrong entry (fails fast at module load instead). */
export const defaultBotTimeControlIndex: number = (() => {
	const index = botTimeControlPresets.findIndex((p) => p.label === '5 + 5');
	if (index === -1)
		throw new Error('botTimeControlPresets: no "5 + 5" preset — the default is broken');
	return index;
})();

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
