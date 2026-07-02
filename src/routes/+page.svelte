<script lang="ts">
	// Landing page — three ways to play, straight to the point.
	import { resolve } from '$app/paths';

	const ways = [
		{
			path: '/play',
			title: 'Play a bot',
			sub: '6 levels, instant',
			icon: 'bot',
		},
		{
			path: '/live',
			title: 'Play a friend',
			sub: 'share a link',
			icon: 'link',
		},
		{
			path: '/lobby',
			title: 'Open lobby',
			sub: 'find an opponent',
			icon: 'users',
		},
	] as const;
</script>

{#snippet wayIcon(icon: 'bot' | 'link' | 'users')}
	<svg
		viewBox="0 0 24 24"
		class="h-6 w-6"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if icon === 'bot'}
			<rect x="4.5" y="8" width="15" height="11" rx="3" /><path d="M12 4.5v3.5" /><circle
				cx="12"
				cy="4"
				r="1.3"
				fill="currentColor"
				stroke="none"
			/><circle cx="9.3" cy="13" r="1.25" fill="currentColor" stroke="none" /><circle
				cx="14.7"
				cy="13"
				r="1.25"
				fill="currentColor"
				stroke="none"
			/>
		{:else if icon === 'link'}
			<path d="M9.5 14.5l5-5" /><path d="M8 12l-1.6 1.6a3.4 3.4 0 0 0 4.8 4.8L13 16.5" /><path
				d="M16 12l1.6-1.6a3.4 3.4 0 0 0-4.8-4.8L11 7.5"
			/>
		{:else}
			<circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path
				d="M16 6.4a3 3 0 0 1 0 5.4M17 14.3c2.4.5 4 2.3 4 4.7"
			/>
		{/if}
	</svg>
{/snippet}

<section class="flex flex-col items-center gap-8 py-8 sm:py-12">
	<div class="flex flex-col items-center gap-3 text-center">
		<span
			class="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30"
		>
			<span class="text-3xl">🎲</span>
		</span>
		<h2 class="text-3xl sm:text-4xl font-bold text-content">Play Dice Chess</h2>
		<p class="max-w-xl text-content-muted leading-relaxed">
			Roll the dice, move your pieces, capture the king. A full game right in your browser — no
			sign-up, nothing to install.
		</p>
	</div>

	<div class="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
		{#each ways as w (w.path)}
			<a
				href={resolve(w.path)}
				class="group flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary"
			>
				<span
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
				>
					{@render wayIcon(w.icon)}
				</span>
				<span class="flex min-w-0 flex-col gap-0.5">
					<b class="text-[15px] font-semibold text-content">{w.title}</b>
					<small class="text-xs text-content-muted">{w.sub}</small>
				</span>
			</a>
		{/each}
	</div>

	<p class="max-w-md text-center text-xs text-content-muted/70">
		Finished games are recorded anonymously to improve our analytics. You stay a guest — no account
		required.
	</p>
</section>
