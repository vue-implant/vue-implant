import type { Plugin } from 'vue';
import type { Task, TaskErrorMessage, TaskRecord } from '../type';

/**
 * Central runtime registry for all injection tasks.
 *
 * This context stores task instances, task records, and transient runtime state
 * (watchers, listeners, component roots, and Pinia instance). It also provides
 * unified teardown utilities for single-task and full-context cleanup to avoid
 * memory leaks from unreleased DOM nodes, listeners, and reactive watchers.
 */
export class TaskContext {
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

	/**
	 * Shared Pinia plugin instance used by injected apps.
	 */
	private pinia: Plugin | null = null;

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
	public get(key: string): Task | undefined {
		return this.contextMap.get(key);
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

	/**
	 * Gets the stored Pinia instance.
	 *
	 * @returns Pinia plugin instance or `null` when unset.
	 */
	public getPinia(): Plugin | null {
		return this.pinia;
	}

	/**
	 * Sets the Pinia instance used by injected apps.
	 *
	 * If an instance already exists, it will be overwritten.
	 *
	 * @param piniaInstance Pinia plugin instance.
	 */
	public setPinia<T extends Plugin>(piniaInstance: T): void {
		if (this.pinia) {
			console.warn('[vue-injector] Pinia instance already set, overwriting');
		}
		this.pinia = piniaInstance;
	}

	public getTaskStatus(id: string): 'idle' | 'pending' | 'active' | undefined {
		const task: Task | undefined = this.contextMap.get(id);
		return task ? task.taskStatus : undefined;
	}

	public setTaskStatus(id: string, status: 'idle' | 'pending' | 'active'): void {
		const task: Task | undefined = this.contextMap.get(id);
		if (task) {
			task.taskStatus = status;
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
			console.warn(`[vue-injector] Task "${id}" not found, may already be destroyed`);
			return;
		}
		context.taskStatus = 'idle';

		// Remove the corresponding task record from the injection point list
		this.taskRecords = this.taskRecords.filter((record) => record.taskId !== id);

		// Remove the corresponding task record from the error list
		this.taskErrorMessages = this.taskErrorMessages.filter((error) => error.taskId !== id);

		// Stop watcher
		this.releaseWatcher(id);

		// Stop event listener
		this.releaseListener(id);

		// Unmount the app first, then remove the host element
		if (context.componentName) {
			this.releaseComponentInstance(id);
			this.releaseDomElement(id);
		}

		// Finally delete the task context
		this.contextMap.delete(id);
	}

	/**
	 * Destroys all registered tasks and resets shared runtime state.
	 */
	public destroyedAll(): void {
		const ids: string[] = Array.from(this.contextMap.keys());

		// Phase 1: Stop all watchers first to prevent reactive callbacks during cleanup
		for (const id of ids) {
			this.releaseWatcher(id);
		}

		// Phase 2: Release event listeners and component instances
		for (const id of ids) {
			this.releaseListener(id);

			if (this.contextMap.get(id)?.componentName) {
				this.releaseComponentInstance(id);
				this.releaseDomElement(id);
			}
		}

		// Clear all data
		this.contextMap.clear();
		this.taskRecords = [];
		this.taskErrorMessages = [];

		this.pinia = null;

		console.log('[vue-injector] All tasks destroyed');
	}

	/**
	 * Unmounts and clears the Vue app instance of a task.
	 *
	 * @param id Unique task id.
	 */
	public releaseComponentInstance(id: string): void {
		const context: Task | undefined = this.contextMap.get(id);
		if (context?.app) {
			try {
				context.app.unmount();
				context.app = undefined;
				context.instance = undefined;
			} catch (error) {
				console.error(
					`[vue-injector] Failed to unmount component for task "${id}":`,
					error
				);
			}
		} else {
			console.warn(`[vue-injector] Component for task "${id}" already unmounted`);
		}
	}

	/**
	 * Removes and clears the task root DOM element.
	 *
	 * @param id Unique task id.
	 */
	public releaseDomElement(id: string): void {
		const context: Task | undefined = this.contextMap.get(id);
		if (!context) {
			console.warn(
				`[vue-injector] Task "${id}" context not found, unable to remove root element`
			);
			return;
		}
		if (!context.appRoot) {
			console.warn(
				`[vue-injector] Root element for task "${id}" not found, may already be removed`
			);
			return;
		}
		try {
			context.appRoot.remove();
			context.appRoot = undefined;
		} catch (error) {
			console.error(`[vue-injector] Failed to remove root element for task "${id}":`, error);
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

		if (context.controller) {
			try {
				context.controller.abort();
			} catch (error) {
				console.error(`[vue-injector] Failed to abort listener for task "${id}":`, error);
			}
		}

		context.controller = undefined;
		context.listenerName = undefined;
		context.listenAt = undefined;
		context.event = undefined;
		context.callback = undefined;
		context.withEvent = false;
		context.activitySignal = undefined;
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
				context.watcher();
				context.watcher = undefined;
				context.watchSource = undefined;
			} catch (error) {
				console.error(`[vue-injector] Failed to stop watcher for task "${id}":`, error);
			}
		}
	}

	/**
	 * Resets one task to an initial reusable state while keeping its map entry.
	 *
	 * @param id Unique task id.
	 */
	public resetState(id: string): void {
		const context = this.contextMap.get(id);
		if (!context) return;

		// unmount the subapp instance, to prevent memory leaks
		if (context.app) {
			context.app.unmount();
		}

		context.taskStatus = 'idle';

		// reset context of id to initial state
		// but keep the record in contextMap for future reuse
		context.app = undefined;
		context.instance = undefined;

		context.appRoot?.remove();
		context.appRoot = undefined;

		context.isObserver = false;

		if (context.watcher) {
			context.watcher();
			context.watcher = undefined;
			context.watchSource = undefined;
		}

		//reset task listener
		if (context.controller) {
			context.controller.abort();
			context.controller = undefined;
		}
	}

	public resetAll(): void {
		for (const id of this.contextMap.keys()) {
			this.resetState(id);
		}
	}
}
