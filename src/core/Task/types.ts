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

export type TaskStatus = 'idle' | 'pending' | 'active';
export type TaskKind = 'component' | 'listener';

export interface BaseTask {
	taskId: string;
	kind: TaskKind;
	taskStatus: TaskStatus;
	timeout: number;
	withEvent: boolean;
	hooks?: LifecycleHookMap;
}

export interface ComponentTask extends BaseTask {
	kind: 'component';
	componentName: string;
	componentInjectAt: string;
	component: Component;
	alive: boolean;
	scope: 'local' | 'global';

	app?: App<Element>;
	appRoot?: HTMLElement;
	instance?: ComponentPublicInstance;

	isObserver?: boolean;
	disableAlive?: () => void;

	listener?: TaskListenerFeature;
	watcher?: TaskWatcherFeature;
}

export interface ListenerTask extends BaseTask {
	kind: 'listener';
	listenAt: string;
	event: string;
	callback: EventListener;
	controller?: AbortController;
	activitySignal?: () => Ref<boolean>;

	watcher?: TaskWatcherFeature;
}

export type TaskListenerFeature = {
	listenAt: string;
	event: string;
	callback: EventListener;
	controller?: AbortController;
	activitySignal?: () => Ref<boolean>;
};
export type TaskWatcherFeature = {
	watcher: WatchHandle;
	watchSource: WatchSource<boolean>;
};

export type Task = ComponentTask | ListenerTask;

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

export type _InjectResult = {
	isSuccess: boolean;
	error?: unknown;
};
