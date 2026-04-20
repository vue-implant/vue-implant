import type { ComponentPublicInstance, Plugin } from 'vue';
import { createApp } from 'vue';
import type { ILogger } from '../../logger/types';
import { isVueComponent } from '../util';
import type { VueMountAdapter } from './type';
import { VuePlugin } from './VuePlugin';

export function createVueAdapter(logger: ILogger): VueMountAdapter {
	VuePlugin.setLogger(logger);
	const adapter: VueMountAdapter = {
		name: 'vue',
		matches: isVueComponent,
		mount({ mountPoint, artifact }) {
			const app = createApp(artifact);
			const plugins = VuePlugin.getPlugins();
			for (const plugin of plugins) {
				app.use(plugin);
			}
			const instance = app.mount(mountPoint) as ComponentPublicInstance;
			return {
				handle: app,
				instance
			};
		},
		unmount({ handle }) {
			handle.unmount();
		},
		use<T extends Plugin>(plugin: T): void {
			const plugins = VuePlugin.getPlugins();
			if (plugins.includes(plugin)) {
				logger.warn('Plugin already registered, skipping duplicate');
				return;
			}

			VuePlugin.use(plugin);
		},
		usePlugins(...plugins: Plugin[]): void {
			for (const plugin of plugins) {
				VuePlugin.use(plugin);
			}
		},
		getPlugins(): Plugin[] {
			return VuePlugin.getPlugins();
		},
		setPinia<T extends Plugin>(piniaInstance: T): void {
			const pinia = VuePlugin.getPinia();
			const plugins = VuePlugin.getPlugins();
			if (pinia && pinia !== piniaInstance) {
				logger.warn('Pinia instance already set, overwriting');
				const piniaIndex = plugins.indexOf(pinia);
				if (piniaIndex !== -1) {
					plugins.splice(piniaIndex, 1);
				}
			}

			if (pinia === piniaInstance) {
				return;
			}

			VuePlugin.setPinia(piniaInstance);
			VuePlugin.use(piniaInstance);
		},
		getPinia(): Plugin | undefined {
			return VuePlugin.getPinia();
		},
		clear(): void {
			VuePlugin.clear();
		}
	};

	return adapter;
}
