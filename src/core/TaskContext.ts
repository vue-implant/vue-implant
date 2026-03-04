import type { Pinia } from 'pinia';
import type { InjectionContext, InjectionErrorMessage, InjectionRecord } from '../type';

export class TaskContext {
	public injectionErrorMessages: Array<InjectionErrorMessage> = []; // TODO: retry mechanism
	public injectPoints: InjectionRecord[] = [];

	private readonly contextMap: Map<string, InjectionContext> = new Map();

	private pinia: Pinia | null = null;
	private isRunning: boolean = false;

	public set(key: string, context: InjectionContext): void {
		this.contextMap.set(key, context);
	}

	public get(key: string): InjectionContext | undefined {
		return this.contextMap.get(key);
	}

	public has(key: string): boolean {
		return this.contextMap.has(key);
	}

	public delete(key: string): boolean {
		return this.contextMap.delete(key);
	}

	public keys(): IterableIterator<string> {
		return this.contextMap.keys();
	}

	public clear(): void {
		this.contextMap.clear();
	}

	public getRunningFlag(): boolean {
		return this.isRunning;
	}

	public setRunningFlag(flag: boolean): void {
		this.isRunning = flag;
	}

	public getPinia(): Pinia | null {
		return this.pinia;
	}

	public setPinia(piniaInstance: Pinia): void {
		if (this.pinia) {
			console.warn('[vue-injector] Pinia instance already set, overwriting');
		}
		this.pinia = piniaInstance;
	}
	/**
	 * Destroy all resources of a single task (watcher → listener → component → dom → context)
	 */
	public destroy(id: string): void {
		const context: InjectionContext | undefined = this.contextMap.get(id);
		if (!context) {
			console.warn(`[vue-injector] Task "${id}" not found, may already be destroyed`);
			return;
		}

		// Remove the corresponding task record from the injection point list
		this.injectPoints = this.injectPoints.filter((record) => record.id !== id);

		// Remove the corresponding task record from the error list
		this.injectionErrorMessages = this.injectionErrorMessages.filter(
			(error) => error.id !== id
		);

		// Stop watcher
		this.releaseWatcher(id);

		// Stop event listener
		this.releaseListener(id);

		// Unmount the app first, then remove the host element
		if (context.componentName) {
			this.releaseComponentInstance(id);
			this.releaseDomElement(id);
		}
		// Finally delete the injection context
		this.contextMap.delete(id);
	}

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
		this.injectPoints = [];
		this.injectionErrorMessages = [];
		this.isRunning = false;
		this.pinia = null;

		console.log('[vue-injector] All tasks destroyed');
	}

	public releaseComponentInstance(id: string): void {
		const context: InjectionContext | undefined = this.contextMap.get(id);
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

	public releaseDomElement(id: string): void {
		const context: InjectionContext | undefined = this.contextMap.get(id);
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

	public resetState(id: string): void {
		const context = this.contextMap.get(id);
		if (!context) return;

		// unmount the subapp instance, to prevent memory leaks
		if (context.app) {
			context.app.unmount();
		}

		// reset context of id to initial state
		// but keep the record in contextMap for future reuse
		context.app = undefined;
		context.instance = undefined;
		context.appRoot = undefined;

		//reset task listener
		if (context.controller) {
			context.controller.abort();
			context.controller = undefined;
		}
	}
}
