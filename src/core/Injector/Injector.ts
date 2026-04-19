import type { Plugin, WatchSource } from 'vue';
import { VuePlugin } from '../adapter/vue/VuePlugin';
import { ObserverHub } from '../hooks/ObserverHub';
import type { ObserveEmitter, ObserveEventName, ObserveHook } from '../hooks/type';
import { createObserveEmitter, registerHooks } from '../hooks/util';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { TaskContext } from '../Task/TaskContext';
import { TaskLifeCycle } from '../Task/TaskLifeCycle';
import { TaskRegister } from '../Task/TaskRegister';
import { TaskRunner } from '../Task/TaskRunner';
import type {
	_RegisterResult,
	ListenerRegisterResult,
	RegisterResult,
	TaskActivitySignal
} from '../Task/types';
import type { ActionEvent, ArtifactOptions, InjectionConfig } from './types';

export class Injector {
	// Unified task context containing all component-related data
	private readonly taskContext: TaskContext;
	private readonly taskRegister: TaskRegister;
	private readonly taskRunner: TaskRunner;
	private readonly taskLifeCycle: TaskLifeCycle;
	private readonly logger: ILogger;
	private readonly observer: ObserverHub;
	private readonly vuePlugin: typeof VuePlugin;
	//default configuration
	private readonly injectConfig: InjectionConfig = {
		alive: false,
		scope: 'local',
		timeout: 5000,
		logger: new Logger()
	};

	constructor(config: Partial<InjectionConfig> = {}) {
		this.logger = config.logger ?? this.injectConfig.logger;
		this.observer = config.observer ?? new ObserverHub(this.logger);
		this.vuePlugin = VuePlugin;
		this.vuePlugin.setLogger(this.logger);

		const emitObserve: ObserveEmitter = createObserveEmitter(this.observer);

		this.injectConfig = {
			...this.injectConfig,
			...config,
			logger: this.logger,
			observer: this.observer
		};
		//register global hooks
		registerHooks(this.observer, config.hooks);

		this.taskContext = new TaskContext(emitObserve, this.logger);

		this.taskRegister = new TaskRegister(
			this.taskContext,
			this.injectConfig,
			emitObserve,
			this.logger
		);

		this.taskRunner = new TaskRunner(
			this.taskContext,
			this.injectConfig,
			emitObserve,
			this.logger
		);

		this.taskLifeCycle = new TaskLifeCycle(
			this.taskContext,
			(targetElement, taskId) => this.taskRunner.onTargetReady(targetElement, taskId),
			this.injectConfig,
			emitObserve,
			this.logger
		);
	}

	public run(): void {
		this.taskRunner.run();
	}

	public registerListener(
		listenAt: string,
		event: string,
		callback: EventListener,
		activitySignal?: TaskActivitySignal
	): ListenerRegisterResult {
		return this.taskRegister.registerListener(listenAt, event, callback, activitySignal);
	}

	public register<TArtifact>(
		injectAt: string,
		artifact: TArtifact,
		option?: ArtifactOptions
	): RegisterResult {
		const result = this.taskRegister.register(injectAt, artifact, option);
		return this.wrapRegisterResult(result);
	}

	private wrapRegisterResult(result: _RegisterResult): RegisterResult {
		return {
			enableAlive: () => this.taskLifeCycle.enableAlive(result.taskId),
			disableAlive: () => this.taskLifeCycle.disableAlive(result.taskId),
			...result
		};
	}

	public enableAlive(taskId: string): void {
		this.taskLifeCycle.enableAlive(taskId);
	}

	public disableAlive(taskId: string): void {
		this.taskLifeCycle.disableAlive(taskId);
	}
	/**
	 * @internal
	 * Obtain the original execution context of the task.
	 * * @warning
	 * This API is an internal implementation, extremely unstable, and subject to frequent changes due to refactoring.
	 * Direct manipulation of the context may bypass the framework's state management and lead to memory leaks or race conditions.
	 */
	public getContext(): TaskContext | undefined {
		return this.taskContext;
	}

	public getObserver(): ObserverHub {
		return this.observer;
	}

	public on(event: ObserveEventName, hook: ObserveHook): () => void {
		return this.observer.on(event, hook);
	}

	public onTask(taskId: string, event: ObserveEventName, hook: ObserveHook): () => void {
		return this.observer.onTask(taskId, event, hook);
	}

	public onAny(hook: ObserveHook): () => void {
		return this.observer.onAny(hook);
	}

	public off(event: ObserveEventName, hook?: ObserveHook): void {
		this.observer.off(event, hook);
	}

	public offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void {
		this.observer.offTask(taskId, event, hook);
	}

	public offAny(hook: ObserveHook): void {
		this.observer.offAny(hook);
	}

	public getLogger(): ILogger {
		return this.logger;
	}

	public use<T extends Plugin>(plugin: T): this {
		this.vuePlugin.use(plugin);
		return this;
	}

	public usePlugins(...plugins: Plugin[]): this {
		this.vuePlugin.usePlugins(...plugins);
		return this;
	}

	public getPlugins(): Plugin[] {
		return this.vuePlugin.getPlugins();
	}

	public setPinia<T extends Plugin>(pinia: T): void {
		this.vuePlugin.setPinia(pinia);
	}

	public getPinia(): Plugin | undefined {
		return this.vuePlugin.getPinia();
	}

	public reset(taskId: string): void {
		this.taskLifeCycle.reset(taskId);
	}

	public resetAll(): void {
		this.taskLifeCycle.resetAll();
	}

	public destroy(taskId: string): void {
		this.taskLifeCycle.destroy(taskId);
	}

	public destroyAll(): void {
		this.taskLifeCycle.destroyAll();
	}
	// TODO: add config option to enable flush sync or pre
	public bindListenerSignal(taskId: string, source: WatchSource<boolean>): boolean {
		return this.taskRunner.bindListenerSignal(taskId, source);
	}

	public controlListener(taskId: string, event: ActionEvent): boolean {
		return this.taskRunner.controlListener(taskId, event);
	}
}
