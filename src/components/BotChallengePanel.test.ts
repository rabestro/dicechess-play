import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import BotChallengePanel from './BotChallengePanel.svelte';

// Only wakeBot is faked — click→wake→panel is the part worth unit testing here. start()'s
// playBot + window.location.href navigation isn't (no component in this codebase unit-tests
// navigation; the lobby's equivalent goToBoard has none either) — that path is verified in the
// browser instead, per the project's UI-flow-change convention.
const wakeBotMock = vi.fn();
vi.mock('$lib/catalog/catalogApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/catalog/catalogApi')>();
	return { ...actual, wakeBot: (team: string, name: string) => wakeBotMock(team, name) };
});

describe('BotChallengePanel', () => {
	beforeEach(() => wakeBotMock.mockReset());
	afterEach(() => cleanup());

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
});
