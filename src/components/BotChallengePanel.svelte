<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getGuestUuid } from '$lib/ingest/guestIdentity';
	import { PlayBotError, playBot, wakeBot } from '$lib/catalog/catalogApi';
	import { buildJoinUrl } from '$lib/live/seatLink';
	import { botTimeControlPresets, defaultBotTimeControlIndex } from '$lib/live/timeControls';
	import BotTimeControlPicker from './BotTimeControlPicker.svelte';

	// The wake -> configure -> start flow for challenging a rated bot, shared by the catalog card
	// (src/routes/bots) and each bot's profile page (src/routes/bots/[team]/[name]): click wakes the
	// bot (a scale-to-zero endpoint may need a cold start), then — if it answered — offers the game
	// config inline. Only team/name are needed; callers own their own layout/wrapper around this panel.
	let { team, name }: { team: string; name: string } = $props();

	type Phase = 'idle' | 'waking' | 'dead' | 'ready' | 'starting';
	type ColorChoice = 'random' | 'White' | 'Black';
	let phase = $state<Phase>('idle');
	let selectedTimeControl = $state(defaultBotTimeControlIndex);
	let preferredColor = $state<ColorChoice>('random');
	let error = $state<string | null>(null);
	// Guards the async start() flow below: if the panel unmounts (visitor navigates away) while
	// playBot is in flight, the resolved/rejected continuation must not redirect or touch state.
	let destroyed = false;
	onDestroy(() => {
		destroyed = true;
	});

	const colorOptions: readonly { value: ColorChoice; label: string }[] = [
		{ value: 'random', label: 'Random' },
		{ value: 'White', label: 'White' },
		{ value: 'Black', label: 'Black' },
	];

	async function wake() {
		phase = 'waking';
		error = null;
		try {
			const result = await wakeBot(team, name);
			phase = result.alive ? 'ready' : 'dead';
		} catch {
			phase = 'dead';
		}
	}

	async function start() {
		if (phase === 'starting') return;
		phase = 'starting';
		error = null;
		try {
			const match = await playBot({
				guestId: getGuestUuid(),
				team,
				name,
				timeControl: botTimeControlPresets[selectedTimeControl].value,
				...(preferredColor === 'random' ? {} : { preferredColor }),
			});
			if (destroyed) return;
			// Full navigation: the board page connects fresh from the seat token in the URL — same
			// pattern the lobby's seek-accept flow uses (see lobby/+page.svelte's goToBoard).
			window.location.href = buildJoinUrl(location.origin, match.gameId, match.token, match.seat);
		} catch (e) {
			if (destroyed) return;
			// 409 (an unfinished catalog game already in progress) is worth naming specifically — the
			// visitor can go finish it. Every other failure collapses to one honest message, same
			// philosophy as the lobby's create/accept: there's nothing more useful to say.
			error =
				e instanceof PlayBotError && e.status === 409
					? 'You already have a game in progress — finish it before starting another.'
					: 'Could not start the game right now — try again in a minute.';
			phase = 'ready';
		}
	}
</script>

{#if phase === 'idle'}
	<button
		type="button"
		onclick={wake}
		class="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-content transition-colors hover:bg-primary-hover"
	>
		Play →
	</button>
{:else if phase === 'waking'}
	<p class="text-sm text-content-muted" aria-live="polite">Waking the bot…</p>
{:else if phase === 'dead'}
	<div class="flex flex-col gap-2">
		<p class="text-sm text-danger" role="alert">This bot isn't answering right now.</p>
		<button
			type="button"
			onclick={wake}
			class="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-content-muted transition-colors hover:text-content"
		>
			Try again
		</button>
	</div>
{:else}
	<div class="flex flex-col gap-3">
		<BotTimeControlPicker
			presets={botTimeControlPresets}
			name="botTimeControl-{team}-{name}"
			bind:selected={selectedTimeControl}
		/>

		<fieldset class="flex flex-col gap-1.5">
			<legend class="text-[10px] font-bold tracking-widest text-content-muted/80 uppercase">
				Color
			</legend>
			<div class="flex flex-wrap gap-2">
				{#each colorOptions as opt (opt.value)}
					<label
						class="cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors focus-within:ring-2 focus-within:ring-primary/50
							{preferredColor === opt.value
							? 'border-primary bg-primary text-primary-content'
							: 'border-border bg-surface text-content-muted hover:text-content'}"
					>
						<input
							type="radio"
							name="preferredColor-{team}-{name}"
							value={opt.value}
							bind:group={preferredColor}
							class="sr-only"
						/>
						{opt.label}
					</label>
				{/each}
			</div>
		</fieldset>

		{#if error}<p class="text-sm text-danger" role="alert">{error}</p>{/if}

		<button
			type="button"
			onclick={start}
			disabled={phase === 'starting'}
			class="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-content transition-colors hover:bg-primary-hover disabled:opacity-60"
		>
			{phase === 'starting' ? 'Starting…' : 'Start game'}
		</button>
	</div>
{/if}
