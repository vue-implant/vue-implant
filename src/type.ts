import type { App, Component, ComponentPublicInstance, Ref, WatchHandle, WatchSource } from 'vue';

export enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}
export type ActionEvent = {
	type: Action;
};

export type eventOptions = {
	listenAt: string;
	event: string;
	callback: EventListener;
	activitySignal?: () => Ref<boolean>;
};

export type ObserverOptions =
	| { once: boolean; timeout?: number }
	| { once?: boolean; timeout: number };

export type InjectionRecord = {
	id: string;
	injectAt: string;
};

export type InjectionErrorMessage = {
	injectAt: string;
	id: string;
};
export type InjectionConfig = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number
};
export type InjectCallback = (el: HTMLElement, observer?: MutationObserver) => void;
export type InjectionContext = {
	// Unique task identifier
	taskId: string;

	// Component injection info
	app?: App<Element>;
	appRoot?: HTMLElement;
	componentName?: string;
	componentInjectAt?: string;
	component?: Component;
	instance?: ComponentPublicInstance;

	// Event bindnig info
	listenerName?: string;
	withEvent?: boolean;
	listenAt?: string;
	event?: string;
	callback?: EventListener;
	controller?: AbortController;
	activitySignal?: () => Ref<boolean>;

	// Watch info
	watcher?: WatchHandle;
	watchSource?: WatchSource<boolean>;
};
