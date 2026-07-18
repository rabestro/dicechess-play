// IndexedDB shim for tests that exercise localGamesDB (the durable game outbox).
import 'fake-indexeddb/auto';

// jsdom has no Web Animations API, which Svelte transitions call (element.animate) —
// stub just enough of it that components using in:/out: can mount in component tests.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
	Element.prototype.animate = () =>
		({
			cancel() {},
			finish() {},
			pause() {},
			play() {},
			reverse() {},
			persist() {},
			commitStyles() {},
			onfinish: null,
			oncancel: null,
			finished: Promise.resolve(),
			currentTime: 0,
			playState: 'finished',
		}) as unknown as Animation;
}
