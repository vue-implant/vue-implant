import { getArtifactName } from '../../util/getArtifactName';
import { resolveAdapter } from '../adapter/Adapter';
import type { ObserveEmitter } from '../hooks/type';
import { registerHooks } from '../hooks/util';
import type { ArtifactOptions, InjectionConfig } from '../Injector/types';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { buildRegisterObservePayload } from '../payload/buildRegisterObservePayload';
import type { TaskContext } from './TaskContext';
import type {
	_RegisterResult,
	ArtifactTask,
	ListenerRegisterResult,
	Task,
	TaskActivitySignal,
	TaskListenerFeature
} from './types';

export class TaskRegister {
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

	private getTaskId(artifactName: string, selector: string): string {
		return artifactName ? `${artifactName}@${selector}` : `artifact-${selector}`;
	}

	public registerListener(
		listenAt: string,
		event: string,
		callback: EventListener,
		activitySignal?: TaskActivitySignal
	): ListenerRegisterResult {
		const id: string = `listener-${listenAt}-${event}`;
		this.emit(
			'register:start',
			buildRegisterObservePayload('register:start', {
				taskId: id,
				kind: 'listener',
				injectAt: listenAt,
				status: 'idle',
				listenerEvent: event,
				listenAt,
				withEvent: true
			})
		);
		// Standalone method for registering event listeners without component injection
		try {
			if (this.taskContext.has(id)) {
				this.logger.warn(`Listener "${id}" is already registered, skipping`);
				this.emit(
					'register:duplicate',
					buildRegisterObservePayload('register:duplicate', {
						taskId: id,
						kind: 'listener',
						injectAt: listenAt,
						status: this.taskContext.getTaskStatus(id) ?? 'idle',
						listenerEvent: event
					})
				);
				return {
					taskId: id,
					isSuccess: true
				};
			}

			const context: Task = {
				taskId: id,
				kind: 'listener',
				taskStatus: 'idle',
				timeout: this.injectConfig.timeout,
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
			this.emit(
				'register:success',
				buildRegisterObservePayload('register:success', {
					taskId: id,
					kind: 'listener',
					injectAt: listenAt,
					status: 'idle',
					listenerEvent: event,
					listenAt,
					withEvent: true
				})
			);

			return {
				taskId: id,
				isSuccess: true
			};
		} catch (error) {
			this.emit(
				'register:error',
				buildRegisterObservePayload('register:error', {
					taskId: id,
					kind: 'listener',
					injectAt: listenAt,
					status: this.taskContext.getTaskStatus(id) ?? 'idle',
					error,
					listenerEvent: event
				})
			);
			return {
				taskId: id,
				isSuccess: false
			};
		}
	}

	public register<TArtifact>(
		injectAt: string,
		artifact: TArtifact,
		option?: ArtifactOptions
	): _RegisterResult {
		const artifactName = getArtifactName(artifact);
		const taskId: string = this.getTaskId(artifactName, injectAt);
		const withEvent = Boolean(option?.on);
		const listenerEvent = option?.on?.type;
		const listenAt = option?.on?.listenAt;
		const alive = option?.alive ?? this.injectConfig.alive;
		const scope = option?.scope ?? this.injectConfig.scope;
		const timeout = option?.timeout ?? this.injectConfig.timeout;
		const mountAdapter = resolveAdapter(artifact);
		if (!mountAdapter) {
			throw new Error(`No adapter found for artifact: ${artifactName}`);
		}

		this.emit(
			'register:start',
			buildRegisterObservePayload('register:start', {
				taskId,
				kind: 'component',
				injectAt,
				status: 'idle',
				componentName: artifactName,
				listenerEvent,
				listenAt,
				alive,
				scope,
				timeout,
				withEvent
			})
		);

		try {
			if (this.taskContext.has(taskId)) {
				this.logger.warn(`Task "${taskId}" is already registered, skipping`);
				this.emit(
					'register:duplicate',
					buildRegisterObservePayload('register:duplicate', {
						taskId,
						kind: 'component',
						injectAt,
						status: this.taskContext.getTaskStatus(taskId) ?? 'idle',
						componentName: artifactName
					})
				);
				return {
					taskId,
					isSuccess: true
				};
			}

			const context: ArtifactTask<TArtifact> = {
				taskId,
				taskStatus: 'idle',
				kind: 'component',
				artifactName,
				injectAt,
				artifact,
				adapter: mountAdapter,
				withEvent: false,
				alive,
				scope,
				timeout,
				isObserver: false,
				hooks: option?.hooks
			};

			if (option?.on) {
				const listener: TaskListenerFeature = {
					listenAt: option.on.listenAt,
					event: option.on.type,
					callback: option.on.callback
				};
				context.withEvent = true;

				if (option.on.activitySignal) {
					listener.activitySignal = option.on.activitySignal;
				}

				context.listener = listener;
			}

			if (this.injectConfig.observer && option?.hooks) {
				registerHooks(this.injectConfig.observer, option.hooks, taskId);
			}

			this.taskContext.set(taskId, context as Task);
			this.taskContext.taskRecords.push({
				taskId,
				injectAt
			});

			this.logger.info(`Task "${taskId}" registered`);

			this.emit(
				'register:success',
				buildRegisterObservePayload('register:success', {
					taskId,
					kind: 'component',
					injectAt,
					status: 'idle',
					componentName: artifactName,
					listenerEvent,
					listenAt,
					alive,
					scope,
					timeout,
					withEvent
				})
			);

			return {
				taskId,
				isSuccess: true
			};
		} catch (error) {
			this.emit(
				'register:error',
				buildRegisterObservePayload('register:error', {
					taskId,
					kind: 'component',
					injectAt,
					status: this.taskContext.getTaskStatus(taskId) ?? 'idle',
					error,
					componentName: artifactName
				})
			);
			return {
				taskId,
				isSuccess: false
			};
		}
	}
}
