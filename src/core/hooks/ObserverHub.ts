import { Logger } from '../logger/Logger';
import type { ILogger } from '../logger/types';
import type { ObserveEvent, ObserveEventName, ObserveHook } from './type';

export class ObserverHub {
	private eventHooks: Map<ObserveEventName, Set<ObserveHook>> = new Map();

	private taskHooks: Map<string, Map<ObserveEventName, Set<ObserveHook>>> = new Map();

	private anyHooks: Set<ObserveHook> = new Set();

	private logger: ILogger;

	constructor(logger: ILogger = new Logger()) {
		this.logger = logger;
	}

	public on(event: ObserveEventName, hook: ObserveHook): () => void {
		if (!this.eventHooks.has(event)) {
			this.eventHooks.set(event, new Set());
		}
		this.eventHooks.get(event)?.add(hook);

		return () => {
			this.off(event, hook);
		};
	}

	public onTask(taskId: string, event: ObserveEventName, hook: ObserveHook): () => void {
		if (!this.taskHooks.has(taskId)) {
			this.taskHooks.set(taskId, new Map());
		}

		const hookMap = this.taskHooks.get(taskId);
		if (!hookMap?.has(event)) {
			hookMap?.set(event, new Set());
		}

		hookMap?.get(event)?.add(hook);

		return () => {
			this.offTask(taskId, event, hook);
		};
	}

	public offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void {
		const hookMap = this.taskHooks.get(taskId);
		if (!hookMap) return;

		if (!event) {
			this.taskHooks.delete(taskId);
			return;
		}

		if (!hook) {
			hookMap.delete(event);
			if (hookMap.size === 0) {
				this.taskHooks.delete(taskId);
			}
			return;
		}

		const hooks = hookMap.get(event);
		if (!hooks) return;

		hooks.delete(hook);
		if (hooks.size === 0) {
			hookMap.delete(event);
		}

		if (hookMap.size === 0) {
			this.taskHooks.delete(taskId);
		}
	}

	public onAny(hook: ObserveHook): () => void {
		this.anyHooks.add(hook);

		return () => {
			this.offAny(hook);
		};
	}

	public off(event: ObserveEventName, hook?: ObserveHook): void {
		if (hook) {
			const hooks = this.eventHooks.get(event);
			if (!hooks) return;
			hooks.delete(hook);
			if (hooks.size === 0) {
				this.eventHooks.delete(event);
			}
		} else {
			this.eventHooks.delete(event);
		}
	}

	public offAny(hook: ObserveHook): void {
		this.anyHooks.delete(hook);
	}

	public clear(): void {
		this.eventHooks.clear();
		this.anyHooks.clear();
		this.taskHooks.clear();
	}

	public hasHooks(event?: ObserveEventName): boolean {
		if (event) {
			const hooks = this.eventHooks.get(event);
			if (hooks && hooks.size > 0) return true;
			if (this.anyHooks.size > 0) return true;

			for (const hookMap of this.taskHooks.values()) {
				const taskHooks = hookMap.get(event);
				if (taskHooks && taskHooks.size > 0) {
					return true;
				}
			}

			return false;
		}

		if (this.anyHooks.size > 0) return true;
		for (const hooks of this.eventHooks.values()) {
			if (hooks.size > 0) return true;
		}

		for (const hookMap of this.taskHooks.values()) {
			for (const hooks of hookMap.values()) {
				if (hooks.size > 0) return true;
			}
		}

		return false;
	}

	public emit(event: ObserveEvent): void {
		// task hook? -> event hook -> any hook
		if (event.taskId) {
			this.emitOnTask(event.taskId, event);
			return;
		}
		this.dispatchHooks(this.eventHooks.get(event.name), event);
		this.dispatchHooks(this.anyHooks, event);
	}

	public emitOnTask(taskId: string, event: ObserveEvent): void {
		const normalized = event.taskId === taskId ? event : { ...event, taskId };

		const taskScoped = this.taskHooks.get(taskId)?.get(normalized.name);
		const scoped = this.eventHooks.get(normalized.name);
		const hasTaskScopedHooks = Boolean(taskScoped && taskScoped.size > 0);
		const hasScopedHooks = Boolean(scoped && scoped.size > 0);

		if (!hasTaskScopedHooks && !hasScopedHooks && this.anyHooks.size === 0) return;

		this.dispatchHooks(taskScoped, normalized);
		this.dispatchHooks(scoped, normalized);
		this.dispatchHooks(this.anyHooks, normalized);
	}

	private dispatchHooks(hooks: Set<ObserveHook> | undefined, event: ObserveEvent): void {
		if (!hooks || hooks.size === 0) return;
		for (const hook of [...hooks]) {
			this.callSafely(hook, event);
		}
	}

	private callSafely(hook: ObserveHook, event: ObserveEvent): void {
		try {
			hook(event);
		} catch (error) {
			this.logger.error(`Hook execution failed for event "${event.name}".`, error);
		}
	}
}
