import type { TaskKind, TaskStatus } from '../Task/types';
export type ObserveEventName =
	| 'register:start'
	| 'register:success'
	| 'register:duplicate'
	| 'register:error'
	| 'run:start'
	| 'run:taskScheduled'
	| 'run:taskSkipped'
	| 'target:ready'
	| 'inject:start'
	| 'inject:success'
	| 'inject:fail'
	| 'listener:open'
	| 'listener:close'
	| 'listener:attachFail'
	| 'alive:enable'
	| 'alive:disable'
	| 'alive:observeStart'
	| 'alive:observeStop'
	| 'task:statusChange'
	| 'task:active'
	| 'task:beforeReset'
	| 'task:afterReset'
	| 'task:beforeDestroy'
	| 'task:afterDestroy'
	| 'task:reset'
	| 'task:destroy'
	| 'resource:watcherReleased'
	| 'resource:listenerReleased'
	| 'resource:componentUnmounted'
	| 'dom:readyFound'
	| 'dom:readyTimeout'
	| 'dom:removed'
	| 'dom:restored';

export type ObserveEvent = {
	name: ObserveEventName;
	ts: number;
	taskId?: string;
	kind?: TaskKind;
	injectAt?: string;
	status?: TaskStatus;
	durationMs?: number;
	error?: unknown;
	preStatus?: TaskStatus;
	nextStatus?: TaskStatus;
	meta?: Record<string, unknown>;
};

export type ObserveHook = (event: ObserveEvent) => void;

export type LifecycleHookMap = Partial<Record<ObserveEventName, ObserveHook | ObserveHook[]>>;

export type ObserveEmitter = (
	name: ObserveEventName,
	payload?: Omit<ObserveEvent, 'name' | 'ts'>
) => void;
