// Guest identity for the public play site.
//
// Phase 1 has no accounts: every visitor is an anonymous guest. This module mirrors
// the surface of the lab authStore (`user`, `isApproved`, `isAdmin`, `adjustBalance`)
// so the ported play-with-bot store and components type-check and run unchanged — but
// it never talks to a backend. There is no login; `balance` is a local-only number for
// the (guest-disabled) betting UI. The real, durable per-browser guest identity that
// reaches analytics lives in `$lib/ingest/guestIdentity`.
//
// When server-authoritative accounts arrive (roadmap phase 3), this is replaced by a
// real auth store issuing `user:<uuid>` identities.

export interface User {
	id: string;
	email: string;
	name: string | null;
	picture_url: string | null;
	role: string;
	is_approved: boolean;
	balance: number;
}

const GUEST_USER: User = {
	id: 'guest',
	email: '',
	name: 'Guest',
	picture_url: null,
	role: 'GUEST',
	is_approved: true,
	balance: 0,
};

function createAuthStore() {
	const user = $state<User>({ ...GUEST_USER });

	function adjustBalance(amount: number) {
		user.balance = Math.max(0, user.balance + amount);
	}

	return {
		get user() {
			return user;
		},
		get isLoading() {
			return false;
		},
		get isAuthenticated() {
			return true;
		},
		// Guests are always "approved" — there is no approval gate on the public site.
		get isApproved() {
			return true;
		},
		get isAdmin() {
			return false;
		},
		adjustBalance,
	};
}

export const authStore = createAuthStore();
