export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
	id: string;
	text: string;
	type: ToastType;
}

class ToastStore {
	toasts: ToastMessage[] = $state([]);

	private add(text: string, type: ToastType, duration: number = 3000) {
		const id = crypto.randomUUID();
		this.toasts.push({ id, text, type });

		setTimeout(() => {
			this.remove(id);
		}, duration);
	}

	remove(id: string) {
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	success(text: string, duration?: number) {
		this.add(text, 'success', duration);
	}

	error(text: string, duration?: number) {
		this.add(text, 'error', duration);
	}

	info(text: string, duration?: number) {
		this.add(text, 'info', duration);
	}
}

export const toastStore = new ToastStore();
