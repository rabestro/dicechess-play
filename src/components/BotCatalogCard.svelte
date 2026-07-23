<script lang="ts">
	import { getGuestUuid } from '$lib/ingest/guestIdentity';
	import { type CatalogBot, PlayBotError, playBot, wakeBot } from '$lib/catalog/catalogApi';
	import { buildJoinUrl } from '$lib/live/seatLink';
	import { botTimeControlPresets, defaultBotTimeControlIndex } from '$lib/live/timeControls';
	import BotBadge from './BotBadge.svelte';
	import BotTimeControlPicker from './BotTimeControlPicker.svelte';

	// One catalog card, self-contained: click wakes the bot (a scale-to-zero endpoint may need a
	// cold start), then — if it answered — offers the game config inline. Phase lives per-card, not
	// on the page, so browsing one bot's config never disturbs the others in the grid.
	let { bot }: { bot: CatalogBot } = $props();

	type Phase = 'idle' | 'waking' | 'dead' | 'ready' | 'starting';
	type ColorChoice = 'random' | 'White' | 'Black';
	let phase = $state<Phase>('idle');
	let selectedTimeControl = $state(defaultBotTimeControlIndex);
	let preferredColor = $state<ColorChoice>('random');
	let error = $state<string | null>(null);

	const colorOptions: readonly { value: ColorChoice; label: string }[] = [
		{ value: 'random', label: 'Random' },
		{ value: 'White', label: 'White' },
		{ value: 'Black', label: 'Black' },
	];

	const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

	async function wake() {
		phase = 'waking';
		error = null;
		try {
			const result = await wakeBot(bot.team, bot.name);
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
				team: bot.team,
				name: bot.name,
				timeControl: botTimeControlPresets[selectedTimeControl].value,
				...(preferredColor === 'random' ? {} : { preferredColor }),
			});
			// Full navigation: the board page connects fresh from the seat token in the URL — same
			// pattern the lobby's seek-accept flow uses (see lobby/+page.svelte's goToBoard).
			window.location.href = buildJoinUrl(location.origin, match.gameId, match.token, match.seat);
		} catch (e) {
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

<div class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
	<div class="flex flex-col gap-1">
		<span class="flex min-w-0 items-center gap-1.5">
			<b class="truncate font-semibold text-content">{bot.team} {bot.name}</b>
			<BotBadge />
		</span>
		<span class="font-mono text-xs tabular-nums text-content-muted">
			<b class="text-content">{wholeNumber.format(bot.rating)}</b>
			±{wholeNumber.format(bot.rd)}
			{#if bot.provisional}<span class="italic">· provisional</span>{/if}
		</span>
		{#if bot.description}
			<p class="text-sm text-content-muted">{bot.description}</p>
		{/if}
	</div>

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
				name="botTimeControl-{bot.team}-{bot.name}"
				bind:selected={selectedTimeControl}
			/>

			<fieldset class="flex flex-col gap-1.5">
				<legend class="text-[10px] font-bold tracking-widest text-content-muted/80 uppercase">
					Colour
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
								name="preferredColor-{bot.team}-{bot.name}"
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
				{phase === 'starting' ? 'Starting…' : 'Start Game'}
			</button>
		</div>
	{/if}
</div>
