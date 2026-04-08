import type { Component, Ref } from 'vue';
import { getComponentName } from '../../util/getComponentName';
import { markRawComponent } from '../../util/markRawComponent';
import { createObserveEmitter } from '../hooks/ObservabilityHook/createObserveEmitter';
import type { ObserveEmitter } from '../hooks/ObservabilityHook/type';
import type { ComponentOptions, InjectionConfig } from '../Injector/types';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import type { TaskContext } from './TaskContext';
import type { _RegisterResult, ListenerRegisterResult, Task } from './types';

export class TaskRegister {
	private readonly taskContext: TaskContext;
	private readonly injectConfig: InjectionConfig;
	private readonly logger: ILogger;
	private readonly emit: ObserveEmitter;

	constructor(taskContext: TaskContext, injectConfig: InjectionConfig, logger?: ILogger) {
		this.taskContext = taskContext;
		this.injectConfig = injectConfig;
		this.logger = logger ?? injectConfig.logger ?? new Logger();
		this.emit = createObserveEmitter(this.injectConfig.observer);
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
		this.emit('register:start', {
			injectAt: listenAt,
			meta: {
				kind: 'listener',
				event
			}
		});
		// Standalone method for registering event listeners without component injection
		try {
			const id: string = `listener-${listenAt}-${event}`;

			if (this.taskContext.has(id)) {
				this.logger.warn(`Listener "${id}" is already registered, skipping`);
				this.emit('register:duplicate', {
					taskId: id,
					injectAt: listenAt,
					meta: {
						kind: 'listener'
					}
				});
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
			this.emit('register:success', {
				taskId: id,
				injectAt: listenAt,
				status: 'idle',
				meta: {
					kind: 'listener'
				}
			});

			return {
				taskId: id,
				isSuccess: true
			};
		} catch (error) {
			this.emit('register:error', {
				injectAt: listenAt,
				error,
				meta: {
					kind: 'listener',
					event
				}
			});
			throw error;
		}
	}
	public register(
		injectAt: string,
		component: Component,
		option?: ComponentOptions
	): _RegisterResult {
		this.emit('register:start', {
			injectAt,
			meta: {
				kind: 'component'
			}
		});

		try {
			const taskId: string = this.getTaskId(component, injectAt);

			if (this.taskContext.has(taskId)) {
				// Component already registered, return directly
				this.logger.warn(`Task "${taskId}" is already registered, skipping`);
				this.emit('register:duplicate', {
					taskId,
					injectAt,
					meta: {
						kind: 'component'
					}
				});
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

			this.emit('register:success', {
				taskId,
				injectAt,
				status: 'idle',
				meta: {
					kind: 'component'
				}
			});

			return {
				taskId: taskId,
				isSuccess: true
			};
		} catch (error) {
			this.emit('register:error', {
				injectAt,
				error,
				meta: {
					kind: 'component'
				}
			});
		}
	}
}
