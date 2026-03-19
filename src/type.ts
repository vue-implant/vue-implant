import type { App, Component, ComponentPublicInstance, Ref, WatchHandle, WatchSource } from 'vue';

export enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}
export type ActionEvent = 'OPEN' | 'CLOSE';

export type ComponentOptions = {
	alive?: boolean;
	scope?: 'local' | 'global';
	on?: {
		listenAt: string;
		type: string;
		callback: EventListener;
		activitySignal?: () => Ref<boolean>;
	};
};

export type ObserverOptions =
	| { once: boolean; timeout?: number }
	| { once?: boolean; timeout: number };

export type TaskRecord = {
	taskId: string;
	injectAt: string;
};

export type TaskErrorMessage = {
	taskId: string;
	injectAt: string;
};
export type InjectionConfig = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
};
export type InjectCallback = (el: HTMLElement, observer?: MutationObserver) => void;
export type Task = {
	// Unique task identifier
	taskId: string;
	taskStatus?: 'idle' | 'pending' | 'active';

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

	isObserver?: boolean;
	alive?: boolean;
	aliveEpoch?: number;
	scope?: 'local' | 'global';
	stopAlive?: () => void;
};
export type RegisterResult = {
	taskId: string;
	isSuccess: boolean;
	keepAlive: () => void;
	stopAlive: () => void;
};

export type ListenerRegisterResult = {
	taskId: string;
	isSuccess: boolean;
};
