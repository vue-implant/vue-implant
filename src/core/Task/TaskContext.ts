import type { ObserveEmitter } from '../hooks/type';
import { noopObserveEmitter } from '../hooks/util';
import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import { buildResourceObservePayload } from '../payload/buildResourceObservePayload';
import { buildTaskObservePayload } from '../payload/buildTaskObservePayload';
import type {
	ArtifactTask,
	ListenerTask,
	Task,
	TaskErrorMessage,
	TaskKind,
	TaskListenerFeature,
	TaskRecord,
	TaskStatus
} from './types';
import { getTaskInjectAt, getTaskListener, isArtifactTask } from './util';

/**
 * Central runtime registry for all injection tasks.
 *
 * This context stores task instances, task records, and transient runtime state
 * (watchers, listeners, component roots, and shared Vue plugins). It also provides
 * unified teardown utilities for single-task and full-context cleanup to avoid
 * memory leaks from unreleased DOM nodes, listeners, and reactive watchers.
 */
export class TaskContext {
	private readonly logger: ILogger;

	private readonly emit: ObserveEmitter;

	/**
	 * Stores failed task injection messages.
	 *
	 * Reserved for diagnostics and potential retry mechanisms.
	 */
	public taskErrorMessages: Array<TaskErrorMessage> = []; // TODO: retry mechanism
	/**
	 * Stores lightweight task metadata such as task id and injection location.
	 */
	public taskRecords: TaskRecord[] = [];

	/**
	 * Maps task id to its full runtime context.
	 */
	private readonly contextMap: Map<string, Task> = new Map();

	constructor(emit: ObserveEmitter = noopObserveEmitter, logger: ILogger = new Logger()) {
		this.logger = logger;
		this.emit = emit;
	}
	/**
	 * Registers or replaces a task context by id.
	 *
	 * @param key Unique task id.
	 * @param context Runtime task context object.
	 */
	public set(key: string, context: Task): void {
		this.contextMap.set(key, context);
	}

	/**
	 * Gets a task context by id.
	 *
	 * @param key Unique task id.
	 * @returns The task context if found, otherwise `undefined`.
	 */
	public get(key: string, kind: 'listener'): ListenerTask | undefined;
	public get(key: string, kind: 'component'): ArtifactTask | undefined;
	public get<T extends Task>(key: string): T | undefined;
	public get(key: string): Task | undefined;
	public get(key: string, kind?: TaskKind): Task | undefined {
		const task = this.contextMap.get(key);
		if (!task) return undefined;

		if (kind) {
			return task.kind === kind ? task : undefined;
		}

		return task;
	}

	/**
	 * Checks whether a task context exists.
	 *
	 * @param key Unique task id.
	 * @returns `true` when the task exists.
	 */
	public has(key: string): boolean {
		return this.contextMap.has(key);
	}

	/**
	 * Returns an iterator over all task ids.
	 *
	 * @returns Iterator of registered task ids.
	 */
	public keys(): IterableIterator<string> {
		return this.contextMap.keys();
	}

	public getTaskStatus(id: string): TaskStatus | undefined {
		const task: Task | undefined = this.contextMap.get(id);
		return task ? task.taskStatus : undefined;
	}

	public setTaskStatus(id: string, status: TaskStatus): void {
		const task: Task | undefined = this.contextMap.get(id);
		if (!task) {
			this.logger.warn(`Task "${id}" not found, may already be destroyed`);
			return;
		}
		if (task.taskStatus === status) {
			return;
		}
		const preStatus = task.taskStatus;
		task.taskStatus = status;
		const injectAt = getTaskInjectAt(task);

		this.emit(
			'task:statusChange',
			buildTaskObservePayload('task:statusChange', {
				taskId: id,
				kind: task.kind,
				injectAt,
				status,
				preStatus
			})
		);
		if (status === 'active') {
			this.emit(
				'task:active',
				buildTaskObservePayload('task:active', {
					taskId: id,
					kind: task.kind,
					injectAt,
					status: 'active',
					preStatus
				})
			);
		}
	}

	/**
	 * Destroys all resources of a single task.
	 *
	 * Cleanup order is: watcher -> listener -> component -> dom -> context.
	 *
	 * @param id Unique task id.
	 */
	public destroy(id: string): void {
		const context: Task | undefined = this.contextMap.get(id);
		if (!context) {
			this.logger.warn(`Task "${id}" not found, may already be destroyed`);
			return;
		}
		this.setTaskStatus(id, 'idle');

		// Remove the corresponding task record from the injection point list
		this.taskRecords = this.taskRecords.filter((record) => record.taskId !== id);

		// Remove the corresponding task record from the error list
		this.taskErrorMessages = this.taskErrorMessages.filter((error) => error.taskId !== id);

		// Stop watcher
		this.releaseWatcher(id);

		// Stop event listener
		this.releaseListener(id);

		// Unmount the app first, then remove the host element
		if (isArtifactTask(context)) {
			this.releaseComponentInstance(id);
			this.releaseDomElement(id);
		}

		// Finally delete the task context
		this.contextMap.delete(id);
	}

	/**
	 * Destroys all registered tasks and resets shared runtime state.
	 */
	public destroyAll(): void {
		const ids: string[] = Array.from(this.contextMap.keys());

		// Phase 1: Stop all watchers first to prevent reactive callbacks during cleanup
		for (const id of ids) {
			this.releaseWatcher(id);
		}

		// Phase 2: Release event listeners and component instances
		for (const id of ids) {
			this.releaseListener(id);

			const context = this.contextMap.get(id);
			if (context && isArtifactTask(context)) {
				this.releaseComponentInstance(id);
				this.releaseDomElement(id);
			}
		}

		// Clear all data
		this.contextMap.clear();
		this.taskRecords = [];
		this.taskErrorMessages = [];

		this.logger.info('All tasks destroyed');
	}

	/**
	 * Unmounts and clears the Vue app instance of a task.
	 *
	 * @param id Unique task id.
	 */
	public releaseComponentInstance(id: string): void {
		const context: Task | undefined = this.contextMap.get(id);
		if (context && isArtifactTask(context) && context.mountHandle && context.appRoot) {
			try {
				context.adapter.unmount({
					host: context.hostElement,
					mountPoint: context.appRoot,
					handle: context.mountHandle,
					taskId: id,
					injectAt: context.injectAt,
					reason: 'destroy'
				});
				context.mountHandle = undefined;
				context.instance = undefined;
				this.emit(
					'resource:componentUnmounted',
					buildResourceObservePayload('resource:componentUnmounted', {
						taskId: id,
						kind: 'component',
						injectAt: context.injectAt,
						status: context.taskStatus,
						componentName: context.artifactName
					})
				);
			} catch (error) {
				this.logger.error(`Failed to unmount component for task "${id}":`, error);
			}
		} else {
			this.logger.warn(`Component for task "${id}" already unmounted`);
		}
	}

	/**
	 * Removes and clears the task root DOM element.
	 *
	 * @param id Unique task id.
	 */
	public releaseDomElement(id: string): void {
		const context: Task | undefined = this.contextMap.get(id);
		if (!context || !isArtifactTask(context)) {
			this.logger.warn(`Task "${id}" context not found, unable to remove root element`);
			return;
		}
		if (!context.appRoot) {
			this.logger.warn(`Root element for task "${id}" not found, may already be removed`);
			return;
		}
		try {
			context.appRoot.remove();
			context.appRoot = undefined;
			context.hostElement = undefined;
		} catch (error) {
			this.logger.error(`Failed to remove root element for task "${id}":`, error);
		}
	}

	/**
	 * Aborts and clears listener-related runtime fields of a task.
	 *
	 * @param id Unique task id.
	 */
	public releaseListener(id: string): void {
		const context = this.contextMap.get(id);
		if (!context) return;
		const listener: TaskListenerFeature | undefined = getTaskListener(context);
		const listenerEvent: string | undefined =
			listener?.event ?? (isArtifactTask(context) ? context.listener?.event : context.event);
		const listenAt: string | undefined =
			listener?.listenAt ??
			(isArtifactTask(context) ? context.listener?.listenAt : context.listenAt);

		if (listener?.controller) {
			try {
				listener.controller.abort();
			} catch (error) {
				this.logger.error(`Failed to abort listener for task "${id}":`, error);
			}
		}

		if (listener) {
			listener.controller = undefined;
		}

		if (isArtifactTask(context)) {
			context.listener = undefined;
		}
		context.withEvent = false;
		this.emit(
			'resource:listenerReleased',
			buildResourceObservePayload('resource:listenerReleased', {
				taskId: id,
				kind: context.kind,
				injectAt: getTaskInjectAt(context),
				status: context.taskStatus,
				listenerEvent,
				listenAt
			})
		);
	}

	/**
	 * Stops and clears watcher-related runtime fields of a task.
	 *
	 * @param id Unique task id.
	 */
	public releaseWatcher(id: string): void {
		const context = this.contextMap.get(id);
		if (context?.watcher) {
			try {
				context.watcher.watcher();
				context.watcher = undefined;
				this.emit(
					'resource:watcherReleased',
					buildResourceObservePayload('resource:watcherReleased', {
						taskId: id,
						kind: context.kind,
						injectAt: getTaskInjectAt(context),
						status: context.taskStatus
					})
				);
			} catch (error) {
				this.logger.error(`Failed to stop watcher for task "${id}":`, error);
			}
		}
	}

	/**
	 * Resets one task to an initial reusable state while keeping its map entry.
	 *
	 * @param id Unique task id.
	 */
	public reset(id: string): void {
		const context = this.contextMap.get(id);
		if (!context) return;

		// unmount the subapp instance, to prevent memory leaks
		if (isArtifactTask(context) && context.mountHandle && context.appRoot) {
			context.adapter.unmount({
				host: context.hostElement,
				mountPoint: context.appRoot,
				handle: context.mountHandle,
				taskId: id,
				injectAt: context.injectAt,
				reason: 'reset'
			});
		}

		this.setTaskStatus(id, 'idle');

		// reset context of id to initial state
		// but keep the record in contextMap for future reuse
		if (isArtifactTask(context)) {
			context.mountHandle = undefined;
			context.instance = undefined;
			context.hostElement = undefined;

			context.appRoot?.remove();
			context.appRoot = undefined;

			context.isObserver = false;
		}

		if (context.watcher) {
			context.watcher.watcher();
			context.watcher = undefined;
		}

		//reset task listener
		const listener = getTaskListener(context);
		if (listener?.controller) {
			listener.controller.abort();
			listener.controller = undefined;
		}
	}

	public resetAll(): void {
		for (const id of this.contextMap.keys()) {
			this.reset(id);
		}
	}
}
