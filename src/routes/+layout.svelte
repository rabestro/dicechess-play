<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { themeStore } from '$lib/stores/themeStore.svelte';
	import type { Theme } from '$lib/stores/themeStore.svelte';
	import ToastContainer from '../components/ToastContainer.svelte';
	import { resolve } from '$app/paths';

	let { children }: { children: Snippet } = $props();

	const themes: { value: Theme; label: string }[] = [
		{ value: 'dark', label: 'Dark' },
		{ value: 'light', label: 'Light' },
		{ value: 'dracula', label: 'Dracula' },
		{ value: 'nord', label: 'Nord' },
		{ value: 'solarized-dark', label: 'Solarized' },
		{ value: 'tokyo-night', label: 'Tokyo Night' },
		{ value: 'gruvbox', label: 'Gruvbox' },
	];
</script>

<div class="min-h-screen flex flex-col bg-background text-content transition-colors duration-300">
	<header class="w-full border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
		<div class="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
			<a href={resolve('/')} class="flex items-center gap-3 hover:opacity-80 transition-opacity">
				<div
					class="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
				>
					<span class="text-base">🎲</span>
				</div>
				<div class="flex flex-col gap-0.5">
					<h1 class="text-md font-bold tracking-wider text-content uppercase">Dice Chess</h1>
					<span class="text-[9px] text-primary font-bold tracking-widest uppercase">Play</span>
				</div>
			</a>

			<select
				aria-label="Select theme"
				class="bg-surface border border-border text-xs font-bold text-content-muted rounded-md px-2 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
				value={themeStore.theme}
				onchange={(e) => themeStore.setTheme(e.currentTarget.value as Theme)}
			>
				{#each themes as t (t.value)}
					<option value={t.value}>{t.label}</option>
				{/each}
			</select>
		</div>
	</header>

	<main class="flex-grow w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
		{@render children()}
	</main>

	<footer
		class="w-full border-t border-border bg-surface/40 py-5 text-center text-xs text-content-muted"
	>
		<div
			class="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2"
		>
			<p>Dice Chess — Play · anonymous, free.</p>
			<p class="text-[10px] text-content-muted/60">
				AGPL-3.0 · powered by the open-source Dice Chess engine
			</p>
		</div>
	</footer>

	<ToastContainer />
</div>
