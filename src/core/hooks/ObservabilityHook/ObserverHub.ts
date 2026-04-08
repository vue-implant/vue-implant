import { Logger } from '../../logger/Logger';
import type { ILogger } from '../../logger/types';
import type { ObserveEvent, ObserveEventName, ObserveHook } from './type';

export class ObserverHub {
	private eventHooks: Map<ObserveEventName, Set<ObserveHook>> = new Map();

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
	}

	public hasHooks(event?: ObserveEventName): boolean {
		if (event) {
			const hooks = this.eventHooks.get(event);
			return Boolean(hooks && hooks.size > 0) || this.anyHooks.size > 0;
		}

		if (this.anyHooks.size > 0) return true;
		for (const hooks of this.eventHooks.values()) {
			if (hooks.size > 0) return true;
		}

		return false;
	}

	public emit(event: ObserveEvent): void {
		if (!this.hasHooks(event.name)) return;

		const scopedHooks = this.eventHooks.get(event.name);
		if (scopedHooks) {
			for (const hook of [...scopedHooks]) {
				this.callSafely(hook, event);
			}
		}

		for (const hook of [...this.anyHooks]) {
			this.callSafely(hook, event);
		}
	}

	private callSafely(hook: ObserveHook, event: ObserveEvent): void {
		try {
			hook(event);
		} catch (error) {
			this.logger.error(`Hook execution failed for event "${event.name}".`);
		}
	}
}
