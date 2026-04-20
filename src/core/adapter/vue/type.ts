import type { App, Component, ComponentPublicInstance, Plugin } from 'vue';
import type { ResolvableMountAdapter } from '../types';

export type VueMountHandle = App<Element>;
export type VueMountArtifact = Component;
export type VueMountInstance = ComponentPublicInstance;

export type VueMountAdapter = ResolvableMountAdapter<
	VueMountArtifact,
	VueMountHandle,
	VueMountInstance
> & {
	use<T extends Plugin>(plugin: T): void;
	usePlugins(...plugins: Plugin[]): void;
	getPlugins(): Plugin[];
	setPinia<T extends Plugin>(piniaInstance: T): void;
	getPinia(): Plugin | undefined;
	clear(): void;
};

export type VueComponent = {
	setup?: () => void;
	render?: () => void;
	template?: string;
	__vccOpts?: unknown;
};
