import type {
	ActivitySignalListener,
	ActivitySignalSource,
	SignalUnsubscribe,
	WritableActivitySignalStore
} from './types';

export function createActivityStore<T>(initialValue: T): WritableActivitySignalStore<T> {
	let currentValue = initialValue;
	const listeners = new Set<ActivitySignalListener<T>>();

	const setValue = (value: T): void => {
		if (Object.is(currentValue, value)) {
			return;
		}

		currentValue = value;
		for (const listener of listeners) {
			listener(currentValue);
		}
	};

	return {
		get() {
			return currentValue;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		set(value) {
			setValue(value);
		},
		update(updater) {
			setValue(updater(currentValue));
		}
	};
}

export function observeActivitySignal<T>(
	source: ActivitySignalSource<T>,
	listener: (value: T) => void
): SignalUnsubscribe {
	listener(source.get());
	return source.subscribe(listener);
}

export function stopActivitySignal(signal: SignalUnsubscribe): void {
	if (typeof signal === 'function') {
		signal();
		return;
	}
	signal.unsubscribe();
}
