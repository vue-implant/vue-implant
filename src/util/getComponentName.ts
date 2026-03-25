import type { Component } from 'vue';
import { UUID } from './uuid';

const anonymousComponentNames = new WeakMap<object, string>();

export function getComponentName(component: Component): string {
	// biome-ignore lint: false positive
	const name: string = component?.name || (component as any)?.__name;
	if (name) return name;

	if (typeof component === 'string') return component;

	if (typeof component === 'object' || typeof component === 'function') {
		const key = component as unknown as object;
		const cached = anonymousComponentNames.get(key);
		if (cached) return cached;

		const generated = `component-${UUID()}`;
		anonymousComponentNames.set(key, generated);
		return generated;
	}

	return 'component-anonymous';
}
