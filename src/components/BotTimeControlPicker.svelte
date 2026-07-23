<script lang="ts">
	// A flat sibling of TimeControlPicker (which is hardwired to the grouped lobby presets): the
	// catalog's 6 presets don't need Blitz/Rapid grouping, and this only reads `.label`, so it stays
	// decoupled from whichever preset shape the caller passes.
	let {
		presets,
		selected = $bindable(0),
	}: { presets: readonly { label: string }[]; selected?: number } = $props();
</script>

<fieldset class="flex flex-col gap-1.5">
	<legend class="sr-only">Time control</legend>
	<div class="flex flex-wrap gap-2">
		{#each presets as preset, index (preset.label)}
			<label
				class="cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-bold tabular-nums transition-colors focus-within:ring-2 focus-within:ring-primary/50
					{selected === index
					? 'border-primary bg-primary text-primary-content'
					: 'border-border bg-surface text-content-muted hover:text-content'}"
			>
				<input
					type="radio"
					name="botTimeControl"
					value={index}
					bind:group={selected}
					class="sr-only"
				/>
				{preset.label}
			</label>
		{/each}
	</div>
</fieldset>
