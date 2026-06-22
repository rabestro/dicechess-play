<script lang="ts">
	// Landing page — anonymous visitor lands here and jumps straight into a game.
	import { resolve } from '$app/paths';
</script>

<section class="flex flex-col items-center text-center gap-8 py-12">
	<div class="flex flex-col gap-3">
		<h2 class="text-3xl sm:text-4xl font-bold text-content">Play Dice Chess</h2>
		<p class="max-w-xl text-content-muted leading-relaxed">
			Roll the dice, move your pieces, capture the king. Play a full game against one of our bots
			right in your browser — no sign-up, nothing to install.
		</p>
	</div>

	<a
		href={resolve('/play')}
		class="px-8 py-3 rounded-xl bg-primary text-primary-content font-bold text-lg shadow-lg shadow-primary/30 hover:bg-primary-hover transition-colors"
	>
		Play vs a bot →
	</a>

	<p class="text-xs text-content-muted/70 max-w-md">
		Finished games are recorded anonymously to improve our analytics. You stay a guest — no account
		required.
	</p>
</section>
