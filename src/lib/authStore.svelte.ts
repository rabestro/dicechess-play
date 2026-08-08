// Identity for the public play site: an anonymous guest by default, a real account once signed in.
//
// Anonymous-first is a product decision, not a limitation (ADR-0017): guest play must never degrade
// or nag, so `status` starts as `loading` and settles on `signed-out` for most visitors — which is a
// normal state here, not a failure. Signing in only ADDS a rating and bot management.
//
// Two things this store deliberately does NOT have:
//
//   - **No email and no Google avatar.** play-api's `/auth/me` answers id/nickname/rating only;
//     email lives in `user_identities` and never reaches a public wire. The nav therefore shows the
//     nickname and a locally derived initial — there is no picture URL to show, and inventing one
//     would mean asking Google for profile scope the backend does not use.
//   - **No token.** The session is an HttpOnly cookie on play-api's host; the SPA cannot read it, so
//     "am I signed in?" is only ever answered by asking the server (`refresh()`).
//
// The `user`/`balance`/`isApproved`/`isAdmin` surface below is kept because the ported lab
// play-with-bot store consumes it. `balance` remains a local-only number for the (guest-disabled)
// betting UI — it is not an account balance and no server knows about it.

import { getGuestUuid } from '$lib/ingest/guestIdentity';
import { fetchMe, isAuthEnabled, loginUrl, logout, type Me } from '$lib/auth/authApi';

export interface User {
	id: string;
	email: string;
	name: string | null;
	picture_url: string | null;
	role: string;
	is_approved: boolean;
	balance: number;
}

/**
 * `loading` until the first `refresh()` settles; `unavailable` means play-api could not be asked
 * (offline, or a deployment with auth switched off), which the UI renders as "signing in is not
 * possible right now" rather than as being signed out.
 */
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unavailable';

const GUEST_USER: User = {
	id: 'guest',
	email: '',
	name: 'Guest',
	picture_url: null,
	role: 'GUEST',
	is_approved: true,
	balance: 0,
};

/** The single uppercase letter the nav shows in place of a Google avatar. */
export function initialOf(nickname: string): string {
	const first = [...nickname.trim()][0];
	return first ? first.toUpperCase() : '?';
}

function createAuthStore() {
	const user = $state<User>({ ...GUEST_USER });
	let status = $state<AuthStatus>('loading');
	let account = $state<Me | null>(null);

	function adjustBalance(amount: number) {
		user.balance = Math.max(0, user.balance + amount);
	}

	function apply(me: Me) {
		account = me;
		status = 'signed-in';
		// Keep the legacy `user` view coherent for the play-with-bot store: same object identity, so
		// existing `$derived` chains over `authStore.user` keep tracking.
		user.id = me.id;
		user.name = me.nickname;
		user.role = 'USER';
	}

	function clear(next: Exclude<AuthStatus, 'signed-in'>) {
		account = null;
		status = next;
		user.id = GUEST_USER.id;
		user.name = GUEST_USER.name;
		user.role = GUEST_USER.role;
	}

	/**
	 * Ask play-api who we are. Safe to call repeatedly — it is also how the UI recovers after a
	 * session expires server-side, since nothing local can detect that.
	 */
	async function refresh(): Promise<AuthStatus> {
		const result = await fetchMe();
		if (result.outcome === 'signed-in') apply(result.me);
		else clear(result.outcome);
		return status;
	}

	/**
	 * Start the login round-trip. A full-page navigation, not a fetch: play-api 303s to Google and
	 * back, and only a real navigation can carry the user through that and land the cookie.
	 */
	function signIn(): void {
		if (!isAuthEnabled()) return;
		window.location.assign(loginUrl());
	}

	/**
	 * End the session. Local state is cleared regardless of what the request did — a failed logout
	 * must not leave the UI insisting the person is still signed in.
	 */
	async function signOut(): Promise<void> {
		// `finally`, not a plain sequence: the transport already swallows its own failures, but the
		// store must not depend on that. If a future change ever lets an error through, the UI still
		// has to stop claiming the person is signed in.
		try {
			await logout();
		} finally {
			clear('signed-out');
		}
	}

	return {
		get user() {
			return user;
		},
		get account() {
			return account;
		},
		get status() {
			return status;
		},
		get isLoading() {
			return status === 'loading';
		},
		/** Signed in with a real account — NOT "has an identity", which every visitor has. */
		get isAuthenticated() {
			return status === 'signed-in';
		},
		/** Whether signing in is offered at all; false on a deployment without play-api. */
		get canSignIn() {
			return isAuthEnabled();
		},
		get nickname() {
			return account?.nickname ?? null;
		},
		get initial() {
			return account ? initialOf(account.nickname) : null;
		},
		/**
		 * The external id this browser plays as, in play-api's own vocabulary: `user:<uuid>` when
		 * signed in, `guest:<uuid>` otherwise. Local game records used to build `user:${id}` from the
		 * stub, which produced the meaningless `user:guest` for every anonymous game — harmless while
		 * it stayed in localStorage, but wrong the moment accounts made `user:` mean something.
		 */
		get externalId() {
			return account ? `user:${account.id}` : `guest:${getGuestUuid()}`;
		},
		// Guests are always "approved" — there is no approval gate on the public site.
		get isApproved() {
			return true;
		},
		get isAdmin() {
			return false;
		},
		adjustBalance,
		refresh,
		signIn,
		signOut,
	};
}

export const authStore = createAuthStore();
