import type { ObserveEvent } from '../hooks/type';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type ResourceObserveEventName =
	| 'resource:watcherReleased'
	| 'resource:listenerReleased'
	| 'resource:componentUnmounted';

type ResourceObserveBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
};

type ResourceObserveInputByName = {
	'resource:watcherReleased': ResourceObserveBase;
	'resource:listenerReleased': ResourceObserveBase & {
		listenerEvent?: string;
		listenAt?: string;
	};
	'resource:componentUnmounted': Omit<ResourceObserveBase, 'kind'> & {
		kind: 'component';
		artifactName: string;
	};
};

type ResourceObservePayloadByName = {
	'resource:watcherReleased': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		meta: {
			resource: 'watcher';
		};
	};
	'resource:listenerReleased': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		meta: {
			resource: 'listener';
			listenerEvent?: string;
			listenAt?: string;
		};
	};
	'resource:componentUnmounted': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			resource: 'component';
			artifactName: string;
		};
	};
};

const resourceObservePayloadBuilders = {
	'resource:watcherReleased': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			resource: 'watcher'
		}
	}),
	'resource:listenerReleased': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			resource: 'listener',
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt
		}
	}),
	'resource:componentUnmounted': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			resource: 'component',
			artifactName: input.artifactName
		}
	})
} satisfies ObservePayloadBuilderMap<
	ResourceObserveEventName,
	ResourceObserveInputByName,
	ResourceObservePayloadByName
>;

export function buildResourceObservePayload<T extends ResourceObserveEventName>(
	name: T,
	input: ResourceObserveInputByName[T]
): ResourceObservePayloadByName[T] {
	return buildObservePayload(name, input, resourceObservePayloadBuilders);
}
