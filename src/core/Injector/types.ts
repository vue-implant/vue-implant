import type { ObserverHub } from '../hooks/ObserverHub';
import type { LifecycleHookMap } from '../hooks/type';
import type { ILogger } from '../logger/types';
import type { TaskActivitySignal } from '../Task/types';

export enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}

export type ActionEvent = 'OPEN' | 'CLOSE';

export type ArtifactOptions = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	on?: {
		listenAt: string;
		type: string;
		callback: EventListener;
		activitySignal?: TaskActivitySignal;
	};
	hooks?: LifecycleHookMap;
};

export type ComponentOptions = ArtifactOptions;

export type InjectionConfig = {
	alive: boolean;
	scope: 'local' | 'global';
	timeout: number;
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
