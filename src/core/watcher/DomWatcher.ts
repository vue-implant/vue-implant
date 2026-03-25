import type { InjectCallback, ObserverOptions } from '../../type';

/**
 * Observe the DOM for elements matching the given selector.
 */
export function onDomReady(
	selector: string,
	callback: InjectCallback,
	root: Document | HTMLElement = document,
	options: ObserverOptions
): () => void {
	const observers: MutationObserver[] = [];
	let isDisconnected = false;

	const disconnect = () => {
		if (isDisconnected) return;
		isDisconnected = true;

		for (const obs of observers) {
			obs.disconnect();
		}
		observers.length = 0;
	};

	const wrappedCallback = (el: HTMLElement, observer?: MutationObserver) => {
		callback(el, observer);

		// In once mode, disconnect immediately after finding the element
		if (options?.once) {
			disconnect();
			console.log(`[vue-injector] Element "${selector}" found, observer disconnected`);
		}
	};

	const startObserve = (currentRoot: Document | HTMLElement) => {
		if (isDisconnected) return;
		checkExistingElement(currentRoot, selector, wrappedCallback);
		if (isDisconnected) return;
		setupMutationObserver(currentRoot, selector, observers, wrappedCallback);
	};

	startObserve(root);

	if (options?.timeout) {
		setTimeout(() => {
			if (isDisconnected) return;
			disconnect();
			console.warn(
				`[vue-injector] Element "${selector}" not found within ${options.timeout}ms, observer disconnected`
			);
		}, options.timeout);
	}

	return disconnect;
}

/**
 * Observe target removal and re-appearance to support re-injection.
 */
export function onDomAlive(
	target: HTMLElement,
	selector: string,
	onRemove: () => void,
	onRestore: InjectCallback,
	root: Document | HTMLElement = document,
	options: ObserverOptions
): () => void {
	let isObserver: boolean = true;
	let stopReadyObserver: (() => void) | undefined;

	const removalObserver = setupRemovalObserver(
		target,
		() => {
			onRemove();
			if (!isObserver) return;
			stopReadyObserver = onDomReady(
				selector,
				(newTarget) => {
					if (!isObserver) return;
					onRestore(newTarget);
				},
				document,
				options
			);
		},
		root
	);

	return () => {
		if (!isObserver) return;
		isObserver = false;
		removalObserver?.disconnect();
		stopReadyObserver?.();
		console.log(`[vue-injector] Alive observer for "${selector}" stopped`);
	};
}

export const DOMWatcher = {
	onDomReady,
	onDomAlive
};

function checkExistingElement(
	currentRoot: Document | HTMLElement,
	selector: string,
	callback: (el: HTMLElement, observer?: MutationObserver) => void
): void {
	const searchRoot = currentRoot instanceof Document ? currentRoot : currentRoot.ownerDocument;
	const existing = searchRoot.querySelector(selector);

	if (existing) {
		callback(existing as HTMLElement, undefined);
	}
}

function setupMutationObserver(
	root: Document | HTMLElement,
	selector: string,
	observers: MutationObserver[],
	callback: InjectCallback
): void {
	const observer: MutationObserver = new MutationObserver((mutations, obs) => {
		for (const mutation of mutations) {
			mutation.addedNodes.forEach((node) => {
				if (node.nodeType === 1) {
					handleAddedNode(node as Element, selector, obs, callback);
				}
			});
		}
	});

	const observeTarget: Element | null = getObserveTarget(root);
	if (observeTarget) {
		observer.observe(observeTarget, {
			childList: true,
			subtree: true
		});
		observers.push(observer);
	}
}

function setupRemovalObserver(
	target: HTMLElement,
	callback: (obs?: MutationObserver) => void,
	root: Document | HTMLElement
): MutationObserver | null {
	const baseTarget: HTMLElement | HTMLBodyElement | null = getObserveTarget(root);
	const isDocument: boolean = baseTarget instanceof HTMLBodyElement;
	if (baseTarget === null) {
		console.error(
			'[vue-injector] Failed to set up removal observer: no valid observation target found'
		);
		return null;
	}

	if (!isDocument && !baseTarget.isConnected) {
		console.error(
			'[vue-injector] Failed to set up removal observer: observation target is detached from DOM'
		);
		return null;
	}

	const observerNode: HTMLElement | null = !isDocument
		? baseTarget.parentElement || baseTarget
		: baseTarget;

	if (!observerNode) {
		callback();
		return null;
	}

	const observer = new MutationObserver((mutations, obs) => {
		for (const mutation of mutations) {
			mutation.removedNodes.forEach((node) => {
				if (node === target) {
					callback(obs);
					obs.disconnect();
				}
			});
		}
	});

	observer.observe(observerNode, {
		childList: true,
		subtree: !!isDocument
	});

	console.log('[vue-injector] Removal observer started', observerNode);
	return observer;
}

function handleAddedNode(
	node: Element,
	selector: string,
	observer: MutationObserver,
	callback: InjectCallback
): void {
	const target = node.matches(selector) ? node : node.querySelector(selector);
	if (target) {
		callback(target as HTMLElement, observer);
	}
}

function getObserveTarget(
	currentRoot: Document | HTMLElement
): HTMLElement | HTMLBodyElement | null {
	return (currentRoot instanceof Document ? currentRoot.body : currentRoot) || document.body;
}
