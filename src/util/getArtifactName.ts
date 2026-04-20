import { UUID } from './uuid';

const anonymousArtifactNames = new WeakMap<object, string>();

function resolveName(
	value: unknown,
	cache: WeakMap<object, string>,
	prefix: string,
	fallbackName: string
): string {
	// biome-ignore lint: false positive
	const name: string = (value as any)?.name || (value as any)?.__name;
	if (name) return name;

	if (typeof value === 'string') return value;

	if (typeof value === 'object' || typeof value === 'function') {
		const key = value as unknown as object;
		const cached = cache.get(key);
		if (cached) return cached;

		const generated = `${prefix}-${UUID()}`;
		cache.set(key, generated);
		return generated;
	}

	return fallbackName;
}

export function getArtifactName(artifact: unknown): string {
	return resolveName(artifact, anonymousArtifactNames, 'artifact', 'artifact-anonymous');
}
