import type { ObserverHub } from './ObserverHub';
import type { ObserveEmitter } from './type';

export const noopObserveEmitter: ObserveEmitter = () => {};

export function createObserveEmitter(observer?: ObserverHub): ObserveEmitter {
	if (!observer) {
		return noopObserveEmitter;
	}

	return (name, payload = {}) => {
		observer.emit({
			name,
			ts: Date.now(),
			...payload
		});
	};
}
