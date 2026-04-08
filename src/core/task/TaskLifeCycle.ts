import { nextTick } from 'vue';
import { createObserveEmitter } from '../hooks/ObservabilityHook/createObserveEmitter';
import type { ObserveEmitter } from '../hooks/ObservabilityHook/type';
import type { InjectionConfig } from '../Injector/types';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { DOMWatcher } from '../watcher/DomWatcher';
import type { TaskContext } from './TaskContext';
import type { Task } from './types';

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
		logger?: ILogger
	) {
		this.taskContext = taskContext;
		this.onTargetReady = onTargetReady;
		this.injectConfig = injectConfig;
		this.logger = logger ?? injectConfig.logger ?? new Logger();
		this.emit = createObserveEmitter(this.injectConfig.observer);
	}

	public enableAlive(taskId: string): void {
		const context = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task "${taskId}" not found`);
			return;
		}

		// enableAlive only applies to component tasks
		if (!context.component || !context.componentInjectAt) {
			this.logger.warn(`enableAlive is not applicable to non-component task "${taskId}"`);
			return;
		}

		// Already alive with an active observer, skip
		if (context.alive && context.isObserver) {
			this.logger.warn(`Task "${taskId}" already has an active alive observer`);
			return;
		}

		const aliveEpoch = (context.aliveEpoch ?? 0) + 1;
		context.aliveEpoch = aliveEpoch;
		context.alive = true;
		context.isObserver = false;
		this.emit('alive:enable', {
			taskId,
			injectAt: context.componentInjectAt,
			status: context.taskStatus
		});
		// placeholder stop handler for pending async setup
		context.disableAlive = () => {};

		// Case 1: Component is already mounted and connected - set up the alive observer directly
		if (context.app && context.appRoot?.isConnected) {
			const matchedElement = context.appRoot.parentElement;
			if (!matchedElement) {
				this.logger.warn(
					`Task "${taskId}": host element not found, unable to activate alive observer`
				);
				return;
			}

			const currentDocument = matchedElement.ownerDocument || document;
			const injectAt = context.componentInjectAt;

			nextTick().then(() => {
				if (!context.alive || context.aliveEpoch !== aliveEpoch) return;

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
						emit: this.emit
					}
				);

				if (!context.alive || context.aliveEpoch !== aliveEpoch) {
					stopHandler();
					return;
				}
				context.disableAlive = stopHandler;
				context.isObserver = true;
				this.emit('alive:observeStart', {
					taskId,
					injectAt,
					status: context.taskStatus
				});
				this.logger.info(`Task "${taskId}" alive observer activated`);
			});
			return;
		}

		// Case 2: Component app exists but appRoot is disconnected from DOM
		// This happens when disableAlive was called after the node was removed but before cleanup.
		// We need to reset the state and re-trigger onDomReady for re-injection.
		if (context.app && !context.appRoot?.isConnected) {
			this.taskContext.reset(taskId);
		}

		// Case 3: Component is not mounted (e.g., removed from DOM after disableAlive was called)
		// Re-trigger onDomReady to wait for the target element and re-inject
		if (!context.app) {
			let cancelled = false;
			const stopReadyObserver = DOMWatcher.onDomReady(
				context.componentInjectAt,
				(el): void => {
					if (cancelled || !context.alive || context.aliveEpoch !== aliveEpoch) {
						this.logger.warn(
							`Task "${taskId}" alive epoch changed before element appears`
						);
						return;
					}
					this.onTargetReady(el, taskId);
				},
				document,
				{ once: true, timeout: this.injectConfig.timeout },
				{
					logger: this.logger,
					emit: this.emit
				}
			);
			context.disableAlive = () => {
				if (cancelled) return;
				cancelled = true;
				this.emit('alive:observeStop', {
					taskId,
					injectAt: context.componentInjectAt,
					status: context.taskStatus
				});
				stopReadyObserver();
			};
			context.isObserver = true;
			this.emit('alive:observeStart', {
				taskId,
				injectAt: context.componentInjectAt,
				status: context.taskStatus
			});
			this.logger.info(`Task "${taskId}" awaiting target element for re-injection`);
		}
	}

	public disableAlive(taskId: string): void {
		const context = this.taskContext.get(taskId);

		if (!context) {
			this.logger.error(`Task "${taskId}" not found`);
			return;
		}

		// status check: if not set alive mode or set false to alive mode, warn and exit
		if (!context.alive) {
			this.logger.warn(`Task "${taskId}" has no active alive observer to stop`);
			return;
		}

		context.aliveEpoch = (context.aliveEpoch ?? 0) + 1;
		const stopHandler = context.disableAlive;
		context.alive = false;
		context.isObserver = false;
		context.disableAlive = undefined;
		stopHandler?.();
		this.emit('alive:disable', {
			taskId,
			injectAt: context.componentInjectAt,
			status: context.taskStatus
		});
		this.emit('alive:observeStop', {
			taskId,
			injectAt: context.componentInjectAt,
			status: context.taskStatus
		});
	}

	public destroy(taskId: string): void {
		const context: Task | undefined = this.taskContext.get(taskId);
		this.emit('task:destroy', {
			taskId,
			injectAt: context?.componentInjectAt,
			status: context?.taskStatus
		});
		if (context?.alive) {
			this.disableAlive(taskId);
		}
		this.taskContext.destroy(taskId);
	}

	public destroyAll(): void {
		for (const id of this.taskContext.keys()) {
			const context: Task | undefined = this.taskContext.get(id);
			if (context?.alive) {
				this.disableAlive(id);
			}
		}
		this.taskContext.destroyAll();
	}
	public reset(taskId: string): void {
		const context: Task | undefined = this.taskContext.get(taskId);
		this.emit('task:reset', {
			taskId,
			injectAt: context?.componentInjectAt,
			status: context?.taskStatus
		});
		if (context?.alive) {
			this.disableAlive(taskId);
		}
		this.taskContext.reset(taskId);
	}
	public resetAll(): void {
		for (const id of this.taskContext.keys()) {
			const context: Task | undefined = this.taskContext.get(id);
			if (context?.alive) {
				this.disableAlive(id);
			}
		}
		this.taskContext.resetAll();
	}
}
