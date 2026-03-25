import type { Component } from 'vue';
import { markRaw } from 'vue';

export function markRawComponent(component: Component): Component {
	return import.meta.env.PROD ? markRaw(component) : component;
}
