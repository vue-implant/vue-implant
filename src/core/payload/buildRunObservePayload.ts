import type { ObserveEvent } from '../hooks/type';
import type { TaskKind, TaskStatus } from '../Task/types';
import { buildObservePayload, type ObservePayloadBuilderMap } from './buildObservePayload';

type RunObserveEventName = 'run:start' | 'run:taskScheduled' | 'run:taskSkipped' | 'target:ready';

type RunObserveTaskBase = {
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	status: TaskStatus;
};

type RunObserveInputByName = {
	'run:start': {
		totalTasks: number;
		idleTasks: number;
		pendingTasks: number;
		activeTasks: number;
	};
	'run:taskScheduled': Omit<RunObserveTaskBase, 'status'> & {
		status: 'pending';
		preStatus: 'idle';
		timeout: number;
	};
	'run:taskSkipped': RunObserveTaskBase & {
		status: 'active' | 'pending';
		skipReason: 'already-active' | 'already-pending';
	};
	'target:ready': RunObserveTaskBase;
};

type RunObservePayloadByName = {
	'run:start': Omit<ObserveEvent, 'name' | 'ts'> & {
		meta: {
			totalTasks: number;
			idleTasks: number;
			pendingTasks: number;
			activeTasks: number;
		};
	};
	'run:taskScheduled': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		status: 'pending';
		preStatus: 'idle';
		meta: {
			timeout: number;
		};
	};
	'run:taskSkipped': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
		status: 'active' | 'pending';
		meta: {
			skipReason: 'already-active' | 'already-pending';
		};
	};
	'target:ready': Omit<ObserveEvent, 'name' | 'ts'> & {
		kind: TaskKind;
	};
};

const runObservePayloadBuilders = {
	'run:start': (input) => ({
		meta: {
			totalTasks: input.totalTasks,
			idleTasks: input.idleTasks,
			pendingTasks: input.pendingTasks,
			activeTasks: input.activeTasks
		}
	}),
	'run:taskScheduled': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		preStatus: input.preStatus,
		meta: {
			timeout: input.timeout
		}
	}),
	'run:taskSkipped': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status,
		meta: {
			skipReason: input.skipReason
		}
	}),
	'target:ready': (input) => ({
		taskId: input.taskId,
		kind: input.kind,
		injectAt: input.injectAt,
		status: input.status
	})
} satisfies ObservePayloadBuilderMap<
	RunObserveEventName,
	RunObserveInputByName,
	RunObservePayloadByName
>;

export function buildRunObservePayload<T extends RunObserveEventName>(
	name: T,
	input: RunObserveInputByName[T]
): RunObservePayloadByName[T] {
	return buildObservePayload(name, input, runObservePayloadBuilders);
}
