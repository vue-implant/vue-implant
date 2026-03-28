import type { Component, Plugin, Ref, WatchSource } from 'vue';
import type {
	ActionEvent,
	ComponentOptions,
	InjectionConfig,
	ListenerRegisterResult,
	RegisterResult
} from '../type';
import { TaskContext } from './task/TaskContext';
import { TaskLifeCycle } from './task/TaskLifeCycle';
import { TaskRegister } from './task/TaskRegister';
import { TaskRunner } from './task/TaskRunner';

export class Injector {
	// Unified task context containing all component-related data
	private readonly taskContext: TaskContext;
	private readonly taskRegister: TaskRegister;
	private readonly taskRunner: TaskRunner;
	private readonly taskLifeCycle: TaskLifeCycle;
	private readonly injectConfig: InjectionConfig = {
		alive: false,
		scope: 'local',
		timeout: 5000
	};

	constructor(config: Partial<InjectionConfig> = {}) {
		this.taskContext = new TaskContext();
		this.injectConfig = { ...this.injectConfig, ...config };
		this.taskRegister = new TaskRegister(this.taskContext, this.injectConfig);
		this.taskRunner = new TaskRunner(this.taskContext, this.injectConfig);
		this.taskLifeCycle = new TaskLifeCycle(
			this.taskContext,
			(targetElement, taskId) => this.taskRunner.onTargetReady(targetElement, taskId),
			this.injectConfig
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
		this.taskContext.reset(taskId);
	}

	public resetAll(): void {
		this.taskContext.resetAll();
	}

	public destroy(taskId: string): void {
		this.taskContext.destroy(taskId);
	}

	public destroyAll(): void {
		this.taskContext.destroyAll();
	}
	// TODO: add config option to enable flush sync or pre
	public bindListenerSignal(taskId: string, source: WatchSource<boolean>): boolean {
		return this.taskRunner.bindListenerSignal(taskId, source);
	}

	public controlListener(taskId: string, event: ActionEvent): boolean {
		return this.taskRunner.controlListener(taskId, event);
	}
}
