<script lang="ts">
	import { resolve } from '$app/paths';
	import { createGame, isLiveEnabled } from '$lib/live/liveApi';
	import { buildJoinUrl } from '$lib/live/seatLink';
	import { getGuestId } from '$lib/ingest/guestIdentity';

	let creating = $state(false);
	let error = $state<string | null>(null);
	let shareUrl = $state<string | null>(null);
	let boardUrl = $state<string | null>(null);
	let copied = $state(false);

	async function create() {
		creating = true;
		error = null;
		try {
			const guest = getGuestId();
			const res = await createGame(guest, guest);
			const white = res.tokens.find((t) => t.seat === 'White');
			const black = res.tokens.find((t) => t.seat === 'Black');
			if (!white || !black) throw new Error('Server did not return both seat tokens');
			shareUrl = buildJoinUrl(location.origin, res.gameId, black.token, 'Black');
			boardUrl = `${resolve('/live/[id]', { id: res.gameId })}?seat=${white.token}&as=white`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create game';
		} finally {
			creating = false;
		}
	}

	async function copy() {
		if (!shareUrl) return;
		await navigator.clipboard?.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<section class="max-w-md mx-auto flex flex-col gap-6">
	<h2 class="text-2xl font-bold text-content">Play a friend</h2>

	{#if !isLiveEnabled()}
		<p class="text-content-muted">
			Live play is not configured. Set <code>VITE_PLAY_API_URL</code> to the play-api server.
		</p>
	{:else if !shareUrl}
		<p class="text-content-muted">
			Create a game, send the link to your opponent, and open your board. You play White.
		</p>
		<button
			type="button"
			onclick={create}
			disabled={creating}
			class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold text-lg shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors disabled:opacity-60"
		>
			{creating ? 'Creating…' : 'Create game'}
		</button>
		{#if error}<p class="text-sm text-red-500">{error}</p>{/if}
	{:else}
		<div class="flex flex-col gap-2">
			<span class="text-sm font-bold text-content-muted"
				>Send this link to your opponent (Black):</span
			>
			<div class="flex gap-2">
				<input
					readonly
					value={shareUrl}
					class="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-content text-sm font-mono"
				/>
				<button
					type="button"
					onclick={copy}
					class="px-4 py-2 rounded-lg bg-surface border border-border text-content-muted hover:text-content font-bold"
				>
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>
		<!-- boardUrl is built with resolve() above; the rule just can't trace it through a variable
		     (it also carries a ?seat=…&as=… query that resolve() can't express). -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={boardUrl}
			class="px-6 py-3 rounded-xl bg-primary text-primary-content font-bold text-lg text-center shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
		>
			Open your board →
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
</section>
