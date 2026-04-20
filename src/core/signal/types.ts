export type SignalUnsubscribe = (() => void) | { unsubscribe(): void };

export type ActivitySignalListener<T = boolean> = (value: T) => void;

export type ActivitySignalStore<T = boolean> = {
	get(): T;
	subscribe(listener: ActivitySignalListener<T>): SignalUnsubscribe;
};

/**
 * @deprecated Will be removed in 2.0. Use `ActivitySignalStore` instead.
 *
 * @example
 * ```ts
 * // 1.x (deprecated)
 * const signal = ref(true)
 * activitySignal: () => signal
 *
 * // 2.0
 * const signal = createActivityStore(true)
 * activitySignal: () => signal
 * ```
 */
export type ActivitySignalRefLike<T = boolean> = {
	value: T;
};

/**
 * @deprecated Accepting `ActivitySignalRefLike` (e.g. Vue `ref`) will be removed in 2.0.
 * Use `ActivitySignalStore` instead.
 */
export type ActivitySignalSource<T = boolean> = ActivitySignalStore<T> | ActivitySignalRefLike<T>;

export type ActivitySignalSubscribable<T = boolean> = ActivitySignalStore<T>;

export type ActivitySignalReadable<T = boolean> = ActivitySignalStore<T>;

export type WritableActivitySignalStore<T = boolean> = ActivitySignalStore<T> & {
	set(value: T): void;
	update(updater: (value: T) => T): void;
};
