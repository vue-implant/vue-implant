import type { ObserveEmitter } from '../hooks/type';
import type { TaskKind } from '../Task/types';
import type { DomWatcherEmit } from '../watcher/types';
import { buildDomObservePayload } from './buildDomObservePayload';

type CreateDomObserveEmitFactoryInput = {
	emit: ObserveEmitter;
	taskId: string;
	kind: TaskKind;
	injectAt: string;
	root: Document | HTMLElement;
};

export function createDomObserveEmitFactory(
	input: CreateDomObserveEmitFactoryInput
): DomWatcherEmit {
	const startedAt = Date.now();
	let removedAt: number | undefined;
	const root = input.root instanceof Document ? 'document' : 'element';

	return (name) => {
		if (name === 'dom:readyFound') {
			input.emit(
				'dom:readyFound',
				buildDomObservePayload('dom:readyFound', {
					injectAt: input.injectAt,
					taskId: input.taskId,
					kind: input.kind,
					durationMs: Date.now() - startedAt,
					root
				})
			);
			return;
		}

		if (name === 'dom:readyTimeout') {
			input.emit(
				'dom:readyTimeout',
				buildDomObservePayload('dom:readyTimeout', {
					injectAt: input.injectAt,
					taskId: input.taskId,
					kind: input.kind,
					durationMs: Date.now() - startedAt,
					root
				})
			);
			return;
		}

		if (name === 'dom:removed') {
			removedAt = Date.now();
			input.emit(
				'dom:removed',
				buildDomObservePayload('dom:removed', {
					injectAt: input.injectAt,
					taskId: input.taskId,
					kind: input.kind
				})
			);
			return;
		}

		input.emit(
			'dom:restored',
			buildDomObservePayload('dom:restored', {
				injectAt: input.injectAt,
				taskId: input.taskId,
				kind: input.kind,
				durationMs: Date.now() - (removedAt ?? startedAt)
			})
		);
	};
}
