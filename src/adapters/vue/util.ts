import type { VueComponent } from './type';

export function isVueComponent(artifact: unknown): artifact is VueComponent {
	const isCandidate =
		(typeof artifact === 'object' && artifact !== null) || typeof artifact === 'function';

	return (
		isCandidate &&
		('setup' in artifact ||
			'render' in artifact ||
			'template' in artifact ||
			'__vccOpts' in artifact ||
			'__asyncLoader' in artifact)
	);
}
