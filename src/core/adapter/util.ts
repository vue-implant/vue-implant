import type { VueComponent } from './vue/type';

export function isVueComponent(artifact: unknown): artifact is VueComponent {
	const isObjectLikeArtifact = typeof artifact === 'object' && artifact !== null;

	return (
		typeof artifact === 'function' ||
		(isObjectLikeArtifact &&
			('setup' in artifact ||
				'render' in artifact ||
				'template' in artifact ||
				'__vccOpts' in artifact))
	);
}
