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
	injectAt?: string;
	status?: 'idle' | 'pending' | 'active';
	durationMs?: number;
	error?: unknown;
	meta?: Record<string, unknown>;
};

export type ObserveHook = (event: ObserveEvent) => void;

export type ObserveEmitter = (
	name: ObserveEventName,
	payload?: Omit<ObserveEvent, 'name' | 'ts'>
) => void;
