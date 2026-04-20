export type SignalUnsubscribe = (() => void) | { unsubscribe(): void };

export type ActivitySignalListener<T = boolean> = (value: T) => void;

export type ActivitySignalStore<T = boolean> = {
	get(): T;
	subscribe(listener: ActivitySignalListener<T>): SignalUnsubscribe;
};

export type ActivitySignalSource<T = boolean> = ActivitySignalStore<T>;

export type ActivitySignalSubscribable<T = boolean> = ActivitySignalStore<T>;

export type ActivitySignalReadable<T = boolean> = ActivitySignalStore<T>;

export type WritableActivitySignalStore<T = boolean> = ActivitySignalStore<T> & {
	set(value: T): void;
	update(updater: (value: T) => T): void;
};
