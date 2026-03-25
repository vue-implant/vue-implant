import type { App, ComponentPublicInstance, Plugin, WatchHandle, WatchSource } from 'vue';
import { createApp, nextTick, watch } from 'vue';
import { Action, type ActionEvent, type InjectionConfig, type Task } from '../../type';
import { UUID } from '../../util/uuid';
import { DOMWatcher } from '../watcher/DomWatcher';
import type { TaskContext } from './TaskContext';

export class TaskRunner {
	private readonly taskContext: TaskContext;
	private readonly injectConfig: InjectionConfig;

	constructor(taskContext: TaskContext, injectConfig: InjectionConfig) {
		this.taskContext = taskContext;
		this.injectConfig = injectConfig;
	}

	public run(): void {
		if (this.taskContext.taskRecords.length === 0) {
			throw new Error(
				'[vue-injector] No registered tasks found, call register() before run()'
			);
		}
		this.taskContext.taskRecords.forEach(({ taskId: id, injectAt }) => {
			const status = this.taskContext.getTaskStatus(id);
			if (status === 'active' || status === 'pending') return;

			DOMWatcher.onDomReady(injectAt, (el): void => this.onTargetReady(el, id), document, {
				once: true,
				timeout: this.injectConfig.timeout
			});
			if (this.taskContext.getTaskStatus(id) !== 'active') {
				// when the target element is exist, will sync call the func ,so we do not set to pending
				this.taskContext.setTaskStatus(id, 'pending');
			}
		});
	}

	public onTargetReady(targetElement: HTMLElement, taskId: string): void {
		const context = this.taskContext.get(taskId);
		if (!context) {
			console.error(
				`[vue-injector] Task "${taskId}" not found, unable to proceed with injection`
			);
			return;
		}

		if (context.taskStatus === 'active') {
			return;
		}

		// Mount component
		if (context.component) {
			const result: boolean = this.injectComponent(targetElement, taskId);
			if (!result) {
				context.taskStatus = 'idle';
				return;
			}
		}

		// If event binding is configured, bind the event
		if (context.withEvent) {
			let result: boolean | null = null;
			if (context.activitySignal) {
				result = this.bindListenerSignal(taskId, context.activitySignal());
			} else {
				result = this.controlListener(taskId, Action.OPEN);
			}

			if (result === false) {
				context.taskStatus = 'idle';
				return;
			}
		}

		context.taskStatus = 'active';
	}

	public bindListenerSignal(taskId: string, source: WatchSource<boolean>): boolean {
		// Bind a reactive signal to control automatic listener attach/detach for this task
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context) {
			console.error(
				`[vue-injector] Task "${taskId}" not found, unable to bind activity signal`
			);
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
			console.error(`[vue-injector] Failed to bind activity signal for task "${taskId}":`, e);
			return false;
		}
	}
	public controlListener(taskId: string, event: ActionEvent): boolean {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context) {
			console.error(
				`[vue-injector] Task "${taskId}" not found, unable to manage listener state`
			);
			return false;
		}

		// Check if event binding is configured
		if (!context.withEvent || !context.listenAt || !context.event || !context.callback) {
			console.warn(`[vue-injector] Task "${taskId}" has no event binding configured`);
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
				} else {
					console.error(
						`[vue-injector] Failed to attach event "${context.event}" for task "${taskId}"`
					);
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
				console.log(
					`[vue-injector] Event "${context.event}" detached from task "${taskId}"`
				);
				break;
			}

			default: {
				console.warn(`[vue-injector] Unknown action type "${event}" for task "${taskId}"`);
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
			console.log(`[vue-injector] Event "${event}" attached at "${listenAt}" (task: ${id})`);
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
				console.log(
					`[vue-injector] Event "${event}" attached at "${listenAt}" (task: ${id})`
				);
			},
			document,
			{ once: true, timeout: this.injectConfig.timeout }
		);

		return proxyController;
	}
	private injectComponent(matchedElement: HTMLElement, taskId: string): boolean {
		const context: Task | undefined = this.taskContext.get(taskId);
		if (!context || !context.componentInjectAt) {
			console.error(`[vue-injector] Task "${taskId}" context missing, injection aborted`);
			return false;
		}

		if (context?.app) {
			console.warn(`[vue-injector] Task "${taskId}" is already mounted, skipping`);
			return false;
		}

		const injectAt: string = context.componentInjectAt;
		const pinia: Plugin | undefined = this.taskContext.getPinia();

		if (!context?.component || !context.taskId) {
			console.error(
				`[vue-injector] No component found for task "${taskId}", injection aborted`
			);
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
			console.warn(
				`[vue-injector] Target element for task "${taskId}" is detached from DOM, injection skipped`
			);
			return false;
		}

		try {
			// Create a Vue app instance and mount it to the newly created DOM node
			const subApp: App<Element> = createApp(context.component);
			if (pinia) {
				subApp.use(pinia);
			}
			const vm: ComponentPublicInstance = subApp.mount(appRoot);

			// Save to context
			context.app = subApp;
			context.instance = vm;
			context.appRoot = appRoot;

			console.log(
				`[vue-injector] Component "${context.componentName}" injected at "${injectAt}"`
			);

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
					console.log(`[vue-injector] Task "${taskId}" alive observer activated`);
				});
			}

			return true;
		} catch (error) {
			console.error(`[vue-injector] Component mount failed for task "${taskId}":`, error);
			appRoot.remove();
			return false;
		}
	}
}
