import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

const toasts = vi.hoisted(() => ({
	toastStore: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('$lib/toastStore.svelte', () => toasts);

// A mutable stand-in for the store: these tests are about how each rename outcome is surfaced, and
// the real store can only produce those outcomes by talking to play-api.
const auth = vi.hoisted(() => ({
	authStore: {
		account: null as {
			id: string;
			nickname: string;
			rating: number;
			rd: number;
			provisional: boolean;
		} | null,
		nickname: null as string | null,
		initial: null as string | null,
		rename: vi.fn(),
		signOut: vi.fn(),
	},
}));
vi.mock('$lib/authStore.svelte', () => auth);

import AccountPanel from './AccountPanel.svelte';

const ME = { id: 'a-uuid', nickname: 'BraveDie', rating: 1500.4, rd: 350, provisional: true };

function signIn(over: Partial<typeof ME> = {}) {
	auth.authStore.account = { ...ME, ...over };
	auth.authStore.nickname = auth.authStore.account.nickname;
	auth.authStore.initial = auth.authStore.account.nickname[0].toUpperCase();
}

// The narrow signature actually used below. `ReturnType<typeof render>['getByRole']` is a union that
// includes `null` and promises, which `fireEvent` cannot take — declaring what we use keeps the
// helper honest instead of casting at every call.
type GetByRole = (role: string, options?: { name?: RegExp | string }) => HTMLElement;

/** Opens the inline editor and submits `next`. */
async function rename(getByRole: GetByRole, next: string) {
	await fireEvent.click(getByRole('button', { name: /rename/i }));
	await fireEvent.input(getByRole('textbox', { name: /nickname/i }), { target: { value: next } });
	await fireEvent.click(getByRole('button', { name: /^save$/i }));
}

describe('AccountPanel', () => {
	beforeEach(() => {
		auth.authStore.account = null;
		auth.authStore.nickname = null;
		auth.authStore.initial = null;
		auth.authStore.rename.mockReset();
		auth.authStore.signOut.mockReset();
		toasts.toastStore.success.mockReset();
		toasts.toastStore.error.mockReset();
	});

	it('renders nothing without an account — the guest view is the page default', () => {
		const { container } = render(AccountPanel);
		expect(container.textContent?.trim()).toBe('');
	});

	it('shows the nickname and the rounded rating', () => {
		signIn();
		const { getByText } = render(AccountPanel);
		expect(getByText('BraveDie')).toBeTruthy();
		expect(getByText('1500')).toBeTruthy();
	});

	it('explains a provisional rating, so a missing board entry does not read as a bug', () => {
		signIn({ provisional: true });
		const { getByText } = render(AccountPanel);
		expect(getByText(/provisional/i)).toBeTruthy();
	});

	it('says nothing about provisional once the rating has settled', () => {
		signIn({ provisional: false });
		const { queryByText } = render(AccountPanel);
		expect(queryByText(/provisional/i)).toBeNull();
	});

	describe('rename', () => {
		it('delegates to the store and confirms on success', async () => {
			signIn();
			auth.authStore.rename.mockResolvedValue({
				outcome: 'updated',
				me: { ...ME, nickname: 'QuietRook' },
			});
			const { getByRole } = render(AccountPanel);

			await rename(getByRole, 'QuietRook');
			expect(auth.authStore.rename).toHaveBeenCalledWith('QuietRook');
			expect(toasts.toastStore.success).toHaveBeenCalled();
		});

		it('reports a taken nickname inline and keeps the editor open to try another', async () => {
			signIn();
			auth.authStore.rename.mockResolvedValue({ outcome: 'taken' });
			const { getByRole, getByText } = render(AccountPanel);

			await rename(getByRole, 'QuietRook');
			expect(getByText(/already taken/i)).toBeTruthy();
			// Still editable — a 409 is something the person fixes by choosing again.
			expect(getByRole('textbox', { name: /nickname/i })).toBeTruthy();
		});

		it("shows play-api's own reason verbatim rather than a guess at the rule", async () => {
			signIn();
			auth.authStore.rename.mockResolvedValue({
				outcome: 'invalid',
				reason: 'that nickname is reserved',
			});
			const { getByRole, getByText } = render(AccountPanel);

			await rename(getByRole, 'admin');
			expect(getByText('that nickname is reserved')).toBeTruthy();
		});

		it('does not call the server when the name is unchanged', async () => {
			signIn();
			const { getByRole } = render(AccountPanel);

			await rename(getByRole, 'BraveDie');
			expect(auth.authStore.rename).not.toHaveBeenCalled();
		});

		it('does not call the server for an empty name', async () => {
			signIn();
			const { getByRole } = render(AccountPanel);

			await rename(getByRole, '   ');
			expect(auth.authStore.rename).not.toHaveBeenCalled();
		});
	});

	it('signs out through the store', async () => {
		signIn();
		const { getByRole } = render(AccountPanel);
		await fireEvent.click(getByRole('button', { name: /sign out/i }));
		expect(auth.authStore.signOut).toHaveBeenCalledOnce();
	});
});
