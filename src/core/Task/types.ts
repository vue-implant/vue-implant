import type { App, Component, ComponentPublicInstance, Ref, WatchHandle, WatchSource } from 'vue';
import type { LifecycleHookMap } from '../hooks/type';

export type TaskRecord = {
	taskId: string;
	injectAt: string;
};

export type TaskErrorMessage = {
	taskId: string;
	injectAt: string;
};

export type Task = {
	taskId: string;
	taskStatus?: 'idle' | 'pending' | 'active';
	kind: 'component' | 'listener';

	app?: App<Element>;
	appRoot?: HTMLElement;
	componentName?: string;
	componentInjectAt?: string;
	component?: Component;
	instance?: ComponentPublicInstance;

	listenerName?: string;
	withEvent?: boolean;
	listenAt?: string;
	event?: string;
	callback?: EventListener;
	controller?: AbortController;
	activitySignal?: () => Ref<boolean>;

	watcher?: WatchHandle;
	watchSource?: WatchSource<boolean>;

	isObserver?: boolean;
	alive?: boolean;
	aliveEpoch?: number;
	scope?: 'local' | 'global';
	timeout?: number;

	disableAlive?: () => void;

	hooks?: LifecycleHookMap;
};

export type ListenerRegisterResult = {
	taskId: string;
	isSuccess: boolean;
};

export type RegisterResult = {
	taskId: string;
	isSuccess: boolean;
	enableAlive: () => void;
	disableAlive: () => void;
};

export type _RegisterResult = {
	taskId: string;
	isSuccess: boolean;
};
