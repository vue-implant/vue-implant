import type { ObserveEmitter } from '../hooks/type';
import type { InjectionConfig } from '../Injector/types';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { buildAliveObservePayload } from '../payload/buildAliveObservePayload';
import { buildTaskObservePayload } from '../payload/buildTaskObservePayload';
import { createDomObserveEmitFactory } from '../payload/createDomObserveEmitFactory';
import { DOMWatcher } from '../watcher/DomWatcher';
import type { TaskContext } from './TaskContext';
import type { Task } from './types';
import { getTaskInjectAt, isArtifactTask } from './util';

export class TaskLifeCycle {
	private readonly taskContext: TaskContext;
	private readonly injectConfig: InjectionConfig;
	private readonly onTargetReady: (targetElement: HTMLElement, taskId: string) => void;
	private readonly logger: ILogger;
	private readonly emit: ObserveEmitter;

	constructor(
		taskContext: TaskContext,
		onTargetReady: (targetElement: HTMLElement, taskId: string) => void,
		injectConfig: InjectionConfig,
		emitter: ObserveEmitter,
		logger?: ILogger
	) {
		this.taskContext = taskContext;
		this.onTargetReady = onTargetReady;
		this.injectConfig = injectConfig;
		this.emit = emitter;
		this.logger = logger ?? injectConfig.logger ?? new Logger();
	}

	public enableAlive(taskId: string): void {
		const context = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task "${taskId}" not found`);
			return;
		}

		// enableAlive only applies to component tasks
		if (!isArtifactTask(context)) {
			this.logger.warn(`enableAlive is not applicable to non-component task "${taskId}"`);
			return;
		}

		// Already alive with an active observer, skip
		if (context.alive && context.isObserver) {
			this.logger.warn(`Task "${taskId}" already has an active alive observer`);
			return;
		}

		context.alive = true;
		context.isObserver = false;
		this.emit(
			'alive:enable',
			buildAliveObservePayload('alive:enable', {
				taskId,
				kind: 'component',
				injectAt: context.injectAt,
				status: context.taskStatus,
				scope: context.scope
			})
		);
		// placeholder stop handler for pending async setup
		context.disableAlive = () => {};

		// Case 1: Component is already mounted and connected - set up the alive observer directly
		if (context.mountHandle && context.appRoot?.isConnected) {
			const matchedElement = context.hostElement ?? context.appRoot.parentElement;
			if (!matchedElement) {
				this.logger.warn(
					`Task "${taskId}": host element not found, unable to activate alive observer`
				);
				return;
			}

			const currentDocument = matchedElement.ownerDocument || document;
			const injectAt = context.injectAt;

			const stopHandler = DOMWatcher.onDomAlive(
				matchedElement,
				injectAt,
				() => {
					this.taskContext.reset(taskId);
				},
				(el): void => this.onTargetReady(el, taskId),
				context.scope === 'global' ? currentDocument : matchedElement,
				{
					once: true,
					timeout: this.injectConfig.timeout
				},
				{
					logger: this.logger,
					emit: createDomObserveEmitFactory({
						emit: this.emit,
						taskId,
						kind: 'component',
						injectAt,
						root: context.scope === 'global' ? currentDocument : matchedElement
					})
				}
			);

			if (!context.alive) {
				stopHandler();
				return;
			}
			context.disableAlive = stopHandler;
			context.isObserver = true;
			this.emit(
				'alive:observeStart',
				buildAliveObservePayload('alive:observeStart', {
					taskId,
					kind: 'component',
					injectAt,
					status: context.taskStatus,
					scope: context.scope,
					observerMode: 'mounted'
				})
			);
			this.logger.info(`Task "${taskId}" alive observer activated`);
			return;
		}

		// Case 2: Component app exists but appRoot is disconnected from DOM
		// This happens when disableAlive was called after the node was removed but before cleanup.
		// We need to reset the state and re-trigger onDomReady for re-injection.
		if (context.mountHandle && !context.appRoot?.isConnected) {
			this.taskContext.reset(taskId);
		}

		// Case 3: Component is not mounted (e.g., removed from DOM after disableAlive was called)
		// Re-trigger onDomReady to wait for the target element and re-inject
		if (!context.mountHandle) {
			let cancelled = false;
			const stopReadyObserver = DOMWatcher.onDomReady(
				context.injectAt,
				(el): void => {
					if (cancelled || !context.alive) {
						this.logger.warn(
							`Task "${taskId}" alive state changed before element appears`
						);
						return;
					}
					this.onTargetReady(el, taskId);
				},
				document,
				{ once: true, timeout: this.injectConfig.timeout },
				{
					logger: this.logger,
					emit: createDomObserveEmitFactory({
						emit: this.emit,
						taskId,
						kind: 'component',
						injectAt: context.injectAt,
						root: document
					})
				}
			);
			context.disableAlive = () => {
				if (cancelled) return;
				cancelled = true;
				this.emit(
					'alive:observeStop',
					buildAliveObservePayload('alive:observeStop', {
						taskId,
						kind: 'component',
						injectAt: context.injectAt,
						status: context.taskStatus,
						scope: context.scope,
						observerMode: 'await-target'
					})
				);
				stopReadyObserver();
			};
			context.isObserver = true;
			this.emit(
				'alive:observeStart',
				buildAliveObservePayload('alive:observeStart', {
					taskId,
					kind: 'component',
					injectAt: context.injectAt,
					status: context.taskStatus,
					scope: context.scope,
					observerMode: 'await-target'
				})
			);
			this.logger.info(`Task "${taskId}" awaiting target element for re-injection`);
		}
	}

	public disableAlive(taskId: string): void {
		const context = this.taskContext.get(taskId);

		if (!context) {
			this.logger.error(`Task "${taskId}" not found`);
			return;
		}

		if (!isArtifactTask(context)) {
			this.logger.warn(`disableAlive is not applicable to non-component task "${taskId}"`);
			return;
		}

		// status check: if not set alive mode or set false to alive mode, warn and exit
		if (!context.alive) {
			this.logger.warn(`Task "${taskId}" has no active alive observer to stop`);
			return;
		}

		const stopHandler = context.disableAlive;
		context.alive = false;
		context.isObserver = false;
		context.disableAlive = undefined;
		stopHandler?.();
		this.emit(
			'alive:disable',
			buildAliveObservePayload('alive:disable', {
				taskId,
				kind: 'component',
				injectAt: context.injectAt,
				status: context.taskStatus,
				scope: context.scope
			})
		);
		this.emit(
			'alive:observeStop',
			buildAliveObservePayload('alive:observeStop', {
				taskId,
				kind: 'component',
				injectAt: context.injectAt,
				status: context.taskStatus,
				scope: context.scope,
				observerMode: context.mountHandle ? 'mounted' : 'await-target'
			})
		);
	}

	public destroy(taskId: string): void {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task ${taskId} not found`);
			return;
		}

		const preStatus = context.taskStatus;
		const injectAt = getTaskInjectAt(context);
		this.emit(
			'task:beforeDestroy',
			buildTaskObservePayload('task:beforeDestroy', {
				taskId,
				kind: context.kind,
				injectAt,
				status: preStatus
			})
		);
		this.emit(
			'task:destroy',
			buildTaskObservePayload('task:destroy', {
				taskId,
				kind: context.kind,
				injectAt,
				status: preStatus
			})
		);
		if (isArtifactTask(context) && context.alive) {
			this.disableAlive(taskId);
		}
		this.taskContext.destroy(taskId);
		this.emit(
			'task:afterDestroy',
			buildTaskObservePayload('task:afterDestroy', {
				taskId,
				kind: context.kind,
				injectAt,
				preStatus
			})
		);
	}

	public destroyAll(): void {
		for (const id of this.taskContext.keys()) {
			const context: Task | undefined = this.taskContext.get(id);
			if (context && isArtifactTask(context) && context.alive) {
				this.disableAlive(id);
			}
		}
		this.taskContext.destroyAll();
	}
	public reset(taskId: string): void {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task ${taskId} not found`);
			return;
		}

		const preStatus = context.taskStatus;
		const injectAt = getTaskInjectAt(context);
		this.emit(
			'task:beforeReset',
			buildTaskObservePayload('task:beforeReset', {
				taskId,
				kind: context.kind,
				injectAt,
				status: preStatus
			})
		);
		this.emit(
			'task:reset',
			buildTaskObservePayload('task:reset', {
				taskId,
				kind: context.kind,
				injectAt,
				status: preStatus
			})
		);
		if (isArtifactTask(context) && context.alive) {
			this.disableAlive(taskId);
		}
		this.taskContext.reset(taskId);
		this.emit(
			'task:afterReset',
			buildTaskObservePayload('task:afterReset', {
				taskId,
				kind: context.kind,
				injectAt,
				status: context.taskStatus,
				preStatus
			})
		);
	}
	public resetAll(): void {
		for (const id of this.taskContext.keys()) {
			const context: Task | undefined = this.taskContext.get(id);
			if (context && isArtifactTask(context) && context.alive) {
				this.disableAlive(id);
			}
		}
		this.taskContext.resetAll();
	}
}
