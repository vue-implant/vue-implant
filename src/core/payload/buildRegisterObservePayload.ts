import type { ObserveEvent } from '../hooks/type';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type RegisterObserveEventName =
	| 'register:start'
	| 'register:success'
	| 'register:duplicate'
	| 'register:error';

type RegisterObserveMeta = {
	artifactName?: string;
	listenerEvent?: string;
	listenAt?: string;
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
	withEvent?: boolean;
};

type RegisterObserveIdentityMeta = Pick<RegisterObserveMeta, 'artifactName' | 'listenerEvent'>;

type RegisterObserveBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
};

type RegisterObserveInputByName = {
	'register:start': RegisterObserveBase & RegisterObserveMeta;
	'register:success': RegisterObserveBase & RegisterObserveMeta;
	'register:duplicate': RegisterObserveBase & RegisterObserveIdentityMeta;
	'register:error': RegisterObserveBase & RegisterObserveIdentityMeta & { error: unknown };
};

type RegisterObservePayloadByName = {
	'register:start': Omit<ObserveEvent, 'name' | 'ts'> & { meta: RegisterObserveMeta };
	'register:success': Omit<ObserveEvent, 'name' | 'ts'> & { meta: RegisterObserveMeta };
	'register:duplicate': Omit<ObserveEvent, 'name' | 'ts'> & { meta: RegisterObserveIdentityMeta };
	'register:error': Omit<ObserveEvent, 'name' | 'ts'> & {
		error: unknown;
		meta: RegisterObserveIdentityMeta;
	};
};

const registerObservePayloadBuilders = {
	'register:start': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			artifactName: input.artifactName,
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt,
			alive: input.alive,
			scope: input.scope,
			timeout: input.timeout,
			withEvent: input.withEvent
		}
	}),
	'register:success': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			artifactName: input.artifactName,
			listenerEvent: input.listenerEvent,
			listenAt: input.listenAt,
			alive: input.alive,
			scope: input.scope,
			timeout: input.timeout,
			withEvent: input.withEvent
		}
	}),
	'register:duplicate': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: buildIdentityMeta(input)
	}),
	'register:error': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		error: input.error,
		meta: buildIdentityMeta(input)
	})
} satisfies ObservePayloadBuilderMap<
	RegisterObserveEventName,
	RegisterObserveInputByName,
	RegisterObservePayloadByName
>;

function buildIdentityMeta(input: RegisterObserveIdentityMeta): RegisterObserveIdentityMeta {
	if (input.artifactName !== undefined) {
		return { artifactName: input.artifactName };
	}

	if (input.listenerEvent !== undefined) {
		return { listenerEvent: input.listenerEvent };
	}

	return {};
}

export function buildRegisterObservePayload<T extends RegisterObserveEventName>(
	name: T,
	input: RegisterObserveInputByName[T]
): RegisterObservePayloadByName[T] {
	return buildObservePayload(name, input, registerObservePayloadBuilders);
}
