import type { App, Component, ComponentPublicInstance, Plugin } from 'vue';
import type { MountAdapter } from '../types';

export type VueMountHandle = App<Element>;
export type VueMountArtifact = Component;
export type VueMountInstance = ComponentPublicInstance;

export type VueMountAdapter = MountAdapter<VueMountArtifact, VueMountHandle, VueMountInstance>;

export type CreateVueAdapterOptions = {
	getPlugins?: () => Plugin[];
};
export type VueComponent = {
	setup?: () => void;
	render?: () => void;
	template?: string;
	__vccOpts?: unknown;
};
