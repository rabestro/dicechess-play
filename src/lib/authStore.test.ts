import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '$lib/auth/authApi';

// The store is a module-level singleton, so every test imports it fresh — otherwise state from one
// case (a signed-in account, say) leaks into the next and the suite passes for the wrong reason.
const ME: Me = {
	id: 'account-uuid',
	nickname: 'BraveDie',
	rating: 1500,
	rd: 350,
	provisional: true,
};

const authApi = vi.hoisted(() => ({
	fetchMe: vi.fn(),
	logout: vi.fn(),
	isAuthEnabled: vi.fn(() => true),
	loginUrl: vi.fn(() => 'http://localhost:8080/auth/login'),
}));

vi.mock('$lib/auth/authApi', () => authApi);
vi.mock('$lib/ingest/guestIdentity', () => ({ getGuestUuid: () => 'guest-uuid' }));

async function freshStore() {
	vi.resetModules();
	return (await import('./authStore.svelte')).authStore;
}

describe('initialOf', () => {
	it('uppercases the first character, since the badge is a single glyph', async () => {
		const { initialOf } = await import('./authStore.svelte');
		expect(initialOf('bravedie')).toBe('B');
	});

	it('ignores surrounding whitespace rather than rendering a blank badge', async () => {
		const { initialOf } = await import('./authStore.svelte');
		expect(initialOf('  quietRook ')).toBe('Q');
	});

	it('falls back to "?" for a name with nothing in it', async () => {
		const { initialOf } = await import('./authStore.svelte');
		expect(initialOf('   ')).toBe('?');
		expect(initialOf('')).toBe('?');
	});

	it('takes whole characters, so an astral glyph is not split into half a surrogate pair', async () => {
		const { initialOf } = await import('./authStore.svelte');
		// Naive `nickname[0]` would return a lone surrogate here and render as a replacement box.
		expect(initialOf('🎲roller')).toBe('🎲');
	});

	it('leaves a caseless script alone instead of mangling it', async () => {
		const { initialOf } = await import('./authStore.svelte');
		expect(initialOf('日本語')).toBe('日');
	});
});

describe('authStore', () => {
	beforeEach(() => {
		authApi.fetchMe.mockReset();
		authApi.logout.mockReset().mockResolvedValue(undefined);
		authApi.isAuthEnabled.mockReset().mockReturnValue(true);
		authApi.loginUrl.mockReset().mockReturnValue('http://localhost:8080/auth/login');
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('starts as loading, so the nav renders nothing rather than flashing "Sign in"', async () => {
		const store = await freshStore();
		expect(store.status).toBe('loading');
		expect(store.isLoading).toBe(true);
		expect(store.isAuthenticated).toBe(false);
	});

	it('adopts the account on a successful refresh', async () => {
		authApi.fetchMe.mockResolvedValue({ outcome: 'signed-in', me: ME });
		const store = await freshStore();
		await store.refresh();
		expect(store.status).toBe('signed-in');
		expect(store.isAuthenticated).toBe(true);
		expect(store.nickname).toBe('BraveDie');
		expect(store.account).toEqual(ME);
	});

	it('settles on signed-out for an anonymous visitor, which is a normal state here', async () => {
		authApi.fetchMe.mockResolvedValue({ outcome: 'signed-out' });
		const store = await freshStore();
		await store.refresh();
		expect(store.status).toBe('signed-out');
		expect(store.nickname).toBeNull();
	});

	it('distinguishes "could not ask" from "signed out"', async () => {
		authApi.fetchMe.mockResolvedValue({ outcome: 'unavailable' });
		const store = await freshStore();
		await store.refresh();
		expect(store.status).toBe('unavailable');
	});

	describe('externalId', () => {
		it('is the guest identity while anonymous — never the old user:guest', async () => {
			authApi.fetchMe.mockResolvedValue({ outcome: 'signed-out' });
			const store = await freshStore();
			await store.refresh();
			expect(store.externalId).toBe('guest:guest-uuid');
		});

		it('becomes the account identity once signed in', async () => {
			authApi.fetchMe.mockResolvedValue({ outcome: 'signed-in', me: ME });
			const store = await freshStore();
			await store.refresh();
			expect(store.externalId).toBe('user:account-uuid');
		});

		it('stays the guest identity when the account could not be fetched', async () => {
			authApi.fetchMe.mockResolvedValue({ outcome: 'unavailable' });
			const store = await freshStore();
			await store.refresh();
			expect(store.externalId).toBe('guest:guest-uuid');
		});
	});

	describe('the legacy surface the play-with-bot store consumes', () => {
		it('mirrors the nickname onto user.name so ported components keep working', async () => {
			authApi.fetchMe.mockResolvedValue({ outcome: 'signed-in', me: ME });
			const store = await freshStore();
			await store.refresh();
			expect(store.user.id).toBe('account-uuid');
			expect(store.user.name).toBe('BraveDie');
		});

		it('keeps balance local and clamped at zero — it is not an account balance', async () => {
			const store = await freshStore();
			store.adjustBalance(50);
			expect(store.user.balance).toBe(50);
			store.adjustBalance(-500);
			expect(store.user.balance).toBe(0);
		});

		it('reports guests as approved, since the public site has no approval gate', async () => {
			const store = await freshStore();
			expect(store.isApproved).toBe(true);
			expect(store.isAdmin).toBe(false);
		});
	});

	describe('signIn', () => {
		it('is a full-page navigation, because an XHR cannot carry the Google round-trip', async () => {
			const assign = vi.fn();
			vi.stubGlobal('window', { location: { assign } });
			const store = await freshStore();
			store.signIn();
			expect(assign).toHaveBeenCalledWith('http://localhost:8080/auth/login');
		});

		it('does nothing when accounts are unreachable, rather than navigating to a dead URL', async () => {
			authApi.isAuthEnabled.mockReturnValue(false);
			const assign = vi.fn();
			vi.stubGlobal('window', { location: { assign } });
			const store = await freshStore();
			store.signIn();
			expect(assign).not.toHaveBeenCalled();
		});
	});

	describe('signOut', () => {
		it('clears the account', async () => {
			authApi.fetchMe.mockResolvedValue({ outcome: 'signed-in', me: ME });
			const store = await freshStore();
			await store.refresh();
			await store.signOut();
			expect(store.status).toBe('signed-out');
			expect(store.account).toBeNull();
			expect(store.externalId).toBe('guest:guest-uuid');
		});

		it('clears local state even when the logout request fails, so the UI cannot get stuck', async () => {
			authApi.fetchMe.mockResolvedValue({ outcome: 'signed-in', me: ME });
			// The transport swallows its own failures today; this drives the store's own guarantee, so
			// the UI cannot be left claiming a signed-in session if that ever changes.
			authApi.logout.mockRejectedValue(new TypeError('network down'));
			const store = await freshStore();
			await store.refresh();
			await expect(store.signOut()).rejects.toThrow();
			expect(store.status).toBe('signed-out');
			expect(store.account).toBeNull();
			expect(store.externalId).toBe('guest:guest-uuid');
		});
	});
});
