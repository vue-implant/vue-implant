import { ObserverHub } from './core/hooks/ObserverHub';
import { Injector } from './core/Injector/Injector';
import { Action } from './core/Injector/types';
import { DOMWatcher } from './core/watcher/DomWatcher';

export { Injector, DOMWatcher, Action, ObserverHub };
export type {
	LifecycleHookMap,
	ObserveEvent,
	ObserveEventName,
	ObserveHook
} from './core/hooks/type';
export type {
	ActionEvent,
	ComponentOptions,
	InjectionConfig
} from './core/Injector/types';
export type { ILogger, LoggerLevel } from './core/logger/types';
export type { ListenerRegisterResult, RegisterResult } from './core/Task/types';
