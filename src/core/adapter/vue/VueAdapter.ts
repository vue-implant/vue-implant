import type { ComponentPublicInstance } from 'vue';
import { createApp } from 'vue';
import type { VueMountAdapter } from './type';
import { VuePlugin } from './VuePlugin';

export function createVueAdapter(): VueMountAdapter {
	return {
		name: 'vue',
		mount({ mountPoint, artifact }) {
			const app = createApp(artifact);
			const plugins = VuePlugin.getPlugins();
			for (const plugin of plugins ?? []) {
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
		}
	};
}
