import type { VueComponent } from './vue/type';

export function isVueComponent(artifact: unknown): artifact is VueComponent {
	return (
		typeof artifact === 'function' ||
		(typeof artifact === 'object' &&
			artifact !== null &&
			('setup' in artifact ||
				'render' in artifact ||
				'template' in artifact ||
				'__vccOpts' in artifact))
	);
}
