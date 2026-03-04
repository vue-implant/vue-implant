import type { InjectCallback, ObserverOptions } from '../type';

export class DOMWatcher {
	/**
	 * Observe the DOM for elements matching the given selector
	 */
	public onDomReady(
		selector: string,
		callback: InjectCallback,
		root: Document | HTMLElement = document,
		options: ObserverOptions
	): void {
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
			if (isDisconnected) return; // Do not observe if already disconnected
			this.checkExistingElement(currentRoot, selector, wrappedCallback);
			if (isDisconnected) return; // In once mode, skip observer setup if element exists
			this.setupMutationObserver(currentRoot, selector, observers, wrappedCallback);
		};

		// Start the main flow
		startObserve(root);

		// Set timeout for auto-disconnect
		if (options?.timeout && !isDisconnected) {
			setTimeout(() => {
				disconnect();
				console.warn(
					`[vue-injector] Element "${selector}" not found within ${options.timeout}ms, observer disconnected`
				);
			}, options.timeout);
		}
	}
	/**
	 *  public api for observing dom is alive, which mean the target element may accident be removed,
	 *  so we need a method to observing the target element is removed and re-added,
	 *  then we can re-inject the component into the target element
	 */
	public onDomAlive(
		target: HTMLElement, //observer the target element's parent element
		selector: string, // the selector to find the target element when it is re-added
		onRemove: () => void, // this callback is clear the injected component instance and subapp
		onRestore: InjectCallback, // callback when the target element is re-added
		root: Document | HTMLElement = document,
		Options: ObserverOptions
	): () => void {
		let isObserver: boolean = true;
		this.setupRemovalObserver(
			target,
			() => {
				onRemove();
				if (!isObserver) return;
				this.onDomReady(
					selector,
					(newTarget) => {
						if (!isObserver) return;
						onRestore(newTarget);
					},
					document,
					Options
				);
			},
			root
		);
		return () => {
			isObserver = false;
			console.log(`[vue-injector] Alive observer for "${selector}" stopped`);
		};
	}

	/**
	 * Check if the target element already exists in the current scope
	 */
	private checkExistingElement(
		currentRoot: Document | HTMLElement,
		selector: string,
		callback: (el: HTMLElement, observer?: MutationObserver) => void
	): void {
		const searchRoot =
			currentRoot instanceof Document ? currentRoot : currentRoot.ownerDocument;
		const existing = searchRoot.querySelector(selector);

		if (existing) {
			callback(existing as HTMLElement, undefined);
		}
	}

	/**
	 * Set up a MutationObserver to watch for DOM changes
	 */
	private setupMutationObserver(
		root: Document | HTMLElement,
		selector: string,
		observers: MutationObserver[],
		callback: InjectCallback
	): void {
		const observer: MutationObserver = new MutationObserver((mutations, obs) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === 1) {
						this.handleAddedNode(node as Element, selector, obs, callback);
					}
				});
			}
		});

		const observeTarget: Element | null = this.getObserveTarget(root);
		if (observeTarget) {
			observer.observe(observeTarget, {
				childList: true,
				subtree: true
			});
			observers.push(observer);
		}
	}

	private setupRemovalObserver(
		target: HTMLElement,
		callback: (obs?: MutationObserver) => void,
		root: Document | HTMLElement
	): MutationObserver | null {
		const baseTarget: HTMLElement | HTMLBodyElement | null = this.getObserveTarget(root);
		const isDocument: boolean = baseTarget instanceof HTMLBodyElement;
		if (baseTarget === null) {
			console.error(
				`[vue-injector] Failed to set up removal observer: no valid observation target found`
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

		console.log(`[vue-injector] Removal observer started`, observerNode);
		return observer;
	}

	/**
	 * Handle newly added nodes
	 */
	private handleAddedNode(
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

	/**
	 * Get the observation target element
	 */
	private getObserveTarget(
		currentRoot: Document | HTMLElement
	): HTMLElement | HTMLBodyElement | null {
		return (currentRoot instanceof Document ? currentRoot.body : currentRoot) || document.body;
	}
}
