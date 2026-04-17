import type { ILogger } from '../logger/types';

export type InjectCallback = (el: HTMLElement, observer?: MutationObserver) => void;

export type DomWatcherEventName =
	| 'dom:readyFound'
	| 'dom:readyTimeout'
	| 'dom:removed'
	| 'dom:restored';

export type DomWatcherEmit = (name: DomWatcherEventName) => void;

export type ObserverOptions =
	| { once: boolean; timeout?: number }
	| { once?: boolean; timeout: number };

export type DomWatcherRuntime = {
	logger: ILogger;
	emit: DomWatcherEmit;
};
