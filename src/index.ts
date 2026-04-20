import { VuePlugin } from './core/adapter/vue/VuePlugin';
import { ObserverHub } from './core/hooks/ObserverHub';
import { Injector } from './core/Injector/Injector';
import { Action } from './core/Injector/types';
import { createActivityStore } from './core/signal/observeActivitySignal';
import { DOMWatcher } from './core/watcher/DomWatcher';

export type {
	AdapterMountInput,
	AdapterMountResult,
	AdapterResolver,
	AdapterUnmountInput,
	AdapterUnmountReason,
	MountAdapter,
	ResolvableMountAdapter
} from './core/adapter/types';
export type {
	VueMountArtifact,
	VueMountHandle,
	VueMountInstance
} from './core/adapter/vue/type';

export type {
	LifecycleHookMap,
	ObserveEvent,
	ObserveEventName,
	ObserveHook
} from './core/hooks/type';
export type {
	ActionEvent,
	ArtifactOptions,
	ComponentOptions,
	InjectionConfig
} from './core/Injector/types';
export type { ILogger, LoggerLevel } from './core/logger/types';
export type {
	ActivitySignalSource,
	ActivitySignalSubscribable,
	SignalUnsubscribe
} from './core/signal/types';
export type { ListenerRegisterResult, RegisterResult } from './core/Task/types';
export { Action, VuePlugin, DOMWatcher, Injector, ObserverHub, createActivityStore };
