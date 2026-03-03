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
			console.warn(
				'[Injector Warning] Pinia instance already exists, it will be overwritten'
			);
		}
		this.pinia = piniaInstance;
	}
	/**
	 * Destroy all resources of a single task (watcher → listener → component → dom → context)
	 */
	public destroy(id: string): void {
		const context: InjectionContext | undefined = this.contextMap.get(id);
		if (!context) {
			console.warn(
				`[Injector Warning] Task ${id} not found, it may have been destroyed or was never registered`
			);
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

		console.log('[Injector] All injection instances have been destroyed');
	}

	public releaseComponentInstance(id: string): void {
		const context: InjectionContext | undefined = this.contextMap.get(id);
		if (context?.app) {
			try {
				context.app.unmount();
				context.app = undefined;
				context.instance = undefined;
			} catch (error) {
				console.error(`[TaskContext Error] Failed to unmount component ${id}:`, error);
			}
		} else {
			console.warn(
				`[TaskContext Warning] Component instance ${id} not found, it may have been unmounted already`
			);
		}
	}

	public releaseDomElement(id: string): void {
		const context: InjectionContext | undefined = this.contextMap.get(id);
		if (!context) {
			console.warn(
				`[TaskContext Warning] Context not found for ${id}, unable to remove mount root element`
			);
			return;
		}
		if (!context.appRoot) {
			console.warn(
				`[TaskContext Warning] Mount root element not found for ${id}, please check if the component mount point exists`
			);
			return;
		}
		try {
			context.appRoot.remove();
			context.appRoot = undefined;
		} catch (error) {
			console.error(
				`[TaskContext Error] Failed to remove component root element ${id}:`,
				error
			);
		}
	}

	public releaseListener(id: string): void {
		const context = this.contextMap.get(id);
		if (!context) return;

		if (context.controller) {
			try {
				context.controller.abort();
			} catch (error) {
				console.error(`[TaskContext Error] Failed to abort event task ${id}:`, error);
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
				console.error(`[TaskContext Error] Failed to stop watcher ${id}:`, error);
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
