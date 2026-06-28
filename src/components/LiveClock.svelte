<script lang="ts">
	import { formatClock, isLowTime } from '$lib/live/clockFormat';

	interface Props {
		ms: number;
		active: boolean;
		label: string;
	}
	let { ms, active, label }: Props = $props();

	const low = $derived(isLowTime(ms));
</script>

<div
	class="flex items-center justify-between gap-3 w-full rounded-xl border px-3 py-1.5 transition-colors
		{active ? 'border-border-strong bg-surface' : 'border-border bg-surface/50 opacity-80'}"
	aria-label="{label} clock"
>
	<span class="text-sm text-content-muted">{label}</span>
	<span
		class="font-mono tabular-nums text-lg font-bold {low ? 'text-danger' : 'text-content'}"
		class:animate-pulse={active && low}
	>
		{formatClock(ms)}
	</span>
</div>
