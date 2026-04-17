import type { App, Component, ComponentPublicInstance, Ref } from 'vue';
import type {
	ComponentTask,
	ListenerTask,
	Task,
	TaskListenerFeature,
	TaskStatus,
	TaskWatcherFeature
} from '../../src/core/Task/types';

type TaskBaseInput = {
	taskId: string;
	taskStatus?: TaskStatus;
	timeout?: number;
	withEvent?: boolean;
	hooks?: ComponentTask['hooks'];
	watcher?: TaskWatcherFeature;
};

export type CreateComponentTaskInput = TaskBaseInput & {
	kind: 'component';
	componentName?: string;
	componentInjectAt?: string;
	component?: Component;
	alive?: boolean;
	scope?: 'local' | 'global';
	listener?: TaskListenerFeature;
	app?: App<Element>;
	appRoot?: HTMLElement;
	instance?: ComponentPublicInstance;
	aliveEpoch?: number;
	isObserver?: boolean;
	disableAlive?: () => void;
};

export type CreateListenerTaskInput = TaskBaseInput & {
	kind: 'listener';
	listenAt?: string;
	event?: string;
	callback?: EventListener;
	controller?: AbortController;
	activitySignal?: () => Ref<boolean>;
};

export function createTask(input: CreateComponentTaskInput): ComponentTask;
export function createTask(input: CreateListenerTaskInput): ListenerTask;
export function createTask(input: CreateComponentTaskInput | CreateListenerTaskInput): Task {
	if (input.kind === 'component') {
		return {
			taskId: input.taskId,
			kind: 'component',
			taskStatus: input.taskStatus ?? 'idle',
			timeout: input.timeout ?? 5000,
			withEvent: input.withEvent ?? false,
			...(input.hooks ? { hooks: input.hooks } : {}),
			...(input.watcher ? { watcher: input.watcher } : {}),
			componentName: input.componentName ?? 'TestComponent',
			componentInjectAt: input.componentInjectAt ?? '#app',
			component: input.component ?? { name: 'TestComponent', render: () => null },
			alive: input.alive ?? false,
			scope: input.scope ?? 'local',
			...(input.listener ? { listener: input.listener } : {}),
			...(input.app ? { app: input.app } : {}),
			...(input.appRoot ? { appRoot: input.appRoot } : {}),
			...(input.instance ? { instance: input.instance } : {}),
			...(input.aliveEpoch !== undefined ? { aliveEpoch: input.aliveEpoch } : {}),
			...(input.isObserver !== undefined ? { isObserver: input.isObserver } : {}),
			...(input.disableAlive ? { disableAlive: input.disableAlive } : {})
		};
	}

	return {
		taskId: input.taskId,
		kind: 'listener',
		taskStatus: input.taskStatus ?? 'idle',
		timeout: input.timeout ?? 5000,
		withEvent: input.withEvent ?? false,
		...(input.hooks ? { hooks: input.hooks } : {}),
		...(input.watcher ? { watcher: input.watcher } : {}),
		listenAt: input.listenAt ?? '#app',
		event: input.event ?? 'click',
		callback: input.callback ?? (() => undefined),
		...(input.controller ? { controller: input.controller } : {}),
		...(input.activitySignal ? { activitySignal: input.activitySignal } : {})
	};
}

export function createComponentTask(input: Omit<CreateComponentTaskInput, 'kind'>): ComponentTask {
	return createTask({
		...input,
		kind: 'component'
	});
}

export function createListenerTask(input: Omit<CreateListenerTaskInput, 'kind'>): ListenerTask {
	return createTask({
		...input,
		kind: 'listener'
	});
}
