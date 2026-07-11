// Shared sound service: one preloaded element per effect, so repeated plays
// don't re-fetch or re-decode. Playback is best-effort — browsers block audio
// until the user's first gesture, so the element is also "unlocked" on the
// first pointer/key interaction (muted play+pause), letting later programmatic
// plays through even when they aren't gesture-triggered (e.g. the opponent's
// roll arriving over the wire).

import { logger } from './utils/logger';
import { preferencesStore } from './preferencesStore.svelte';

const DICE_ROLL_SRC = '/sounds/dice-roll-natural.mp3';

let diceAudio: HTMLAudioElement | null = null;

function hasAudio(): boolean {
	return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

function ensureDiceAudio(): HTMLAudioElement {
	if (!diceAudio) {
		diceAudio = new Audio(DICE_ROLL_SRC);
		diceAudio.preload = 'auto';
		installUnlock(diceAudio);
	}
	return diceAudio;
}

/** A muted play+pause on the first user gesture whitelists the element for
 * future programmatic playback under browser autoplay policies. */
function installUnlock(audio: HTMLAudioElement): void {
	const unlock = () => {
		window.removeEventListener('pointerdown', unlock);
		window.removeEventListener('keydown', unlock);
		if (!audio.paused) return; // a real play is already in flight — nothing to unlock
		audio.muted = true;
		const attempt = audio.play();
		if (!attempt) {
			audio.muted = false;
			return;
		}
		attempt
			.then(() => {
				// The same gesture may have triggered a real play right after this probe
				// (it unmutes the element) — only wind back the silent probe, never
				// actual playback.
				if (audio.muted) {
					audio.pause();
					audio.currentTime = 0;
				}
			})
			.catch(() => {
				// Still blocked — the next play after a real interaction succeeds anyway.
			})
			.finally(() => {
				audio.muted = false;
			});
	};
	window.addEventListener('pointerdown', unlock);
	window.addEventListener('keydown', unlock);
}

/** Preload the audio (and arm the gesture unlock) ahead of the first roll. */
export function preloadSounds(): void {
	if (!hasAudio()) return;
	ensureDiceAudio();
}

export function playDiceSound(): void {
	if (!hasAudio() || !preferencesStore.soundEnabled) return;
	try {
		const audio = ensureDiceAudio();
		// The gesture carrying this roll may have just fired the muted unlock probe.
		audio.muted = false;
		audio.currentTime = 0;
		const attempt = audio.play();
		if (attempt) {
			attempt.catch(() => {
				// Autoplay blocked before the first user gesture — drop this one silently.
			});
		}
	} catch (e) {
		logger.error('Failed to play dice roll sound', e as Error);
	}
}
