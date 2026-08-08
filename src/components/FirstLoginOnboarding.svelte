<script lang="ts">
	// First-login onboarding (#194 step 3, ADR-0017): confirm the generated nickname, then offer to
	// adopt this browser's anonymous history.
	//
	// Why a one-time dialog is acceptable on an anonymous-first site: the person just clicked "Sign in".
	// This is the completion of an action they took, not an interruption of one. It never appears for a
	// guest, and it appears at most once per account per browser.
	//
	// Why the claim offer belongs HERE rather than only on /me: the guest identity is per-browser, so
	// the moment right after signing in is the one time we know for certain which anonymous history is
	// in front of us. Someone who signs in, plays as their account, and only later finds /me may have
	// no idea their earlier games can still be adopted.
	//
	// The claim step is skipped entirely when there is nothing to adopt — an offer to link zero games is
	// noise, and it would teach people to dismiss this dialog without reading it.
	import { authStore } from '$lib/authStore.svelte';
	import { toastStore } from '$lib/toastStore.svelte';
	import { isOnboarded, markOnboarded } from '$lib/auth/onboarding';
	import { playerOpponentsStore } from '$lib/stores/playerOpponentsStore.svelte';
	import { aggregateOpponents } from '$lib/stats/lobbyRecord';
	import { totalGames } from '$lib/stats/playerRecord';

	type Step = 'nickname' | 'claim';

	let open = $state(false);
	let step = $state<Step>('nickname');
	let draft = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let primaryButton = $state<HTMLButtonElement | null>(null);
	// The account this dialog opened for. Kept so the guard is written for the right id even if the
	// session changes while the dialog is up.
	let openedFor = $state<string | null>(null);

	const guestGames = $derived(totalGames(aggregateOpponents(playerOpponentsStore.opponents)));

	// Open once, for a signed-in account this browser has not onboarded yet. `guestsLoaded` is part of
	// the condition because the claim step needs to know whether this browser is already linked —
	// asking before that lands would offer a link that may already exist.
	$effect(() => {
		const account = authStore.account;
		if (!account || open || openedFor === account.id) return;
		if (isOnboarded(account.id)) return;
		if (!authStore.guestsLoaded) {
			void authStore.loadGuests();
			return;
		}
		void playerOpponentsStore.load();
		openedFor = account.id;
		draft = account.nickname;
		step = 'nickname';
		open = true;
	});

	$effect(() => {
		if (open) primaryButton?.focus();
	});

	function finish() {
		if (openedFor) markOnboarded(openedFor);
		open = false;
		error = null;
	}

	/** Whether there is anonymous history worth offering to adopt. */
	function hasSomethingToClaim(): boolean {
		return !authStore.currentGuestLinked && guestGames > 0;
	}

	function afterNickname() {
		if (hasSomethingToClaim()) {
			step = 'claim';
			error = null;
		} else finish();
	}

	async function saveNickname() {
		const next = draft.trim();
		if (next === '' || next === authStore.nickname) {
			afterNickname();
			return;
		}
		busy = true;
		error = null;
		const result = await authStore.rename(next);
		busy = false;
		switch (result.outcome) {
			case 'updated':
				afterNickname();
				break;
			case 'taken':
				error = 'That nickname is already taken.';
				break;
			case 'invalid':
				error = result.reason;
				break;
			case 'signed-out':
				finish();
				toastStore.error('You are no longer signed in.');
				break;
			case 'unavailable':
				error = 'Could not reach the server. Try again.';
				break;
		}
	}

	async function claim() {
		busy = true;
		error = null;
		const result = await authStore.claimCurrentGuest();
		busy = false;
		switch (result.outcome) {
			case 'linked':
				finish();
				toastStore.success('Your earlier games are now part of your history.');
				break;
			case 'claimed-by-another':
				// Terminal — one guest identity belongs to one account forever. Close rather than offering
				// a retry that cannot succeed.
				finish();
				toastStore.error('That anonymous history already belongs to another account.');
				break;
			case 'invalid':
				error = result.reason;
				break;
			case 'signed-out':
				finish();
				toastStore.error('You are no longer signed in.');
				break;
			case 'unavailable':
				error = 'Could not reach the server. Try again.';
				break;
		}
	}

	function onKeydown(event: KeyboardEvent) {
		// Escape dismisses, and dismissing counts as done — a prompt that returns after being waved away
		// is worse than one that never appears.
		if (open && event.key === 'Escape') finish();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="onboarding-headline"
	>
		<div
			class="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
		>
			{#if step === 'nickname'}
				<h2 id="onboarding-headline" class="text-xl font-bold text-content">You’re signed in</h2>
				<p class="text-sm text-content-muted">
					We picked a name for you. Keep it, or choose your own — you can change it later on your
					profile.
				</p>
				<form
					onsubmit={(e) => {
						e.preventDefault();
						void saveNickname();
					}}
					class="flex flex-col gap-3"
				>
					<input
						bind:value={draft}
						aria-label="Nickname"
						minlength="3"
						maxlength="24"
						spellcheck="false"
						autocomplete="off"
						class="rounded-lg border border-border bg-background/50 px-3 py-2 text-content outline-none transition-colors focus:border-primary"
					/>
					{#if error}
						<p class="text-xs text-danger" role="alert">{error}</p>
					{/if}
					<div class="flex gap-2">
						<button
							bind:this={primaryButton}
							type="submit"
							disabled={busy}
							class="flex-1 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-content transition-colors hover:bg-primary-hover disabled:opacity-40"
						>
							{busy
								? 'Saving'
								: draft.trim() === authStore.nickname
									? 'Keep this name'
									: 'Save name'}
						</button>
						<button
							type="button"
							onclick={finish}
							class="rounded-xl border border-border bg-surface px-4 py-2.5 font-bold text-content-muted transition-colors hover:text-content"
						>
							Later
						</button>
					</div>
				</form>
			{:else}
				<h2 id="onboarding-headline" class="text-xl font-bold text-content">
					Bring your earlier games?
				</h2>
				<p class="text-sm text-content-muted">
					This browser has {guestGames}
					{guestGames === 1 ? 'online game' : 'online games'} played anonymously. Adding them to your
					account puts them in your own history. They stay private either way, and this cannot be undone.
				</p>
				{#if error}
					<p class="text-xs text-danger" role="alert">{error}</p>
				{/if}
				<div class="flex gap-2">
					<button
						bind:this={primaryButton}
						type="button"
						onclick={() => void claim()}
						disabled={busy}
						class="flex-1 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-content transition-colors hover:bg-primary-hover disabled:opacity-40"
					>
						{busy ? 'Linking' : 'Yes, add them'}
					</button>
					<button
						type="button"
						onclick={finish}
						class="rounded-xl border border-border bg-surface px-4 py-2.5 font-bold text-content-muted transition-colors hover:text-content"
					>
						No thanks
					</button>
				</div>
				<p class="text-xs text-content-muted">You can still do this later from your profile.</p>
			{/if}
		</div>
	</div>
{/if}
