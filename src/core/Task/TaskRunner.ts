import type { App, ComponentPublicInstance, Plugin, WatchHandle, WatchSource } from 'vue';
import { createApp, nextTick, watch } from 'vue';
import { UUID } from '../../util/uuid';
import type { ObserveEmitter } from '../hooks/type';
import { Action, type ActionEvent, type InjectionConfig } from '../Injector/types';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { DOMWatcher } from '../watcher/DomWatcher';
import type { TaskContext } from './TaskContext';
import type { Task } from './types';

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
		this.emit('run:start', {
			meta: {
				totalTasks: this.taskContext.taskRecords.length
			}
		});
		if (this.taskContext.taskRecords.length === 0) {
			throw new Error('No registered tasks found, call register() before run()');
		}
		this.taskContext.taskRecords.forEach(({ taskId: id, injectAt }) => {
			const status: 'idle' | 'pending' | 'active' | undefined =
				this.taskContext.getTaskStatus(id);

			const task: Task | undefined = this.taskContext.get(id);

			if (!task || !status) return;
			if (status === 'active' || status === 'pending') {
				this.emit('run:taskSkipped', {
					taskId: id,
					injectAt,
					status
				});
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
				this.emit('run:taskScheduled', {
					taskId: id,
					injectAt,
					status: 'pending'
				});
			}
		});
	}

	public onTargetReady(targetElement: HTMLElement, taskId: string): void {
		this.emit('target:ready', {
			taskId
		});
		const context = this.taskContext.get(taskId);
		if (!context) {
			this.logger.error(`Task "${taskId}" not found, unable to proceed with injection`);
			return;
		}

		if (context.taskStatus === 'active') {
			return;
		}

		// Mount component
		if (context.component) {
			this.emit('inject:start', {
				taskId,
				injectAt: context.componentInjectAt
			});
			const result: boolean = this.injectComponent(targetElement, taskId);
			if (!result) {
				// inject fails, not need call setTaskStatus because this one will emit the other eventj
				context.taskStatus = 'idle';
				this.emit('inject:fail', {
					taskId,
					injectAt: context.componentInjectAt,
					status: 'idle'
				});
				return;
			}
			this.emit('inject:success', {
				taskId,
				injectAt: context.componentInjectAt
			});
		}

		// If event binding is configured, bind the event
		if (context.withEvent) {
			let result: boolean | null = null;
			if (context.activitySignal) {
				result = this.bindListenerSignal(taskId, context.activitySignal());
			} else {
				result = this.controlListener(taskId, Action.OPEN);
			}

			// listener attach fails, not need call setTaskStatus because this one will emit the other event
			if (result === false) {
				context.taskStatus = 'idle';
				this.emit('listener:attachFail', {
					taskId,
					injectAt: context.componentInjectAt,
					status: 'idle'
				});
				return;
			}
		}

		context.taskStatus = 'active';
		this.emit('task:active', {
			taskId,
			injectAt: context.componentInjectAt ?? context.listenAt,
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
			context.watcher();
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

			context.watcher = unWatch;
			context.watchSource = source;
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

		// Check if event binding is configured
		if (!context.withEvent || !context.listenAt || !context.event || !context.callback) {
			this.logger.warn(`Task "${taskId}" has no event binding configured`);
			return false;
		}

		switch (event) {
			case Action.OPEN: {
				// If controller already exists, event is already bound
				if (context.controller) {
					return false;
				}

				const newController = this.attachEvent(
					taskId,
					context.listenAt,
					context.event,
					context.callback
				);

				if (newController) {
					context.controller = newController;
					this.emit('listener:open', {
						taskId,
						injectAt: context.listenAt,
						status: context.taskStatus
					});
				} else {
					this.logger.error(
						`Failed to attach event "${context.event}" for task "${taskId}"`
					);
					this.emit('listener:attachFail', {
						taskId,
						injectAt: context.listenAt,
						error: `Failed to attach event "${context.event}"`
					});
					return false;
				}
				break;
			}
			case Action.CLOSE: {
				if (!context.controller) {
					return false;
				}

				context.controller.abort(); // Abort event listener
				context.controller = undefined;
				this.logger.info(`Event "${context.event}" detached from task "${taskId}"`);
				this.emit('listener:close', {
					taskId,
					injectAt: context.listenAt,
					status: context.taskStatus
				});
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
	private injectComponent(matchedElement: HTMLElement, taskId: string): boolean {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context || !context.componentInjectAt) {
			this.logger.error(`Task "${taskId}" context missing, injection aborted`);
			return false;
		}

		if (context?.app) {
			this.logger.warn(`Task "${taskId}" is already mounted, skipping`);
			return false;
		}

		const injectAt: string = context.componentInjectAt;
		const plugins: Plugin[] = this.taskContext.getPlugins();

		if (!context?.component || !context.taskId) {
			this.logger.error(`No component found for task "${taskId}", injection aborted`);
			return false;
		}
		const currentDocument = matchedElement.ownerDocument || document;

		const appRoot = currentDocument.createElement('div');
		appRoot.id = `vue-injector-${UUID()}`;
		appRoot.style.display = 'contents';
		appRoot.style.zIndex = '999999';

		// Isolated node condition
		if (matchedElement.isConnected) {
			matchedElement.appendChild(appRoot); // matchedElement is the target host element
		} else {
			this.logger.warn(
				`Target element for task "${taskId}" is detached from DOM, injection skipped`
			);
			return false;
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

			return true;
		} catch (error) {
			this.logger.error(`Component mount failed for task "${taskId}":`, error);
			appRoot.remove();
			return false;
		}
	}
}
