import { describe, it, expect, beforeEach, vi } from 'vitest';

class AudioMock {
	static instances: AudioMock[] = [];
	src: string;
	preload = '';
	muted = false;
	currentTime = 0;
	play = vi.fn(() => Promise.resolve());
	pause = vi.fn();
	constructor(src: string) {
		this.src = src;
		AudioMock.instances.push(this);
	}
}

async function loadSound() {
	const [sound, prefs] = await Promise.all([
		import('./sound'),
		import('./preferencesStore.svelte'),
	]);
	return { ...sound, preferencesStore: prefs.preferencesStore };
}

describe('sound service', () => {
	beforeEach(() => {
		vi.resetModules(); // fresh module state: no cached Audio element between tests
		AudioMock.instances = [];
		vi.stubGlobal('Audio', AudioMock);
	});

	it('plays the dice sound through a single reused element', async () => {
		const { playDiceSound, preferencesStore } = await loadSound();
		preferencesStore.setSoundEnabled(true);

		playDiceSound();
		playDiceSound();

		expect(AudioMock.instances).toHaveLength(1);
		const audio = AudioMock.instances[0];
		expect(audio.src).toContain('dice-roll-natural.mp3');
		expect(audio.play).toHaveBeenCalledTimes(2);
	});

	it('rewinds to the start on each play', async () => {
		const { playDiceSound, preferencesStore } = await loadSound();
		preferencesStore.setSoundEnabled(true);

		playDiceSound();
		AudioMock.instances[0].currentTime = 3;
		playDiceSound();

		expect(AudioMock.instances[0].currentTime).toBe(0);
	});

	it('does nothing when sound is disabled', async () => {
		const { playDiceSound, preferencesStore } = await loadSound();
		preferencesStore.setSoundEnabled(false);

		playDiceSound();

		expect(AudioMock.instances).toHaveLength(0);
	});

	it('preloads the element without playing it', async () => {
		const { preloadSounds } = await loadSound();

		preloadSounds();

		expect(AudioMock.instances).toHaveLength(1);
		expect(AudioMock.instances[0].preload).toBe('auto');
		expect(AudioMock.instances[0].play).not.toHaveBeenCalled();
	});

	it('unlocks playback on the first user gesture via muted play+pause', async () => {
		const { preloadSounds } = await loadSound();
		preloadSounds();
		const audio = AudioMock.instances[0];

		window.dispatchEvent(new Event('pointerdown'));
		expect(audio.play).toHaveBeenCalledTimes(1);
		await vi.waitFor(() => expect(audio.pause).toHaveBeenCalled());
		expect(audio.muted).toBe(false);

		// listeners removed — a second gesture must not re-trigger the unlock
		window.dispatchEvent(new Event('pointerdown'));
		expect(audio.play).toHaveBeenCalledTimes(1);
	});
});
