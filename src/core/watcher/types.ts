import type { ObserveEmitter } from '../hooks/ObservabilityHook/type';
import type { ILogger } from '../logger/types';

export type InjectCallback = (el: HTMLElement, observer?: MutationObserver) => void;

export type ObserverOptions =
	| { once: boolean; timeout?: number }
	| { once?: boolean; timeout: number };

export type DomWatcherRuntime = {
	logger: ILogger;
	emit: ObserveEmitter;
};
