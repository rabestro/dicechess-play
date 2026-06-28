<script lang="ts">
	import { timeControlPresets } from '$lib/live/timeControls';

	// Bound to the selected preset index. Native radios in a fieldset give keyboard nav + focus for free.
	let { selected = $bindable() }: { selected: number } = $props();
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="text-sm font-bold text-content-muted">Time control</legend>
	<div class="flex flex-wrap gap-2">
		{#each timeControlPresets as p, i (p.label)}
			<label
				class="px-3 py-1.5 rounded-lg border text-sm font-bold transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-primary/50
					{selected === i
					? 'border-primary bg-primary text-primary-content'
					: 'border-border bg-surface text-content-muted hover:text-content'}"
			>
				<input type="radio" name="timeControl" value={i} bind:group={selected} class="sr-only" />
				{p.label}
			</label>
		{/each}
	</div>
</fieldset>
