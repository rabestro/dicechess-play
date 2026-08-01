import { test, expect, type Page, type Locator } from '@playwright/test';

// The one thing the site must be able to do: play a move. #185 shipped a build where it could not
// — rolldown miscompiled the Scala.js engine, `DiceChess.applyMove` returned undefined for every
// move, and both stores read that as "illegal move" and snapped the piece back. Every unit test
// passed, because none of them touch the bundle.
//
// So this runs a real turn against the built dist: pick a piece, play a legal move, assert the
// piece actually left its square. It is deliberately blind to which colour, opponent or dice the
// game hands out — it hunts for a movable piece instead of assuming one.

/** Console errors that mean the engine itself refused to work — the #185 signature. */
const ENGINE_FAILURE = /Engine rejected|Failed to register opening-book/;

/** The `<current> / <max>` history counter under the board, keyed off its nav row. */
function moveCounter(page: Page): Locator {
	return page.locator('div:has(> button[aria-label="First move"]) > span');
}

/** A piece's identity on the board: `"white knight"` at chessground's `translate(...)` offset. */
async function piecesOnBoard(page: Page): Promise<string[]> {
	return page.locator('cg-board piece').evaluateAll((nodes) =>
		nodes.map((node) => {
			const el = node as HTMLElement;
			return `${el.className}@${el.style.transform}`;
		}),
	);
}

/**
 * Selects a piece that can actually move right now.
 *
 * Chessground only renders `square.move-dest` once a movable piece is selected, so the only way to
 * find one is to try. The turn may also belong to the bot, or the roll may have handed this seat
 * nothing playable (in which case the store auto-passes) — hence the outer wait rather than a
 * single sweep.
 */
async function selectMovablePiece(page: Page): Promise<Locator> {
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		const pieces = await page.locator('cg-board piece').all();
		for (const piece of pieces) {
			await piece.click({ force: true });
			if ((await page.locator('cg-board square.move-dest').count()) > 0) return piece;
		}
		// Nothing playable yet: let the bot finish its turn and the next roll land.
		await page.waitForTimeout(500);
	}
	throw new Error('no movable piece appeared within 60s — the board never became playable');
}

test('the built bundle can play a move', async ({ page }) => {
	const engineFailures: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' && ENGINE_FAILURE.test(message.text())) {
			engineFailures.push(message.text());
		}
	});

	await page.goto('/play');
	await page.getByRole('button', { name: 'Start game' }).click();
	await expect(page.locator('cg-board')).toBeVisible();

	await selectMovablePiece(page);
	const before = await piecesOnBoard(page);
	const counterBefore = await moveCounter(page).innerText();

	await page.locator('cg-board square.move-dest').first().click();

	// The move counter is the honest signal. Watching the piece is not: on a rejected move the
	// store leaves the FEN untouched, so nothing re-renders and chessground keeps the piece at the
	// square it was dropped on — a broken build looks like a successful move until the next render.
	// `maxMoveIndex` only advances when the engine actually applied the move.
	await expect
		.poll(async () => moveCounter(page).innerText(), { timeout: 10_000 })
		.not.toEqual(counterBefore);

	expect(await piecesOnBoard(page)).not.toEqual(before);
	expect(engineFailures, 'engine reported failures in the console').toEqual([]);
});
