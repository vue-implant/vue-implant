import type { Ref, WatchHandle, WatchSource } from 'vue';
import type { MountAdapter } from '../adapter/types';
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
export type TaskActivitySignal = () => Ref<boolean>;

export interface BaseTask {
	taskId: string;
	kind: TaskKind;
	taskStatus: TaskStatus;
	timeout: number;
	withEvent: boolean;
	hooks?: LifecycleHookMap;
}

export interface ArtifactTask<TArtifact = unknown> extends BaseTask {
	kind: 'component';
	artifactName: string;
	injectAt: string;
	artifact: TArtifact;
	adapter: MountAdapter;
	alive: boolean;
	scope: 'local' | 'global';

	mountHandle?: unknown;
	hostElement?: HTMLElement;
	appRoot?: HTMLElement;
	instance?: unknown;

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
	activitySignal?: TaskActivitySignal;

	watcher?: TaskWatcherFeature;
}

export type TaskListenerFeature = {
	listenAt: string;
	event: string;
	callback: EventListener;
	controller?: AbortController;
	activitySignal?: TaskActivitySignal;
};
export type TaskWatcherFeature = {
	watcher: WatchHandle;
	watchSource: WatchSource<boolean>;
};

export type Task = ArtifactTask | ListenerTask;

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
