import type { MountAdapter, ResolvableMountAdapter } from './types';

const adapters: ResolvableMountAdapter[] = [];
export function resolveAdapter(artifact: unknown): MountAdapter | undefined {
	const resolvedAdapter = adapters.find((adapter) => adapter.matches(artifact));
	return resolvedAdapter;
}

export function registerAdapter(adapter: ResolvableMountAdapter): void {
	if (adapters.includes(adapter)) return;
	adapters.push(adapter);
}
