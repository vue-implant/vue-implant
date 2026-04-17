import type { ObserveEvent } from '../hooks/type';
import type { TaskKind } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type DomObserveEventName = 'dom:readyFound' | 'dom:readyTimeout' | 'dom:removed' | 'dom:restored';

type DomObserveBase = {
	injectAt: string;
	taskId: string;
	kind: TaskKind;
};

type DomObserveInputByName = {
	'dom:readyFound': DomObserveBase & {
		durationMs: number;
		root: 'document' | 'element';
	};
	'dom:readyTimeout': DomObserveBase & {
		durationMs: number;
		root: 'document' | 'element';
	};
	'dom:removed': DomObserveBase;
	'dom:restored': DomObserveBase & {
		durationMs: number;
	};
};

type DomObservePayloadByName = {
	'dom:readyFound': Omit<ObserveEvent, 'name' | 'ts'> & {
		durationMs: number;
		meta: {
			root: 'document' | 'element';
		};
	};
	'dom:readyTimeout': Omit<ObserveEvent, 'name' | 'ts'> & {
		durationMs: number;
		meta: {
			root: 'document' | 'element';
		};
	};
	'dom:removed': Omit<ObserveEvent, 'name' | 'ts'> & {
		meta: {
			phase: 'removed';
		};
	};
	'dom:restored': Omit<ObserveEvent, 'name' | 'ts'> & {
		durationMs: number;
	};
};

const domObservePayloadBuilders = {
	'dom:readyFound': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		durationMs: input.durationMs,
		meta: {
			root: input.root
		}
	}),
	'dom:readyTimeout': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		durationMs: input.durationMs,
		meta: {
			root: input.root
		}
	}),
	'dom:removed': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		meta: {
			phase: 'removed'
		}
	}),
	'dom:restored': (input) => ({
		injectAt: input.injectAt,
		taskId: input.taskId,
		kind: input.kind,
		durationMs: input.durationMs
	})
} satisfies ObservePayloadBuilderMap<
	DomObserveEventName,
	DomObserveInputByName,
	DomObservePayloadByName
>;

export function buildDomObservePayload<T extends DomObserveEventName>(
	name: T,
	input: DomObserveInputByName[T]
): DomObservePayloadByName[T] {
	return buildObservePayload(name, input, domObservePayloadBuilders);
}
