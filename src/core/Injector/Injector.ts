import type { Component, Plugin, Ref, WatchSource } from 'vue';
import { createObserveEmitter } from '../hooks/ObservabilityHook/createObserveEmitter';
import { ObserverHub } from '../hooks/ObservabilityHook/ObserverHub';
import type { ObserveEmitter } from '../hooks/ObservabilityHook/type';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { TaskContext } from '../task/TaskContext';
import { TaskLifeCycle } from '../task/TaskLifeCycle';
import { TaskRegister } from '../task/TaskRegister';
import { TaskRunner } from '../task/TaskRunner';
import type { ListenerRegisterResult, RegisterResult } from '../task/types';
import type { ActionEvent, ComponentOptions, InjectionConfig } from './types';

export class Injector {
	// Unified task context containing all component-related data
	private readonly taskContext: TaskContext;
	private readonly taskRegister: TaskRegister;
	private readonly taskRunner: TaskRunner;
	private readonly taskLifeCycle: TaskLifeCycle;
	private readonly logger: ILogger;
	private readonly observer: ObserverHub;
	private readonly injectConfig: InjectionConfig = {
		alive: false,
		scope: 'local',
		timeout: 5000
	};

	constructor(config: Partial<InjectionConfig> = {}) {
		this.logger = config.logger ?? new Logger();
		this.observer = config.observer ?? new ObserverHub(this.logger);

		const emitObserve: ObserveEmitter = createObserveEmitter(this.observer);
		this.taskContext = new TaskContext(emitObserve, this.logger);

		this.injectConfig = {
			...this.injectConfig,
			...config,
			logger: this.logger,
			observer: this.observer
		};
		this.taskRegister = new TaskRegister(this.taskContext, this.injectConfig, this.logger);
		this.taskRunner = new TaskRunner(this.taskContext, this.injectConfig, this.logger);
		this.taskLifeCycle = new TaskLifeCycle(
			this.taskContext,
			(targetElement, taskId) => this.taskRunner.onTargetReady(targetElement, taskId),
			this.injectConfig,
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
		activitySignal?: () => Ref<boolean>
	): ListenerRegisterResult {
		return this.taskRegister.registerListener(listenAt, event, callback, activitySignal);
	}

	public register(
		injectAt: string,
		component: Component,
		option?: ComponentOptions
	): RegisterResult {
		const result = this.taskRegister.register(injectAt, component, option);
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

	public getContext(): TaskContext | undefined {
		return this.taskContext;
	}

	public getObserver(): ObserverHub {
		return this.observer;
	}

	public getLogger(): ILogger {
		return this.logger;
	}
	j;

	public use<T extends Plugin>(plugin: T): this {
		this.taskContext.use(plugin);
		return this;
	}

	public usePlugins(...plugins: Plugin[]): this {
		this.taskContext.usePlugins(...plugins);
		return this;
	}

	public getPlugins(): Plugin[] {
		return this.taskContext.getPlugins();
	}

	public setPinia<T extends Plugin>(pinia: T): void {
		this.taskContext.setPinia(pinia);
	}

	public getPinia(): Plugin | undefined {
		return this.taskContext.getPinia();
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
