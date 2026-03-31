import type { App, Component, ComponentPublicInstance, Ref, WatchHandle, WatchSource } from 'vue';

export enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}
export type ActionEvent = 'OPEN' | 'CLOSE';

export type ComponentOptions = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
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
	logger?: ILogger;
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

	//config info
	isObserver?: boolean;
	alive?: boolean;
	aliveEpoch?: number;
	scope?: 'local' | 'global';
	timeout?: number;

	//placeholder
	disableAlive?: () => void;
};
export type RegisterResult = {
	taskId: string;
	isSuccess: boolean;
	enableAlive: () => void;
	disableAlive: () => void;
};

export type ListenerRegisterResult = {
	taskId: string;
	isSuccess: boolean;
};

export type _RegisterResult = {
	taskId: string;
	isSuccess: boolean;
};

export interface ILogger {
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
	debug(message: string, ...args: unknown[]): void;
}
export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';
