import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';

const toasts = vi.hoisted(() => ({
	toastStore: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('$lib/toastStore.svelte', () => toasts);

const auth = vi.hoisted(() => ({
	authStore: {
		account: null as { id: string; nickname: string } | null,
		nickname: null as string | null,
		guestsLoaded: true,
		currentGuestLinked: false,
		loadGuests: vi.fn(),
		rename: vi.fn(),
		claimCurrentGuest: vi.fn(),
	},
}));
vi.mock('$lib/authStore.svelte', () => auth);

const opponents = vi.hoisted(() => ({
	playerOpponentsStore: { opponents: [] as unknown[], load: vi.fn() },
}));
vi.mock('$lib/stores/playerOpponentsStore.svelte', () => opponents);

import FirstLoginOnboarding from './FirstLoginOnboarding.svelte';
import { isOnboarded, markOnboarded } from '$lib/auth/onboarding';

const ACCOUNT = { id: 'account-uuid', nickname: 'BraveDie' };

/** One lobby opponent with `wins` games, which is how the dialog counts anonymous history. */
function opponentWith(wins: number) {
	return { team: null, name: 'someone', wins, draws: 0, losses: 0 };
}

function fakeStorage() {
	const map = new Map<string, string>();
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear(),
		key: () => null,
		length: 0,
	};
}

describe('FirstLoginOnboarding', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', fakeStorage());
		auth.authStore.account = null;
		auth.authStore.nickname = null;
		auth.authStore.guestsLoaded = true;
		auth.authStore.currentGuestLinked = false;
		auth.authStore.loadGuests.mockReset();
		auth.authStore.rename.mockReset();
		auth.authStore.claimCurrentGuest.mockReset();
		opponents.playerOpponentsStore.opponents = [];
		opponents.playerOpponentsStore.load.mockReset();
		toasts.toastStore.success.mockReset();
		toasts.toastStore.error.mockReset();
	});

	afterEach(() => vi.unstubAllGlobals());

	function signIn() {
		auth.authStore.account = ACCOUNT;
		auth.authStore.nickname = ACCOUNT.nickname;
	}

	it('stays closed for a guest — it must never interrupt anonymous play', () => {
		const { queryByRole } = render(FirstLoginOnboarding);
		expect(queryByRole('dialog')).toBeNull();
	});

	it('stays closed for an account this browser already onboarded', async () => {
		markOnboarded(ACCOUNT.id);
		signIn();
		const { queryByRole } = render(FirstLoginOnboarding);
		await waitFor(() => expect(queryByRole('dialog')).toBeNull());
	});

	it('opens on the nickname step for a fresh account, pre-filled with the generated name', async () => {
		signIn();
		const { getByRole } = render(FirstLoginOnboarding);
		await waitFor(() => expect(getByRole('dialog')).toBeTruthy());
		expect((getByRole('textbox', { name: /nickname/i }) as HTMLInputElement).value).toBe(
			'BraveDie',
		);
	});

	it('waits for the claim set before opening, so it cannot offer a link that already exists', async () => {
		auth.authStore.guestsLoaded = false;
		signIn();
		const { queryByRole } = render(FirstLoginOnboarding);
		await waitFor(() => expect(auth.authStore.loadGuests).toHaveBeenCalled());
		expect(queryByRole('dialog')).toBeNull();
	});

	describe('nickname step', () => {
		it('keeps the generated name without calling the server', async () => {
			signIn();
			const { getByRole, queryByRole } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));

			await fireEvent.click(getByRole('button', { name: /keep this name/i }));
			expect(auth.authStore.rename).not.toHaveBeenCalled();
			// Nothing to claim (no anonymous games), so keeping the name ends onboarding outright.
			await waitFor(() => expect(queryByRole('dialog')).toBeNull());
			expect(isOnboarded(ACCOUNT.id)).toBe(true);
		});

		it('renames through the store when the name was edited', async () => {
			signIn();
			auth.authStore.rename.mockResolvedValue({ outcome: 'updated', me: ACCOUNT });
			const { getByRole } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));

			await fireEvent.input(getByRole('textbox', { name: /nickname/i }), {
				target: { value: 'QuietRook' },
			});
			await fireEvent.click(getByRole('button', { name: /save name/i }));
			expect(auth.authStore.rename).toHaveBeenCalledWith('QuietRook');
		});

		it('keeps the dialog open on a taken nickname so another can be tried', async () => {
			signIn();
			auth.authStore.rename.mockResolvedValue({ outcome: 'taken' });
			const { getByRole, getByText } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));

			await fireEvent.input(getByRole('textbox', { name: /nickname/i }), {
				target: { value: 'QuietRook' },
			});
			await fireEvent.click(getByRole('button', { name: /save name/i }));
			await waitFor(() => expect(getByText(/already taken/i)).toBeTruthy());
			expect(getByRole('dialog')).toBeTruthy();
			expect(isOnboarded(ACCOUNT.id)).toBe(false);
		});
	});

	describe('claim step', () => {
		beforeEach(() => {
			opponents.playerOpponentsStore.opponents = [opponentWith(3)];
		});

		it('is offered when this browser has unlinked anonymous games, with the count', async () => {
			signIn();
			const { getByRole, getByText } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));
			await fireEvent.click(getByRole('button', { name: /keep this name/i }));

			await waitFor(() => expect(getByText(/bring your earlier games/i)).toBeTruthy());
			expect(getByText(/3 online games/i)).toBeTruthy();
		});

		it('is skipped when this browser is already linked', async () => {
			auth.authStore.currentGuestLinked = true;
			signIn();
			const { getByRole, queryByRole } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));

			await fireEvent.click(getByRole('button', { name: /keep this name/i }));
			await waitFor(() => expect(queryByRole('dialog')).toBeNull());
		});

		it('links through the store and confirms', async () => {
			signIn();
			auth.authStore.claimCurrentGuest.mockResolvedValue({ outcome: 'linked', guests: ['g'] });
			const { getByRole } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));
			await fireEvent.click(getByRole('button', { name: /keep this name/i }));
			await waitFor(() => getByRole('button', { name: /yes, add them/i }));

			await fireEvent.click(getByRole('button', { name: /yes, add them/i }));
			expect(auth.authStore.claimCurrentGuest).toHaveBeenCalledOnce();
			await waitFor(() => expect(toasts.toastStore.success).toHaveBeenCalled());
			expect(isOnboarded(ACCOUNT.id)).toBe(true);
		});

		it('closes without a retry when the history belongs to another account', async () => {
			signIn();
			auth.authStore.claimCurrentGuest.mockResolvedValue({ outcome: 'claimed-by-another' });
			const { getByRole, queryByRole } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));
			await fireEvent.click(getByRole('button', { name: /keep this name/i }));
			await waitFor(() => getByRole('button', { name: /yes, add them/i }));

			await fireEvent.click(getByRole('button', { name: /yes, add them/i }));
			// Terminal: one guest identity, one account, forever — a retry cannot succeed.
			await waitFor(() => expect(queryByRole('dialog')).toBeNull());
			expect(toasts.toastStore.error).toHaveBeenCalled();
		});

		it('marks onboarding done when declined, so it does not come back', async () => {
			signIn();
			const { getByRole, queryByRole } = render(FirstLoginOnboarding);
			await waitFor(() => getByRole('dialog'));
			await fireEvent.click(getByRole('button', { name: /keep this name/i }));
			await waitFor(() => getByRole('button', { name: /no thanks/i }));

			await fireEvent.click(getByRole('button', { name: /no thanks/i }));
			await waitFor(() => expect(queryByRole('dialog')).toBeNull());
			expect(isOnboarded(ACCOUNT.id)).toBe(true);
			expect(auth.authStore.claimCurrentGuest).not.toHaveBeenCalled();
		});
	});

	it('dismisses on Escape, and counts that as dealt with', async () => {
		signIn();
		const { getByRole, queryByRole } = render(FirstLoginOnboarding);
		await waitFor(() => getByRole('dialog'));

		await fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(queryByRole('dialog')).toBeNull());
		expect(isOnboarded(ACCOUNT.id)).toBe(true);
	});
});
