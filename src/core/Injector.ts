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
	type ComponentOptions,
	type InjectionConfig,
	type InjectionContext,
	type RegisterResult
} from '../type';
import { UUID } from '../util/uuid';
import { DOMWatcher } from './DomWatcher';
import { TaskContext } from './TaskContext';

export class Injector {
	// Unified injection context containing all component-related data
	private readonly taskContext: TaskContext = new TaskContext();
	private readonly domWatcher: DOMWatcher = new DOMWatcher();
	private readonly anonymousComponentNames: WeakMap<object, string> = new WeakMap();
	private readonly injectConfig: InjectionConfig = {
		alive: false,
		scope: 'local',
		timeout: 5000
	};

	constructor(config: Partial<InjectionConfig> = {}) {
		this.injectConfig = { ...this.injectConfig, ...config };
	}

	public run(): void {
		if (this.taskContext.getRunningFlag()) {
			console.warn(
				'[vue-injector] Injector is already running, duplicate run() call ignored'
			);
			return;
		}
		if (this.taskContext.injectPoints.length === 0) {
			throw new Error(
				'[vue-injector] No registered tasks found, call register() before run()'
			);
		}
		if (!this.taskContext.getPinia()) {
			throw new Error('[vue-injector] Pinia instance not set, call setPinia() before run()');
		}
		this.taskContext.setRunningFlag(true);
		this.taskContext.injectPoints.forEach(({ taskId: id, injectAt }) => {
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
			throw new Error(`[vue-injector] Listener "${id}" is already registered`);
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
		this.taskContext.injectPoints.push({ taskId: id, injectAt: listenAt });
		console.log(`[vue-injector] Listener "${id}" registered`);
		return id;
	}

	public register(
		injectAt: string,
		component: Component,
		option?: ComponentOptions
	): RegisterResult {
		const taskId: string = this.getTaskId(component, injectAt);
		if (this.taskContext.has(taskId)) {
			// Component already registered, return directly
			console.warn(`[vue-injector] Task "${taskId}" is already registered, skipping`);
			return {
				id: taskId,
				keepAlive: () => this.keepAlive(taskId),
				stopAlive: () => this.stopAlive(taskId)
			};
		}
		// Use unified InjectionContext to store all information
		const context: InjectionContext = {
			taskId,
			componentName: this.getComponentName(component),
			componentInjectAt: injectAt,
			component: this.markRawComponent(component),
			withEvent: false,

			alive: option?.alive ?? this.injectConfig.alive,
			aliveEpoch: 0,
			scope: option?.scope ?? this.injectConfig.scope,
			isObserver: false
		};

		if (option?.on) {
			// If event options are provided, add event-related info
			context.listenerName = `listener-${option.on.listenAt}-${option.on.type}`;
			context.withEvent = true;
			context.listenAt = option.on.listenAt;
			context.event = option.on.type;
			context.callback = option.on.callback;

			// Extract activity signal
			if (option.on.activitySignal) {
				context.activitySignal = option.on.activitySignal;
			}
		}

		this.taskContext.set(taskId, context);
		this.taskContext.injectPoints.push({
			taskId: taskId,
			injectAt: injectAt
		});
		console.log(`[vue-injector] Task "${taskId}" registered`);
		return {
			id: taskId,
			keepAlive: () => this.keepAlive(taskId),
			stopAlive: () => this.stopAlive(taskId)
		};
	}

	public keepAlive(id: string): void {
		const context = this.taskContext.get(id);
		if (!context) {
			console.error(`[vue-injector] Task "${id}" not found`);
			return;
		}

		// keepAlive only applies to component tasks
		if (!context.component || !context.componentInjectAt) {
			console.warn(
				`[vue-injector] keepAlive is not applicable to non-component task "${id}"`
			);
			return;
		}

		// Already alive with an active observer, skip
		if (context.alive && context.isObserver) {
			console.warn(`[vue-injector] Task "${id}" already has an active alive observer`);
			return;
		}

		const aliveEpoch = (context.aliveEpoch ?? 0) + 1;
		context.aliveEpoch = aliveEpoch;
		context.alive = true;
		context.isObserver = false;
		// placeholder stop handler for pending async setup
		context.stopAlive = () => {};

		// Case 1: Component is already mounted and connected — set up the alive observer directly
		if (context.app && context.appRoot?.isConnected) {
			const matchedElement = context.appRoot.parentElement;
			if (!matchedElement) {
				console.warn(
					`[vue-injector] Task "${id}": host element not found, unable to activate alive observer`
				);
				return;
			}

			const currentDocument = matchedElement.ownerDocument || document;
			const injectAt = context.componentInjectAt;

			nextTick().then(() => {
				if (!context.alive || context.aliveEpoch !== aliveEpoch) return;

				const stopHandler = this.domWatcher.onDomAlive(
					matchedElement,
					injectAt,
					() => {
						this.taskContext.resetState(id);
					},
					(el): void => this.handleInjectionReady(el, id),
					context.scope === 'global' ? currentDocument : matchedElement,
					{
						once: true,
						timeout: this.injectConfig.timeout
					}
				);

				if (!context.alive || context.aliveEpoch !== aliveEpoch) {
					stopHandler();
					return;
				}
				context.stopAlive = stopHandler;
				context.isObserver = true;
				console.log(`[vue-injector] Task "${id}" alive observer activated`);
			});
			return;
		}

		// Case 2: Component is not mounted (e.g., removed from DOM after stopAlive was called)
		// Re-trigger onDomReady to wait for the target element and re-inject
		if (!context.app) {
			let cancelled = false;
			const stopReadyObserver = this.domWatcher.onDomReady(
				context.componentInjectAt,
				(el): void => {
					if (cancelled || !context.alive || context.aliveEpoch !== aliveEpoch) return;
					this.handleInjectionReady(el, id);
				},
				document,
				{ once: true, timeout: this.injectConfig.timeout }
			);
			context.stopAlive = () => {
				if (cancelled) return;
				cancelled = true;
				stopReadyObserver();
			};
			context.isObserver = true;
			console.log(`[vue-injector] Task "${id}" awaiting target element for re-injection`);
		}
	}

	public stopAlive(id: string): void {
		const context = this.taskContext.get(id);

		if (!context) {
			console.error(`[vue-injector] Task "${id}" not found`);
			return;
		}

		// status check: if not set alive mode or no stopAlive handler, warn and exit
		if (!context.alive) {
			console.warn(`[vue-injector] Task "${id}" has no active alive observer to stop`);
			return;
		}

		context.aliveEpoch = (context.aliveEpoch ?? 0) + 1;
		const stopHandler = context.stopAlive;
		context.alive = false;
		context.isObserver = false;
		context.stopAlive = undefined;
		stopHandler?.();
	}

	public setPinia(pinia: Pinia): void {
		this.taskContext.setPinia(pinia);
	}

	public destroyed(id: string): void {
		const context: InjectionContext | undefined = this.taskContext.get(id);
		if (context?.alive) {
			this.stopAlive(id);
		}
		this.taskContext.destroy(id);
	}

	public destroyedAll(): void {
		for (const id of this.taskContext.keys()) {
			const context: InjectionContext | undefined = this.taskContext.get(id);
			if (context?.alive) {
				this.stopAlive(id);
			}
		}
		this.taskContext.destroyedAll();
	}

	public bindActivitySignal(id: string, source: WatchSource<boolean>): void {
		// Bind a reactive signal to control automatic listener attach/detach for this task
		const context: InjectionContext | undefined = this.taskContext.get(id);
		if (!context) {
			console.error(`[vue-injector] Task "${id}" not found, unable to bind activity signal`);
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

		if (context.watcher) {
			context.watcher();
		}

		context.watcher = unWatch;
		context.watchSource = source;
	}

	public listenerActivity(id: string, event: ActionEvent): void {
		const context: InjectionContext | undefined = this.taskContext.get(id);
		if (!context) {
			console.error(`[vue-injector] Task "${id}" not found, unable to manage listener state`);
			return;
		}

		// Check if event binding is configured
		if (!context.withEvent || !context.listenAt || !context.event || !context.callback) {
			console.warn(`[vue-injector] Task "${id}" has no event binding configured`);
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
						`[vue-injector] Failed to attach event "${context.event}" for task "${id}"`
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
				console.log(`[vue-injector] Event "${context.event}" detached from task "${id}"`);
				break;
			}

			default: {
				console.warn(`[vue-injector] Unknown action type "${event.type}" for task "${id}"`);
			}
		}
	}

	private handleInjectionReady(targetElement: HTMLElement, id: string): void {
		const context = this.taskContext.get(id);
		if (!context) {
			console.error(
				`[vue-injector] Task "${id}" not found, unable to proceed with injection`
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
		const name: string = this.getComponentName(component);
		return name ? `${name}@${selector}` : `component-${selector}`;
	}

	private getComponentName(component: Component): string {
		// biome-ignore lint: false positive
		const name: string = component?.name || (component as any)?.__name;
		if (name) return name;

		if (typeof component === 'string') {
			return component;
		}

		if (typeof component === 'object' || typeof component === 'function') {
			const cacheKey: object = component as unknown as object;
			const cachedName: string | undefined = this.anonymousComponentNames.get(cacheKey);
			if (cachedName) return cachedName;

			const generatedName: string = `component-${UUID()}`;
			this.anonymousComponentNames.set(cacheKey, generatedName);
			return generatedName;
		}

		return 'component-anonymous';
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
			console.log(`[vue-injector] Event "${event}" attached at "${listenAt}" (task: ${id})`);
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
					`[vue-injector] Event "${event}" attached at "${listenAt}" (task: ${id})`
				);
			},
			document,
			{ once: true, timeout: this.injectConfig.timeout }
		);

		return proxyController;
	}

	// Inject component into the matched DOM element
	private injectComponent(matchedElement: HTMLElement, taskId: string): boolean {
		const context: InjectionContext | undefined = this.taskContext.get(taskId);
		if (!context || !context.componentInjectAt) {
			console.error(`[vue-injector] Task "${taskId}" context missing, injection aborted`);
			return false;
		}

		if (context?.app) {
			console.warn(`[vue-injector] Task "${taskId}" is already mounted, skipping`);
			return false;
		}

		const injectAt: string = context.componentInjectAt;
		const pinia: Pinia = this.taskContext.getPinia() as Pinia;

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
			subApp.use(pinia);
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

					const stopHandler = this.domWatcher.onDomAlive(
						matchedElement,
						injectAt,
						() => {
							this.taskContext.resetState(taskId);
						},
						(el): void => this.handleInjectionReady(el, taskId),
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
					context.stopAlive = stopHandler;
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

	private markRawComponent(component: Component): Component {
		return import.meta.env.PROD ? markRaw(component) : component;
	}
}
