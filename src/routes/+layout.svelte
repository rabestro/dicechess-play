<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { themeStore } from '$lib/stores/themeStore.svelte';
	import type { Theme } from '$lib/stores/themeStore.svelte';
	import { chromeStore } from '$lib/stores/chromeStore.svelte';
	import ToastContainer from '../components/ToastContainer.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { children }: { children: Snippet } = $props();

	const isActive = (path: string) =>
		page.url.pathname === path || page.url.pathname.startsWith(`${path}/`);

	const themes: { value: Theme; label: string }[] = [
		{ value: 'dark', label: 'Dark' },
		{ value: 'light', label: 'Light' },
		{ value: 'dracula', label: 'Dracula' },
		{ value: 'nord', label: 'Nord' },
		{ value: 'solarized-dark', label: 'Solarized' },
		{ value: 'tokyo-night', label: 'Tokyo Night' },
		{ value: 'gruvbox', label: 'Gruvbox' },
	];

	const links = [
		{ path: '/play', label: 'Play' },
		{ path: '/live', label: 'Live' },
		{ path: '/lobby', label: 'Lobby' },
		{ path: '/games', label: 'Games' },
		{ path: '/me', label: 'Profile' },
	] as const;
</script>

{#snippet navIcon(path: string)}
	<svg
		viewBox="0 0 24 24"
		class="h-[21px] w-[21px]"
		fill="none"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if path === '/play'}
			<path d="M4 11l8-6.5 8 6.5" /><path d="M6 10v9h12v-9" />
		{:else if path === '/live'}
			<circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /><path
				d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9"
			/>
		{:else if path === '/lobby'}
			<circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path
				d="M16 6.4a3 3 0 0 1 0 5.4M17 14.3c2.4.5 4 2.3 4 4.7"
			/>
		{:else if path === '/games'}
			<rect x="4" y="4" width="7" height="7" rx="1.5" /><rect
				x="13"
				y="4"
				width="7"
				height="7"
				rx="1.5"
			/><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect
				x="13"
				y="13"
				width="7"
				height="7"
				rx="1.5"
			/>
		{:else}
			<circle cx="12" cy="8" r="3.4" /><path d="M5 19.5c0-3.4 3-6 7-6s7 2.6 7 6" />
		{/if}
	</svg>
{/snippet}

<div class="min-h-screen flex flex-col bg-background text-content transition-colors duration-300">
	{#if !chromeStore.zen}
		<header class="w-full border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
			<div class="max-w-5xl mx-auto px-3 sm:px-6 h-12 flex items-center justify-between gap-3">
				<div class="flex items-center gap-3 sm:gap-5 min-w-0">
					<a
						href={resolve('/')}
						class="flex items-center gap-2 hover:opacity-80 transition-opacity"
					>
						<span
							class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/20"
						>
							<span class="text-sm">🎲</span>
						</span>
						<span
							class="text-xs font-bold tracking-widest text-content uppercase whitespace-nowrap"
						>
							Dice Chess <span class="text-primary">Play</span>
						</span>
					</a>

					<nav class="hidden sm:flex items-center gap-0.5">
						{#each links as l (l.path)}
							<a
								href={resolve(l.path)}
								class="px-2.5 py-1 rounded-lg text-[13px] font-bold transition-colors {isActive(
									l.path,
								)
									? 'bg-surface-hover text-content'
									: 'text-content-muted hover:text-content'}"
							>
								{l.label}
							</a>
						{/each}
					</nav>
				</div>

				<select
					aria-label="Select theme"
					class="bg-surface border border-border text-xs font-bold text-content-muted rounded-md px-2 py-1 outline-none focus:border-primary transition-colors cursor-pointer"
					value={themeStore.theme}
					onchange={(e) => themeStore.setTheme(e.currentTarget.value as Theme)}
				>
					{#each themes as t (t.value)}
						<option value={t.value}>{t.label}</option>
					{/each}
				</select>
			</div>
		</header>
	{/if}

	<main
		class="flex-grow w-full max-w-5xl mx-auto px-3 sm:px-6 {chromeStore.zen
			? 'py-3 sm:py-4'
			: 'py-6 sm:py-8 pb-20 sm:pb-8'}"
	>
		{@render children()}
	</main>

	{#if !chromeStore.zen}
		<footer
			class="hidden sm:block w-full border-t border-border bg-surface/40 py-5 text-center text-xs text-content-muted"
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

		<nav
			class="sm:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur-md"
			aria-label="Primary"
		>
			{#each links as l (l.path)}
				<a
					href={resolve(l.path)}
					class="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-2.5 text-[10px] font-semibold transition-colors {isActive(
						l.path,
					)
						? 'text-primary'
						: 'text-content-muted'}"
					aria-current={isActive(l.path) ? 'page' : undefined}
				>
					{@render navIcon(l.path)}
					{l.label}
				</a>
			{/each}
		</nav>
	{/if}

	<ToastContainer />
</div>
