import type { Pinia } from 'pinia';
import {
	type App,
	type Component,
	type ComponentPublicInstance,
	createApp,
	markRaw,
	nextTick,
	type Ref,
	type WatchHandle,
	type WatchSource,
	watch
} from 'vue';
import {
	Action,
	type ActionEvent,
	type eventOptions,
	type InjectionConfig,
	type InjectionContext
} from '../type';
import { UUID } from '../util/uuid';
import { DOMWatcher } from './DomWatcher';
import { TaskContext } from './TaskContext';

/**
 *  TODO:
 *  1.重试机制(Considering)
 *  2.复活机制,当组件被意外卸载时,能够自动重新注入(finished)
 *  3.完备的生命周期钩子(wait...)
 * 	4.看情况解耦注入点与监视点的释义(Considering)
 */
export class Injector {
	// Unified injection context containing all component-related data
	private readonly taskContext: TaskContext = new TaskContext();
	private readonly domWatcher: DOMWatcher = new DOMWatcher();
	private readonly injectConfig: InjectionConfig = {};

	constructor(
		config: InjectionConfig = {
			alive: false,
			scope: 'local',
			timeout: 5000
		}
	) {
		this.injectConfig = config;
	}

	public run(): void {
		if (this.taskContext.getRunningFlag()) {
			console.warn('[Injector Warning] Injector is already running, do not call run() again');
			return;
		}
		if (this.taskContext.injectPoints.length === 0) {
			throw new Error(
				'[Injector Error] No tasks found to inject, please ensure tasks are registered'
			);
		}
		if (!this.taskContext.getPinia()) {
			throw new Error(
				'[Injector Error] Pinia instance not found, please initialize Pinia before use'
			);
		}
		this.taskContext.setRunningFlag(true);
		this.taskContext.injectPoints.forEach(({ id, injectAt }) => {
			this.domWatcher.onDomReady(
				injectAt,
				(el): void => this.handleInjectionReady(el, id),
				document,
				{ once: true, timeout: this.injectConfig.timeout }

			);
		});
	}

	public registerListener(
		listenAt: string,
		event: string,
		callback: EventListener,
		activitySignal?: () => Ref<boolean>
	): string {
		// Standalone method for registering event listeners without component injection
		const id: string = `listener-${listenAt}-${event}`;

		if (this.taskContext.has(id)) {
			throw new Error(
				`[Injector Error] Listener ${id} is already registered, do not register again`
			);
		}

		const context: InjectionContext = {
			taskId: id,
			listenerName: id,
			withEvent: true,
			listenAt,
			event,
			callback
		};
		// Retrieve external activity signal
		if (activitySignal) {
			context.activitySignal = activitySignal;
		}
		this.taskContext.set(id, context);
		this.taskContext.injectPoints.push({ id: id, injectAt: listenAt });
		console.log(`[Injector] Task ${id} registered successfully.`);
		return id;
	}

	public register(injectAt: string, component: Component, option?: eventOptions): string {
		const taskId: string = this.getTaskId(component, injectAt);
		if (this.taskContext.has(taskId)) {
			// Component already registered, return directly
			console.warn(
				`[Injector Warning] Component ${taskId} is already registered, do not register again`
			);
			return taskId;
		}
		// Use unified InjectionContext to store all information
		const context: InjectionContext = {
			taskId,
			componentName: this.getComponentName(component),
			componentInjectAt: injectAt,
			component: this.markRawComponent(component),
			withEvent: false
		};

		if (option) {
			// If event options are provided, add event-related info
			context.listenerName = `listener-${option.listenAt}-${option.event}`;
			context.withEvent = true;
			context.listenAt = option.listenAt;
			context.event = option.event;
			context.callback = option.callback;
		}

		// Extract activity signal
		if (option?.activitySignal) {
			context.activitySignal = option.activitySignal;
		}

		this.taskContext.set(taskId, context);
		this.taskContext.injectPoints.push({
			id: taskId,
			injectAt: injectAt
		});
		console.log(`[Injector] Task: ${taskId} registered successfully`);
		return taskId;
	}

	public setPinia(pinia: Pinia): void {
		this.taskContext.setPinia(pinia);
	}

	public destroyed(id: string): void {
		this.taskContext.destroy(id);
	}

	public destroyedAll(): void {
		this.taskContext.destroyedAll();
	}

	public bindActivitySignal(id: string, source: WatchSource<boolean>): void {
		// Bind a reactive signal to control automatic listener attach/detach for this task
		const context: InjectionContext | undefined = this.taskContext.get(id);
		if (!context) {
			console.error(`[Injector Error] Context not found for ${id}`);
			return;
		}

		const unWatch: WatchHandle = watch(
			source,
			(newSignal) => {
				this.listenerActivity(id, {
					type: newSignal ? Action.OPEN : Action.CLOSE
				});
			},
			{ immediate: true }
		);

		context.watcher = unWatch;
		context.watchSource = source;
	}

	public listenerActivity(id: string, event: ActionEvent): void {
		const context: InjectionContext | undefined = this.taskContext.get(id);
		if (!context) {
			console.error(
				`[Injector Error] Context not found for Task ${id}, unable to manage event state`
			);
			return;
		}

		// Check if event binding is configured
		if (!context.withEvent || !context.listenAt || !context.event || !context.callback) {
			console.warn(
				`[Injector Warning] Task ${id} has no event binding configured, unable to manage event state`
			);
			return;
		}

		switch (event.type) {
			case Action.OPEN: {
				// If controller already exists, event is already bound
				if (context.controller) {
					break;
				}

				const newController = this.attachEvent(
					id,
					context.listenAt,
					context.event,
					context.callback
				);

				if (newController) {
					context.controller = newController;
				} else {
					console.error(
						`[Injector Error] Failed to bind event ${context.event}, unable to rebind`
					);
				}
				break;
			}
			case Action.CLOSE: {
				if (!context.controller) {
					break;
				}

				context.controller.abort(); // Abort event listener
				context.controller = undefined;
				console.log(`[Injector] Event ${context.event} on Task ${id} has been unbound`);
				break;
			}

			default: {
				console.warn(
					`[Injector Warning] Unsupported event action ${event.type}, please check the event action`
				);
			}
		}
	}

	private handleInjectionReady(targetElement: HTMLElement, id: string): void {
		const context = this.taskContext.get(id);
		if (!context) {
			console.error(
				`[Injector Error] Context not found for Task ${id}, unable to inject component`
			);
			return;
		}

		// Mount component
		if (context.component) {
			this.injectComponent(targetElement, id);
		}
		// If event binding is configured, bind the event
		if (context.withEvent) {
			if (context.activitySignal) {
				this.bindActivitySignal(id, context.activitySignal());
			} else {
				this.listenerActivity(id, { type: Action.OPEN });
			}
		}
	}

	private getTaskId(component: Component, selector: string): string {
		const name = this.getComponentName(component);
		return name ? `${name}@${selector}` : `component-${selector}`;
	}

	private getComponentName(component: Component): string {
		// biome-ignore lint: false positive
		return component?.name || (component as any)?.__name || '';
	}

	// Event binding function
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
			console.log(
				`[Injector] Event binding successful, id: ${id}, event: ${event}, listenAt: ${listenAt}`
			);
			return controller;
		}

		const proxyController = new AbortController();
		this.domWatcher.onDomReady(
			listenAt,
			(el) => {
				if (proxyController.signal.aborted) return;
				el.addEventListener(event, callback, {
					signal: proxyController.signal
				});
				console.log(
					`[Injector] Event binding successful, id: ${id}, event: ${event}, listenAt: ${listenAt}`
				);
			},
			document,
			{ once: true, timeout: this.injectConfig.timeout }
		);

		return proxyController;
	}

	// TODD:considering to the "Race Condition" that may occur when the component is injecting and then the app host be removed
	// Inject component into the matched DOM element
	private injectComponent(matchedElement: HTMLElement, taskId: string): boolean {
		const context: InjectionContext | undefined = this.taskContext.get(taskId);
		if (!context || !context.componentInjectAt) {
			console.error(
				`[Injector Error] Context not found for component ${taskId}, unable to inject`
			);
			return false;
		}

		if (context?.app) {
			console.warn(
				`[Injector Warning] Component ${taskId} is already mounted, skipping duplicate injection`
			);
			return false;
		}

		const injectAt: string = context.componentInjectAt;
		const pinia: Pinia = this.taskContext.getPinia() as Pinia;

		if (!context?.component || !context.taskId) {
			console.error(
				`[Injector Error] Component not found for injection point ${injectAt}, please ensure it is registered`
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
				`[Injector Warning] Target element is not connected to the DOM, this task will be stopped injection`
			);
			return false;
		}

		try {
			// Create a Vue app instance and mount it to the newly created DOM node
			const subApp: App<Element> = createApp(context.component);
			subApp.use(pinia);
			const vm: ComponentPublicInstance = subApp.mount(appRoot);

			// Save to context
			context.app = subApp;
			context.instance = vm;
			context.appRoot = appRoot;

			console.log(
				'[Injector] Component injected successfully, name:',
				context.componentName,
				'injectAt:',
				injectAt
			);

			if (this.injectConfig.alive) {
				// Injection re-injection mechanism
				// if write 'global', the watcher will observer the document body element
				// if write 'local', the watcher will observe the matchedElement, which is the component's host element
				nextTick().then(() => {
					this.domWatcher.onDomAlive(
						matchedElement,
						injectAt,
						() => {
							this.taskContext.resetState(taskId);
						},
						(el): void => this.handleInjectionReady(el, taskId),
						this.injectConfig.scope === 'global' ? currentDocument : matchedElement
					);
					console.log(`[Injector] DomAlive watcher set for taskId ${taskId}`);
				});
			}

			return true;
		} catch (error) {
			console.error(`[Injector Error] Component mount failed:`, error);
			appRoot.remove();
			return false;
		}
	}

	private markRawComponent(component: Component): Component {
		return import.meta.env.PROD ? markRaw(component) : component;
	}
}
