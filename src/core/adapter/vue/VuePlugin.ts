import type { Plugin } from 'vue';
import { Logger } from '../../logger/Logger';
import type { ILogger } from '../../logger/types';

class _VuePlugin {
	private plugins: Plugin[] = [];
	private pinia: Plugin | undefined = undefined;
	private logger: ILogger = new Logger();

	public setLogger(logger: ILogger): void {
		this.logger = logger;
	}

	public getPlugins(): Plugin[] {
		return [...this.plugins];
	}

	public use<T extends Plugin>(plugin: T): void {
		if (this.plugins.includes(plugin)) {
			this.logger.warn('Plugin already registered, skipping duplicate');
			return;
		}

		this.plugins.push(plugin);
	}

	public usePlugins(...plugins: Plugin[]): void {
		for (const plugin of plugins) {
			this.use(plugin);
		}
	}

	public getPinia(): Plugin | undefined {
		return this.pinia;
	}

	public setPinia<T extends Plugin>(piniaInstance: T): void {
		if (this.pinia && this.pinia !== piniaInstance) {
			this.logger.warn('Pinia instance already set, overwriting');
			this.plugins = this.plugins.filter((plugin) => plugin !== this.pinia);
		}

		if (this.pinia === piniaInstance) {
			return;
		}

		this.pinia = piniaInstance;
		this.use(piniaInstance);
	}

	public clear(): void {
		this.plugins = [];
		this.pinia = undefined;
	}
}

export const VuePlugin = new _VuePlugin();
