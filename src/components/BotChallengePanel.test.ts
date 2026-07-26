import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import BotChallengePanel from './BotChallengePanel.svelte';

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
		wakeBotMock.mockResolvedValue({ alive: true });
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
		wakeBotMock.mockResolvedValue({ alive: false });
		const { getByRole, findByText } = render(BotChallengePanel, { team: 'acme', name: 'alice' });
		await fireEvent.click(getByRole('button', { name: 'Play →' }));
		expect(await findByText("This bot isn't answering right now.")).toBeTruthy();
		expect(getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('does not navigate if the panel unmounts before playBot resolves', async () => {
		wakeBotMock.mockResolvedValue({ alive: true });
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
});
