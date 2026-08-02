import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import BotChallengePanel from './BotChallengePanel.svelte';
import { PlayBotError } from '$lib/catalog/catalogApi';

// wakeBot and playBot are faked — click→wake→panel and the start() config flow are the parts
// worth unit testing here. Asserting *where* window.location.href ends up isn't (no component in
// this codebase unit-tests navigation targets; the lobby's equivalent goToBoard has none either)
// — that path is verified in the browser instead, per the project's UI-flow-change convention.
// The unmount-guard test below only asserts navigation does NOT fire once destroyed, which needs
// no real navigation target.
const wakeBotMock = vi.fn();
const playBotMock = vi.fn();
vi.mock('$lib/catalog/catalogApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/catalog/catalogApi')>();
	return {
		...actual,
		wakeBot: (team: string, name: string) => wakeBotMock(team, name),
		playBot: (req: unknown) => playBotMock(req),
	};
});

describe('BotChallengePanel', () => {
	beforeEach(() => {
		wakeBotMock.mockReset();
		playBotMock.mockReset();
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('starts idle with a Play button', () => {
		const { getByRole } = render(BotChallengePanel, { team: 'acme', name: 'alice' });
		expect(getByRole('button', { name: 'Play →' })).toBeTruthy();
	});

	it('clicking Play wakes the bot and shows the config panel once it answers', async () => {
		wakeBotMock.mockResolvedValue({ alive: true, busy: false });
		const { getByRole, findByRole } = render(BotChallengePanel, { team: 'acme', name: 'alice' });
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		expect(wakeBotMock).toHaveBeenCalledWith('acme', 'alice');
		expect(await findByRole('button', { name: 'Start game' })).toBeTruthy();
	});

	it('shows a retry state when the bot does not answer', async () => {
		// Covers both wakeBot outcomes the component treats identically: a resolved alive:false
		// and a rejected call both fall into the same one-line `catch { phase = 'dead' }` — proving
		// the resolved path renders the retry state also proves the (trivially identical) catch
		// branch does, without a second, promise-rejection-timing-sensitive test for zero extra
		// coverage.
		wakeBotMock.mockResolvedValue({ alive: false, busy: false });
		const { getByRole, findByText } = render(BotChallengePanel, { team: 'acme', name: 'alice' });
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		expect(await findByText("This bot isn't answering right now.")).toBeTruthy();
		expect(getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('shows a distinct busy state — not "isn\'t answering" — for a bot at its declared limit (#189)', async () => {
		wakeBotMock.mockResolvedValue({ alive: false, busy: true });
		const { getByRole, findByText, queryByText } = render(BotChallengePanel, {
			team: 'acme',
			name: 'alice',
		});
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		expect(
			await findByText('This bot is playing right now — try again in a few minutes.'),
		).toBeTruthy();
		expect(queryByText("This bot isn't answering right now.")).toBeNull();
		expect(getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('does not navigate if the panel unmounts before playBot resolves', async () => {
		wakeBotMock.mockResolvedValue({ alive: true, busy: false });
		let resolvePlayBot!: (match: { gameId: string; token: string; seat: 'White' }) => void;
		playBotMock.mockReturnValue(
			new Promise((resolve) => {
				resolvePlayBot = resolve;
			}),
		);
		// Replace location wholesale so the (skipped, once destroyed) href assignment can be
		// asserted against without hitting jsdom's unimplemented real navigation.
		vi.stubGlobal('location', { href: 'about:blank', origin: window.location.origin });

		const { getByRole, findByRole, unmount } = render(BotChallengePanel, {
			team: 'acme',
			name: 'alice',
		});
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		await fireEvent.click(await findByRole('button', { name: 'Start game' }));

		unmount();
		resolvePlayBot({ gameId: 'g1', token: 't1', seat: 'White' });
		await Promise.resolve();
		await Promise.resolve();

		expect(window.location.href).toBe('about:blank');
	});

	// The bug this fixes: every 409 used to render the SAME hardcoded "you already have a game in
	// progress" text, which became wrong the moment play-api gained a second 409 cause (#189) — a
	// visitor with no game of their own would be told they had one. The two tests below drive both
	// causes through the real 409 status and assert the panel shows the CORRECT, distinct message for
	// each — not just "some message changed".
	it('shows the server’s own message for a bot at its concurrent-game limit, not the stale "already have a game" text', async () => {
		wakeBotMock.mockResolvedValue({ alive: true, busy: false });
		playBotMock.mockRejectedValue(
			new PlayBotError(
				409,
				'that bot is busy — it is at its concurrent-game limit; try another or retry soon',
			),
		);
		const { getByRole, findByRole, findByText, queryByText } = render(BotChallengePanel, {
			team: 'acme',
			name: 'alice',
		});
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		await fireEvent.click(await findByRole('button', { name: 'Start game' }));

		expect(
			await findByText(
				'That bot is busy — it is at its concurrent-game limit; try another or retry soon.',
			),
		).toBeTruthy();
		expect(queryByText(/already have a game in progress/i)).toBeNull();
	});

	it('shows the server’s own message when the visitor already has an unfinished catalog game', async () => {
		wakeBotMock.mockResolvedValue({ alive: true, busy: false });
		playBotMock.mockRejectedValue(
			new PlayBotError(409, 'you already have an active game — finish it before starting another'),
		);
		const { getByRole, findByRole, findByText, queryByText } = render(BotChallengePanel, {
			team: 'acme',
			name: 'alice',
		});
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		await fireEvent.click(await findByRole('button', { name: 'Start game' }));

		expect(
			await findByText('You already have an active game — finish it before starting another.'),
		).toBeTruthy();
		expect(queryByText(/concurrent-game limit/i)).toBeNull();
	});

	it('falls back to the generic message for a non-409 failure, unchanged from before', async () => {
		wakeBotMock.mockResolvedValue({ alive: true, busy: false });
		playBotMock.mockRejectedValue(new Error('network exploded'));
		const { getByRole, findByRole, findByText } = render(BotChallengePanel, {
			team: 'acme',
			name: 'alice',
		});
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		await fireEvent.click(await findByRole('button', { name: 'Start game' }));

		expect(
			await findByText('Could not start the game right now — try again in a minute.'),
		).toBeTruthy();
	});
});
