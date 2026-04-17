import type { ObserveEvent } from '../hooks/type';
import type { TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type AliveObserveEventName =
	| 'alive:enable'
	| 'alive:disable'
	| 'alive:observeStart'
	| 'alive:observeStop';

type AliveObserverMode = 'mounted' | 'await-target';

type AliveObserveBase = {
	taskId: string;
	kind: 'component';
	injectAt: string;
	status: TaskStatus;
	scope: 'local' | 'global';
	aliveEpoch: number;
};

type AliveObserveInputByName = {
	'alive:enable': AliveObserveBase;
	'alive:disable': AliveObserveBase;
	'alive:observeStart': AliveObserveBase & { observerMode: AliveObserverMode };
	'alive:observeStop': AliveObserveBase & { observerMode: AliveObserverMode };
};

type AliveObservePayloadByName = {
	'alive:enable': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
			aliveEpoch: number;
		};
	};
	'alive:disable': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
			aliveEpoch: number;
		};
	};
	'alive:observeStart': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
			aliveEpoch: number;
			observerMode: AliveObserverMode;
		};
	};
	'alive:observeStop': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			scope: 'local' | 'global';
			aliveEpoch: number;
			observerMode: AliveObserverMode;
		};
	};
};

const aliveObservePayloadBuilders = {
	'alive:enable': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope,
			aliveEpoch: input.aliveEpoch
		}
	}),
	'alive:disable': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope,
			aliveEpoch: input.aliveEpoch
		}
	}),
	'alive:observeStart': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope,
			aliveEpoch: input.aliveEpoch,
			observerMode: input.observerMode
		}
	}),
	'alive:observeStop': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			scope: input.scope,
			aliveEpoch: input.aliveEpoch,
			observerMode: input.observerMode
		}
	})
} satisfies ObservePayloadBuilderMap<
	AliveObserveEventName,
	AliveObserveInputByName,
	AliveObservePayloadByName
>;

export function buildAliveObservePayload<T extends AliveObserveEventName>(
	name: T,
	input: AliveObserveInputByName[T]
): AliveObservePayloadByName[T] {
	return buildObservePayload(name, input, aliveObservePayloadBuilders);
}
