import type { ObserveEvent } from '../hooks/type';
import type { TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type InjectObserveEventName = 'inject:start' | 'inject:success' | 'inject:fail';

type InjectObserveBase = {
	taskId: string;
	kind: 'component';
	injectAt: string;
	status: TaskStatus;
	artifactName: string;
};

type InjectObserveInputByName = {
	'inject:start': InjectObserveBase & {
		alive: boolean;
		scope: 'local' | 'global';
		withEvent: boolean;
	};
	'inject:success': InjectObserveBase & {
		alive: boolean;
		scope: 'local' | 'global';
	};
	'inject:fail': Omit<InjectObserveBase, 'status'> & {
		status: 'idle';
		error: unknown;
	};
};

type InjectObservePayloadByName = {
	'inject:start': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			artifactName: string;
			alive: boolean;
			scope: 'local' | 'global';
			withEvent: boolean;
		};
	};
	'inject:success': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		meta: {
			artifactName: string;
			alive: boolean;
			scope: 'local' | 'global';
		};
	};
	'inject:fail': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: 'component';
		status: 'idle';
		error: unknown;
		meta: {
			artifactName: string;
		};
	};
};

const injectObservePayloadBuilders = {
	'inject:start': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			artifactName: input.artifactName,
			alive: input.alive,
			scope: input.scope,
			withEvent: input.withEvent
		}
	}),
	'inject:success': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			artifactName: input.artifactName,
			alive: input.alive,
			scope: input.scope
		}
	}),
	'inject:fail': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: 'idle',
		error: input.error,
		meta: {
			artifactName: input.artifactName
		}
	})
} satisfies ObservePayloadBuilderMap<
	InjectObserveEventName,
	InjectObserveInputByName,
	InjectObservePayloadByName
>;

export function buildInjectObservePayload<T extends InjectObserveEventName>(
	name: T,
	input: InjectObserveInputByName[T]
): InjectObservePayloadByName[T] {
	return buildObservePayload(name, input, injectObservePayloadBuilders);
}
