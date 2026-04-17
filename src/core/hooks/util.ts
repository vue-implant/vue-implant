import type { ObserverHub } from './ObserverHub';
import type { LifecycleHookMap, ObserveEmitter, ObserveEventName, ObserveHook } from './type';

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
export function registerHooks(
	observer: ObserverHub,
	hooks?: LifecycleHookMap,
	taskId?: string
): void {
	if (!hooks) return;

	for (const [eventName, hookOrHooks] of Object.entries(hooks) as Array<
		[ObserveEventName, ObserveHook | ObserveHook[] | undefined]
	>) {
		if (!hookOrHooks) continue;

		const hooksToRegister = Array.isArray(hookOrHooks) ? hookOrHooks : [hookOrHooks];
		for (const hook of hooksToRegister) {
			if (taskId) {
				observer.onTask(taskId, eventName, hook);
			} else {
				observer.on(eventName, hook);
			}
		}
	}
}
