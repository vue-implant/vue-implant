import type { App, ComponentPublicInstance, Plugin, WatchHandle, WatchSource } from 'vue';
import { createApp, nextTick, watch } from 'vue';
import { UUID } from '../../util/uuid';
import type { ObserveEmitter } from '../hooks/type';
import { Action, type ActionEvent, type InjectionConfig } from '../Injector/types';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { buildInjectObservePayload } from '../payload/buildInjectObservePayload';
import { buildListenerObservePayload } from '../payload/buildListenerObservePayload';
import { buildRunObservePayload } from '../payload/buildRunObservePayload';
import { DOMWatcher } from '../watcher/DomWatcher';
import type { TaskContext } from './TaskContext';
import type { _InjectResult, Task, TaskListenerFeature } from './types';
import { getTaskInjectAt, getTaskListener, isComponentTask } from './util';

export class TaskRunner {
	private readonly taskContext: TaskContext;
	private readonly injectConfig: InjectionConfig;
	private readonly logger: ILogger;
	private readonly emit: ObserveEmitter;

	constructor(
		taskContext: TaskContext,
		injectConfig: InjectionConfig,
		emitter: ObserveEmitter,
		logger?: ILogger
	) {
		this.taskContext = taskContext;
		this.injectConfig = injectConfig;
		this.emit = emitter;
		this.logger = logger ?? injectConfig.logger ?? new Logger();
	}

	public run(): void {
		const runStats = this.taskContext.taskRecords.reduce(
			(acc, { taskId }) => {
				const status = this.taskContext.getTaskStatus(taskId);
				if (status === 'idle') acc.idleTasks += 1;
				if (status === 'pending') acc.pendingTasks += 1;
				if (status === 'active') acc.activeTasks += 1;
				return acc;
			},
			{
				totalTasks: this.taskContext.taskRecords.length,
				idleTasks: 0,
				pendingTasks: 0,
				activeTasks: 0
			}
		);

		this.emit('run:start', buildRunObservePayload('run:start', runStats));
		if (this.taskContext.taskRecords.length === 0) {
			throw new Error('No registered tasks found, call register() before run()');
		}
		this.taskContext.taskRecords.forEach(({ taskId: id, injectAt }) => {
			const status: 'idle' | 'pending' | 'active' | undefined =
				this.taskContext.getTaskStatus(id);

			const task: Task | undefined = this.taskContext.get(id);

			if (!task || !status) return;
			if (status === 'active' || status === 'pending') {
				this.emit(
					'run:taskSkipped',
					buildRunObservePayload('run:taskSkipped', {
						taskId: id,
						kind: task.kind,
						injectAt,
						status,
						skipReason: status === 'active' ? 'already-active' : 'already-pending'
					})
				);
				return;
			}

			DOMWatcher.onDomReady(
				injectAt,
				(el): void => this.onTargetReady(el, id),
				document,
				{
					once: true,
					timeout: task.timeout
				},
				{
					logger: this.logger,
					emit: this.emit
				}
			);
			if (this.taskContext.getTaskStatus(id) !== 'active') {
				// when the target element is exist, will sync call the func ,so we do not set to pending
				this.taskContext.setTaskStatus(id, 'pending');
				this.emit(
					'run:taskScheduled',
					buildRunObservePayload('run:taskScheduled', {
						taskId: id,
						kind: task.kind,
						injectAt,
						status: 'pending',
						preStatus: 'idle',
						timeout: task.timeout
					})
				);
			}
		});
	}

	public onTargetReady(targetElement: HTMLElement, taskId: string): void {
		const context = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task "${taskId}" not found, unable to proceed with injection`);
			return;
		}

		this.emit(
			'target:ready',
			buildRunObservePayload('target:ready', {
				taskId,
				kind: context.kind,
				injectAt: getTaskInjectAt(context),
				status: context.taskStatus
			})
		);

		if (context.taskStatus === 'active') {
			return;
		}
		const injectAt: string = getTaskInjectAt(context);

		// Mount component
		if (isComponentTask(context)) {
			this.emit(
				'inject:start',
				buildInjectObservePayload('inject:start', {
					taskId,
					kind: 'component',
					injectAt: context.componentInjectAt,
					status: context.taskStatus,
					componentName: context.componentName,
					alive: context.alive,
					scope: context.scope,
					withEvent: context.withEvent
				})
			);
			const result: _InjectResult = this.injectComponent(targetElement, taskId);
			if (!result.isSuccess) {
				// inject fails, not need call setTaskStatus because this one will emit the other event
				context.taskStatus = 'idle';
				this.emit(
					'inject:fail',
					buildInjectObservePayload('inject:fail', {
						taskId,
						kind: 'component',
						injectAt: context.componentInjectAt,
						status: 'idle',
						error:
							result.error ??
							new Error(`Component inject failed for task "${taskId}"`),
						componentName: context.componentName
					})
				);
				return;
			}
			this.emit(
				'inject:success',
				buildInjectObservePayload('inject:success', {
					taskId,
					kind: 'component',
					injectAt: context.componentInjectAt,
					status: context.taskStatus,
					componentName: context.componentName,
					alive: context.alive,
					scope: context.scope
				})
			);
		}

		// If event binding is configured, bind the event
		if (context.withEvent) {
			let result: boolean | null = null;
			const listener: TaskListenerFeature | undefined = getTaskListener(context);
			if (listener?.activitySignal) {
				result = this.bindListenerSignal(taskId, listener.activitySignal());
			} else {
				result = this.controlListener(taskId, Action.OPEN);
			}

			// listener attach fails, not need call setTaskStatus because this one will emit the other event
			if (result === false) {
				context.taskStatus = 'idle';
				const listener = getTaskListener(context);
				this.emit(
					'listener:attachFail',
					buildListenerObservePayload('listener:attachFail', {
						taskId,
						kind: context.kind,
						injectAt,
						status: 'idle',
						error: new Error(`Listener attach failed for task "${taskId}"`),
						listenerEvent: listener?.event,
						listenAt: listener?.listenAt
					})
				);
				return;
			}
		}

		context.taskStatus = 'active';
		this.emit('task:active', {
			taskId,
			injectAt,
			status: 'active'
		});
	}

	public bindListenerSignal(taskId: string, source: WatchSource<boolean>): boolean {
		// Bind a reactive signal to control automatic listener attach/detach for this task
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task "${taskId}" not found, unable to bind activity signal`);
			return false;
		}

		// Stop the previous watcher before creating a new one
		// to avoid both firing simultaneously during the immediate callback
		if (context.watcher) {
			context.watcher.watcher();
			context.watcher = undefined;
		}

		try {
			const unWatch: WatchHandle = watch(
				source,
				(newSignal) => {
					this.controlListener(taskId, newSignal ? Action.OPEN : Action.CLOSE);
				},
				{ immediate: true }
			);

			context.watcher = {
				watcher: unWatch,
				watchSource: source
			};
			return true;
		} catch (e) {
			this.logger.error(`Failed to bind activity signal for task "${taskId}":`, e);
			return false;
		}
	}
	public controlListener(taskId: string, event: ActionEvent): boolean {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task "${taskId}" not found, unable to manage listener state`);
			return false;
		}
		const listener = getTaskListener(context);

		// Check if event binding is configured
		if (!listener) {
			this.logger.warn(`Task "${taskId}" has no event binding configured`);
			return false;
		}

		switch (event) {
			case Action.OPEN: {
				// If controller already exists, event is already bound
				if (listener.controller) {
					return false;
				}

				const newController = this.attachEvent(
					taskId,
					listener.listenAt,
					listener.event,
					listener.callback
				);

				if (newController) {
					listener.controller = newController;
					this.emit(
						'listener:open',
						buildListenerObservePayload('listener:open', {
							taskId,
							kind: context.kind,
							injectAt: listener.listenAt,
							status: context.taskStatus,
							listenerEvent: listener.event,
							listenAt: listener.listenAt
						})
					);
				} else {
					const error = new Error(
						`Failed to attach event "${listener.event}" for task "${taskId}"`
					);
					this.logger.error(error.message);
					this.emit(
						'listener:attachFail',
						buildListenerObservePayload('listener:attachFail', {
							taskId,
							kind: context.kind,
							injectAt: listener.listenAt,
							status: context.taskStatus,
							error,
							listenerEvent: listener.event,
							listenAt: listener.listenAt
						})
					);
					return false;
				}
				break;
			}
			case Action.CLOSE: {
				if (!listener.controller) {
					return false;
				}

				listener.controller.abort(); // Abort event listener
				listener.controller = undefined;
				this.logger.info(`Event "${listener.event}" detached from task "${taskId}"`);
				this.emit(
					'listener:close',
					buildListenerObservePayload('listener:close', {
						taskId,
						kind: context.kind,
						injectAt: listener.listenAt,
						status: context.taskStatus,
						listenerEvent: listener.event,
						listenAt: listener.listenAt
					})
				);
				break;
			}

			default: {
				this.logger.warn(`Unknown action type "${event}" for task "${taskId}"`);
				return false;
			}
		}
		return true;
	}
	private attachEvent(
		id: string,
		listenAt: string,
		event: string,
		callback: EventListener
	): AbortController | null {
		const element = document.querySelector(listenAt) as HTMLElement;
		if (element) {
			const controller = new AbortController();
			element.addEventListener(event, callback, {
				signal: controller.signal
			});
			this.logger.info(`Event "${event}" attached at "${listenAt}" (task: ${id})`);
			return controller;
		}

		const proxyController = new AbortController();
		DOMWatcher.onDomReady(
			listenAt,
			(el) => {
				if (proxyController.signal.aborted) return;
				el.addEventListener(event, callback, {
					signal: proxyController.signal
				});
				this.logger.info(`Event "${event}" attached at "${listenAt}" (task: ${id})`);
			},
			document,
			{ once: true, timeout: this.injectConfig.timeout },
			{
				logger: this.logger,
				emit: this.emit
			}
		);

		return proxyController;
	}
	private injectComponent(matchedElement: HTMLElement, taskId: string): _InjectResult {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context || !isComponentTask(context)) {
			const error = new Error(`Task "${taskId}" context missing, injection aborted`);
			this.logger.error(error.message);
			return {
				isSuccess: false,
				error
			};
		}

		if (!context.taskId) {
			const error = new Error(`No component found for task "${taskId}", injection aborted`);
			this.logger.error(error.message);
			return {
				isSuccess: false,
				error
			};
		}

		if (context?.app) {
			const error = new Error(`Task "${taskId}" is already mounted, skipping`);
			this.logger.warn(error.message);
			return {
				isSuccess: false,
				error
			};
		}

		const injectAt: string = context.componentInjectAt;
		const plugins: Plugin[] = this.taskContext.getPlugins();
		const currentDocument = matchedElement.ownerDocument || document;

		const appRoot = currentDocument.createElement('div');
		appRoot.id = `vue-injector-${UUID()}`;
		appRoot.style.display = 'contents';
		appRoot.style.zIndex = '999999';

		// Isolated node condition
		if (matchedElement.isConnected) {
			matchedElement.appendChild(appRoot); // matchedElement is the target host element
		} else {
			const error = new Error(
				`Target element for task "${taskId}" is detached from DOM, injection skipped`
			);
			this.logger.warn(error.message);
			return {
				isSuccess: false,
				error
			};
		}

		try {
			// Create a Vue app instance and mount it to the newly created DOM node
			const subApp: App<Element> = createApp(context.component);
			for (const plugin of plugins) {
				subApp.use(plugin);
			}
			const vm: ComponentPublicInstance = subApp.mount(appRoot);

			// Save to context
			context.app = subApp;
			context.instance = vm;
			context.appRoot = appRoot;

			this.logger.info(`Component "${context.componentName}" injected at "${injectAt}"`);

			if (context.alive && !context.isObserver) {
				const aliveEpoch = context.aliveEpoch ?? 0;
				// Injection re-injection mechanism
				// if write 'global', the watcher will observer the document body element
				// if write 'local', the watcher will observe the matchedElement, which is the component's host element
				nextTick().then(() => {
					// if changes happen during async setup, directly return
					if (
						!context.alive ||
						context.aliveEpoch !== aliveEpoch ||
						context.app !== subApp
					)
						return;

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

					// if changes happen during async setup,
					// do not activate observer and clean up the listener
					if (
						!context.alive ||
						context.aliveEpoch !== aliveEpoch ||
						context.app !== subApp
					) {
						stopHandler();
						return;
					}
					context.disableAlive = stopHandler;
					context.isObserver = true;
					this.logger.info(`Task "${taskId}" alive observer activated`);
				});
			}

			return {
				isSuccess: true
			};
		} catch (error) {
			this.logger.error(`Component mount failed for task "${taskId}":`, error);
			appRoot.remove();
			return {
				isSuccess: false,
				error
			};
		}
	}
}
