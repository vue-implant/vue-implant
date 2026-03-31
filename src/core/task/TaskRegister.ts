import type { Component, Ref } from 'vue';
import type {
	_RegisterResult,
	ComponentOptions,
	ILogger,
	InjectionConfig,
	ListenerRegisterResult,
	Task
} from '../../type';
import { getComponentName } from '../../util/getComponentName';
import { markRawComponent } from '../../util/markRawComponent';
import { Logger } from '../logger/Logger';
import type { TaskContext } from './TaskContext';

export class TaskRegister {
	private readonly taskContext: TaskContext;
	private readonly injectConfig: InjectionConfig;
	private readonly logger: ILogger;

	constructor(taskContext: TaskContext, injectConfig: InjectionConfig, logger?: ILogger) {
		this.taskContext = taskContext;
		this.injectConfig = injectConfig;
		this.logger = logger ?? injectConfig.logger ?? new Logger();
	}

	private getTaskId(component: Component, selector: string): string {
		const name: string = getComponentName(component);
		return name ? `${name}@${selector}` : `component-${selector}`;
	}

	public registerListener(
		listenAt: string,
		event: string,
		callback: EventListener,
		activitySignal?: () => Ref<boolean>
	): ListenerRegisterResult {
		// Standalone method for registering event listeners without component injection
		const id: string = `listener-${listenAt}-${event}`;

		if (this.taskContext.has(id)) {
			this.logger.warn(`Listener "${id}" is already registered, skipping`);
			return {
				taskId: id,
				isSuccess: true
			};
		}

		const context: Task = {
			taskId: id,
			taskStatus: 'idle',
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
		this.taskContext.taskRecords.push({ taskId: id, injectAt: listenAt });
		this.logger.info(`Listener "${id}" registered`);
		return {
			taskId: id,
			isSuccess: true
		};
	}
	public register(
		injectAt: string,
		component: Component,
		option?: ComponentOptions
	): _RegisterResult {
		const taskId: string = this.getTaskId(component, injectAt);

		if (this.taskContext.has(taskId)) {
			// Component already registered, return directly
			this.logger.warn(`Task "${taskId}" is already registered, skipping`);
			return {
				taskId: taskId,
				isSuccess: true
			};
		}
		// Use unified Task to store all information
		const context: Task = {
			taskId,
			taskStatus: 'idle',
			componentName: getComponentName(component),
			componentInjectAt: injectAt,
			component: markRawComponent(component),
			withEvent: false,

			alive: option?.alive ?? this.injectConfig.alive,
			aliveEpoch: 0,
			scope: option?.scope ?? this.injectConfig.scope,
			timeout: option?.timeout ?? this.injectConfig.timeout,
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
		this.taskContext.taskRecords.push({
			taskId: taskId,
			injectAt: injectAt
		});
		this.logger.info(`Task "${taskId}" registered`);
		return {
			taskId: taskId,
			isSuccess: true
		};
	}
}
