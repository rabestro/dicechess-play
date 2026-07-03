<script lang="ts">
	import { resolve } from '$app/paths';
	import { getGuestId } from '$lib/ingest/guestIdentity';
	import { isLiveEnabled } from '$lib/live/liveApi';
	import { listSeeks, createSeek, seekStatus, acceptSeek, cancelSeek } from '$lib/live/lobbyApi';
	import { buildJoinUrl } from '$lib/live/seatLink';
	import { seekOffer } from '$lib/live/playerLabel';
	import { timeControlLabel, timeControlPresets } from '$lib/live/timeControls';
	import TimeControlPicker from '../../components/TimeControlPicker.svelte';
	import type { Seek } from '$lib/live/liveTypes';

	const LIST_POLL_MS = 2000;
	const STATUS_POLL_MS = 1500;

	let seeks = $state<Seek[]>([]);
	let selected = $state(0);
	let error = $state<string | null>(null);
	// When set, we created a seek and are waiting for an opponent (no list shown).
	let waiting = $state<{ id: string; secret: string; label: string } | null>(null);
	let creating = $state(false);
	let accepting = $state(false);

	// The quickstart target: the first standing bot offer (the house bot keeps some open).
	const botSeek = $derived(seeks.find((s) => s.kind === 'Bot'));

	function goToBoard(gameId: string, token: string, seat: 'White' | 'Black') {
		// Full navigation: the board page connects fresh from the seat token in the URL.
		window.location.href = buildJoinUrl(location.origin, gameId, token, seat);
	}

	// Browse: poll the open-seek list while not waiting (and only when live play is configured).
	$effect(() => {
		if (waiting || !isLiveEnabled()) return;
		let alive = true;
		const tick = async () => {
			try {
				const next = await listSeeks();
				if (alive) seeks = next;
			} catch {
				/* transient — keep the last list */
			}
		};
		tick();
		const timer = setInterval(tick, LIST_POLL_MS);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	});

	// Waiting: poll our seek until it's accepted, then go to the board as White.
	$effect(() => {
		const w = waiting;
		if (!w) return;
		let alive = true;
		const tick = async () => {
			try {
				const s = await seekStatus(w.id, w.secret);
				if (alive && s.matched && s.gameId && s.token) goToBoard(s.gameId, s.token, 'White');
			} catch {
				/* transient — keep waiting */
			}
		};
		tick(); // check immediately so a match that already happened redirects without a poll-interval delay
		const timer = setInterval(tick, STATUS_POLL_MS);
		return () => {
			alive = false;
			clearInterval(timer);
		};
	});

	async function create() {
		creating = true;
		error = null;
		try {
			const preset = timeControlPresets[selected];
			const created = await createSeek(getGuestId(), preset.value);
			waiting = { id: created.seekId, secret: created.secret, label: preset.label };
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create seek';
		} finally {
			creating = false;
		}
	}

	async function cancel() {
		const w = waiting;
		if (!w) return;
		waiting = null; // stop polling immediately
		try {
			await cancelSeek(w.id, w.secret);
		} catch {
			/* best-effort; the server TTL reaps it anyway */
		}
	}

	async function accept(seek: Seek) {
		if (accepting) return;
		accepting = true;
		error = null;
		try {
			const match = await acceptSeek(seek.id, getGuestId());
			goToBoard(match.gameId, match.token, 'Black');
		} catch {
			// Lost the race (someone took it) or it expired — refresh the list.
			error = 'That seek was just taken — pick another.';
			try {
				seeks = await listSeeks();
			} catch {
				/* ignore */
			}
		} finally {
			accepting = false;
		}
	}
</script>

<section class="max-w-md mx-auto flex flex-col gap-6">
	<h2 class="text-2xl font-bold text-content">Lobby</h2>

	{#if !isLiveEnabled()}
		<p class="text-content-muted">
			Live play is not configured. Set <code>VITE_PLAY_API_URL</code> to the play-api server.
		</p>
	{:else if waiting}
		<p class="text-content-muted">
			Waiting for an opponent… <span class="text-content font-bold">{waiting.label}</span>
		</p>
		<button
			type="button"
			onclick={cancel}
			class="px-6 py-3 rounded-xl bg-surface border border-border text-content-muted hover:text-content font-bold"
		>
			Cancel
		</button>
	{:else}
		{#if botSeek}
			{@const offer = seekOffer(botSeek)}
			<button
				type="button"
				onclick={() => accept(botSeek)}
				disabled={accepting}
				class="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15 disabled:opacity-60"
			>
				<span class="flex flex-col">
					<span class="font-bold text-content">Play a bot now</span>
					<span class="text-xs text-content-muted">
						{offer.name} · {timeControlLabel(botSeek.timeControl)} · server-side, provably-fair dice
					</span>
				</span>
				<span class="font-bold text-primary">→</span>
			</button>
		{/if}
		<div class="flex flex-col gap-3">
			<TimeControlPicker bind:selected />
			<button
				type="button"
				onclick={create}
				disabled={creating}
				class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold text-lg shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors disabled:opacity-60"
			>
				{creating ? 'Creating…' : 'Create a seek'}
			</button>
		</div>

		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-content-muted">Open seeks</span>
			{#if seeks.length === 0}
				<p class="text-content-muted text-sm">No open seeks yet — create one above.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each seeks as seek (seek.id)}
						{@const offer = seekOffer(seek)}
						<li
							class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 px-4 py-2.5"
						>
							<span class="flex min-w-0 flex-col">
								<span class="font-bold text-content">{timeControlLabel(seek.timeControl)}</span>
								<span class="flex items-center gap-1.5 text-xs text-content-muted">
									<span class="truncate">{offer.name}</span>
									{#if offer.bot}
										<span
											class="shrink-0 rounded bg-primary/15 px-1 py-px text-[10px] font-bold uppercase tracking-wide text-primary"
										>
											bot
										</span>
									{/if}
								</span>
							</span>
							<button
								type="button"
								onclick={() => accept(seek)}
								disabled={accepting}
								class="px-4 py-1.5 rounded-lg bg-primary text-primary-content font-bold hover:bg-primary-hover transition-colors disabled:opacity-60"
							>
								Accept
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if error}<p class="text-sm text-danger">{error}</p>{/if}
		<a href={resolve('/live')} class="text-sm text-content-muted hover:text-content underline">
			Or play a friend by link →
		</a>
	{/if}
</section>
