import { isVueComponent } from './util';
import type { VueMountAdapter } from './vue/type';
import { createVueAdapter } from './vue/VueAdapter';

export function adapter(artifact: unknown): VueMountAdapter | undefined {
	if (isVueComponent(artifact)) {
		return createVueAdapter();
	}
}
