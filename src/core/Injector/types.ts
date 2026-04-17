import type { Ref } from 'vue';
import type { ObserverHub } from '../hooks/ObserverHub';
import type { LifecycleHookMap } from '../hooks/type';
import type { ILogger } from '../logger/types';

export enum Action {
	OPEN = 'OPEN',
	CLOSE = 'CLOSE'
}

export type ActionEvent = 'OPEN' | 'CLOSE';

export type ComponentOptions = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	on?: {
		listenAt: string;
		type: string;
		callback: EventListener;
		activitySignal?: () => Ref<boolean>;
	};
	hooks?: LifecycleHookMap;
};

export type InjectionConfig = {
	alive: boolean;
	scope: 'local' | 'global';
	timeout: number;
	logger: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
