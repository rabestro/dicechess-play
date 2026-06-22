<script lang="ts">
	import { toastStore } from '../lib/toastStore.svelte';
	import { fly, fade } from 'svelte/transition';
</script>

<div
	class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4 md:px-0"
>
	{#each toastStore.toasts as toast (toast.id)}
		<div
			in:fly={{ y: 20, duration: 300 }}
			out:fade={{ duration: 200 }}
			class="pointer-events-auto flex items-center justify-between p-4 rounded-lg shadow-xl border backdrop-blur-md text-white font-medium
                {toast.type === 'success'
				? 'bg-green-900/90 border-green-700/50'
				: toast.type === 'error'
					? 'bg-red-900/90 border-red-700/50'
					: 'bg-blue-900/90 border-blue-700/50'}"
		>
			<div class="flex items-center gap-3">
				{#if toast.type === 'success'}
					<span class="text-xl">✅</span>
				{:else if toast.type === 'error'}
					<span class="text-xl">❌</span>
				{:else}
					<span class="text-xl">ℹ️</span>
				{/if}
				<span>{toast.text}</span>
			</div>
			<button
				type="button"
				class="opacity-60 hover:opacity-100 transition-opacity ml-4"
				onclick={() => toastStore.remove(toast.id)}
				aria-label="Close"
			>
				✕
			</button>
		</div>
	{/each}
</div>
