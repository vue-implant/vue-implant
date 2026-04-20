import type { Component } from 'vue';
import { createVueAdapter } from '../../src/core/adapter/vue/VueAdapter';
import { Logger } from '../../src/core/logger/Logger';
import type { ActivitySignalSource } from '../../src/core/signal/types';
import type {
	ArtifactTask,
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
	hooks?: ArtifactTask['hooks'];
	watcher?: TaskWatcherFeature;
};

export type CreateArtifactTaskInput = TaskBaseInput & {
	kind: 'component';
	artifactName?: string;
	injectAt?: string;
	artifact?: Component;
	adapter?: ArtifactTask['adapter'];
	alive?: boolean;
	scope?: 'local' | 'global';
	listener?: TaskListenerFeature;
	mountHandle?: unknown;
	hostElement?: HTMLElement;
	appRoot?: HTMLElement;
	instance?: unknown;
	isObserver?: boolean;
	disableAlive?: () => void;
};

export type CreateListenerTaskInput = TaskBaseInput & {
	kind: 'listener';
	listenAt?: string;
	event?: string;
	callback?: EventListener;
	controller?: AbortController;
	activitySignal?: () => ActivitySignalSource<boolean>;
};

export function createTask(input: CreateArtifactTaskInput): ArtifactTask;
export function createTask(input: CreateListenerTaskInput): ListenerTask;
export function createTask(input: CreateArtifactTaskInput | CreateListenerTaskInput): Task {
	if (input.kind === 'component') {
		const artifactName = input.artifactName ?? 'TestComponent';
		const injectAt = input.injectAt ?? '#app';
		const artifact = input.artifact ?? createVueComponent(artifactName);
		const logger = new Logger();
		return {
			taskId: input.taskId,
			kind: 'component',
			taskStatus: input.taskStatus ?? 'idle',
			timeout: input.timeout ?? 5000,
			withEvent: input.withEvent ?? false,
			...(input.hooks ? { hooks: input.hooks } : {}),
			...(input.watcher ? { watcher: input.watcher } : {}),
			artifactName,
			injectAt,
			artifact,
			adapter: input.adapter ?? createVueAdapter(logger),
			alive: input.alive ?? false,
			scope: input.scope ?? 'local',
			...(input.listener ? { listener: input.listener } : {}),
			...(input.mountHandle !== undefined ? { mountHandle: input.mountHandle } : {}),
			...(input.hostElement !== undefined ? { hostElement: input.hostElement } : {}),
			...(input.appRoot ? { appRoot: input.appRoot } : {}),
			...(input.instance !== undefined ? { instance: input.instance } : {}),
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

export function createArtifactTask(input: Omit<CreateArtifactTaskInput, 'kind'>): ArtifactTask {
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

export function createVueComponent(name: string): Component {
	return {
		name,
		render() {
			return null;
		},
		__vccOpts: {
			name
		}
	};
}
