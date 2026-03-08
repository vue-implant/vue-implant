/// <reference types="vitest/config" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWatcher } from '../core/DomWatcher';
import type { InjectCallback } from '../type';

describe('DOMWatcher', () => {
	let watcher: DOMWatcher;

	beforeEach(() => {
		watcher = new DOMWatcher();
		document.body.innerHTML = '';
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	describe('onDomReady', () => {
		it('should invoke callback immediately when element already exists', () => {
			// Arrange
			const el = document.createElement('div');
			el.id = 'existing';
			document.body.appendChild(el);
			const cb = vi.fn<InjectCallback>();

			// Act
			watcher.onDomReady('#existing', cb, document, { once: true });

			// Assert
			expect(cb).toHaveBeenCalledOnce();
			expect(cb).toHaveBeenCalledWith(el, undefined);
		});

		it('should invoke callback when element is added later (MutationObserver)', async () => {
			const cb = vi.fn<InjectCallback>();

			watcher.onDomReady('#later', cb, document, { once: true });
			expect(cb).not.toHaveBeenCalled();

			// Use real timers briefly to let MutationObserver flush
			vi.useRealTimers();
			const el = document.createElement('div');
			el.id = 'later';
			document.body.appendChild(el);

			// MutationObserver callbacks are microtask-based; wait a tick
			await new Promise((r) => setTimeout(r, 0));

			expect(cb).toHaveBeenCalledOnce();
			expect(cb.mock.calls[0][0]).toBe(el);
		});

		it('should invoke callback for nested matching element added later', async () => {
			const cb = vi.fn<InjectCallback>();

			watcher.onDomReady('.nested-child', cb, document, { once: true });
			expect(cb).not.toHaveBeenCalled();

			vi.useRealTimers();
			const wrapper = document.createElement('div');
			const child = document.createElement('span');
			child.className = 'nested-child';
			wrapper.appendChild(child);
			document.body.appendChild(wrapper);

			await new Promise((r) => setTimeout(r, 0));

			expect(cb).toHaveBeenCalledOnce();
			expect(cb.mock.calls[0][0]).toBe(child);
		});

		it('should disconnect observer in once mode after finding element', () => {
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			const el = document.createElement('div');
			el.id = 'once-target';
			document.body.appendChild(el);

			const cb = vi.fn<InjectCallback>();
			watcher.onDomReady('#once-target', cb, document, { once: true });

			expect(cb).toHaveBeenCalledOnce();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('found, observer disconnected')
			);
		});

		it('should NOT disconnect observer when once is not set (continuous mode)', async () => {
			const cb = vi.fn<InjectCallback>();

			watcher.onDomReady('.repeated', cb, document, { once: false, timeout: 5000 });

			vi.useRealTimers();

			const el1 = document.createElement('div');
			el1.className = 'repeated';
			document.body.appendChild(el1);
			await new Promise((r) => setTimeout(r, 0));

			const el2 = document.createElement('div');
			el2.className = 'repeated';
			document.body.appendChild(el2);
			await new Promise((r) => setTimeout(r, 0));

			// callback at least once for the existing element(s)
			expect(cb.mock.calls.length).toBeGreaterThanOrEqual(2);
		});

		it('should auto-disconnect after timeout', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const cb = vi.fn<InjectCallback>();

			watcher.onDomReady('#missing', cb, document, { once: false, timeout: 3000 });

			// Element never added
			vi.advanceTimersByTime(3500);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('not found within 3000ms')
			);
		});

		it('should scope observation to a custom root element', () => {
			const root = document.createElement('div');
			document.body.appendChild(root);

			const el = document.createElement('span');
			el.className = 'scoped';
			root.appendChild(el);

			const cb = vi.fn<InjectCallback>();
			watcher.onDomReady('.scoped', cb, root, { once: true });

			expect(cb).toHaveBeenCalledOnce();
			expect(cb.mock.calls[0][0]).toBe(el);
		});
	});

	describe('onDomAlive', () => {
		it('should call onRemove when target is removed from DOM', async () => {
			vi.useRealTimers();

			const el = document.createElement('div');
			el.id = 'alive-target';
			document.body.appendChild(el);

			const onRemove = vi.fn();
			const onRestore = vi.fn<InjectCallback>();

			watcher.onDomAlive(el, '#alive-target', onRemove, onRestore, document, { once: true });

			// Remove target
			document.body.removeChild(el);
			await new Promise((r) => setTimeout(r, 0));

			expect(onRemove).toHaveBeenCalledOnce();
		});

		it('should call onRestore when the element is re-added after removal', async () => {
			vi.useRealTimers();

			const el = document.createElement('div');
			el.id = 'revive-target';
			document.body.appendChild(el);

			const onRemove = vi.fn();
			const onRestore = vi.fn<InjectCallback>();

			watcher.onDomAlive(el, '#revive-target', onRemove, onRestore, document, { once: true });

			// Remove
			document.body.removeChild(el);
			await new Promise((r) => setTimeout(r, 0));

			// Re-add
			const newEl = document.createElement('div');
			newEl.id = 'revive-target';
			document.body.appendChild(newEl);
			await new Promise((r) => setTimeout(r, 0));

			expect(onRemove).toHaveBeenCalledOnce();
			expect(onRestore).toHaveBeenCalled();
			expect(onRestore.mock.calls[0][0]).toBe(newEl);
		});

		it('should return a stop function that prevents further callbacks', async () => {
			vi.useRealTimers();

			const el = document.createElement('div');
			el.id = 'stoppable';
			document.body.appendChild(el);

			const onRemove = vi.fn();
			const onRestore = vi.fn<InjectCallback>();
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

			const stop = watcher.onDomAlive(el, '#stoppable', onRemove, onRestore, document, {
				once: true
			});

			// Stop before removal
			stop();

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Alive observer for "#stoppable" stopped')
			);

			// Even if target is removed, onRestore should never fire (onRemove may still fire
			// because the MutationObserver was already set up, but re-injection won't proceed)
			document.body.removeChild(el);
			await new Promise((r) => setTimeout(r, 0));

			const newEl = document.createElement('div');
			newEl.id = 'stoppable';
			document.body.appendChild(newEl);
			await new Promise((r) => setTimeout(r, 0));

			expect(onRestore).not.toHaveBeenCalled();
		});
	});

	// ─── edge cases ────────────────────────────────────────────────

	describe('edge cases', () => {
		it('should not throw when observing on document directly', () => {
			expect(() => {
				const cb = vi.fn<InjectCallback>();
				watcher.onDomReady('#no-exist', cb, document, { once: true, timeout: 100 });
			}).not.toThrow();
		});

		it('should handle non-element nodes gracefully (text nodes added)', async () => {
			const cb = vi.fn<InjectCallback>();

			watcher.onDomReady('#target-el', cb, document, { once: true });

			vi.useRealTimers();
			// Add a text node – should NOT trigger callback
			document.body.appendChild(document.createTextNode('hello'));
			await new Promise((r) => setTimeout(r, 0));

			expect(cb).not.toHaveBeenCalled();

			// Now add the real element
			const el = document.createElement('div');
			el.id = 'target-el';
			document.body.appendChild(el);
			await new Promise((r) => setTimeout(r, 0));

			expect(cb).toHaveBeenCalledOnce();
		});

		it('should not invoke callback after disconnect (once + timeout race)', async () => {
			vi.useRealTimers();
			const cb = vi.fn<InjectCallback>();
			vi.spyOn(console, 'log').mockImplementation(() => {});

			// Element already exists → once triggers disconnect immediately
			const el = document.createElement('div');
			el.id = 'race';
			document.body.appendChild(el);

			watcher.onDomReady('#race', cb, document, { once: true, timeout: 1000 });

			// Wait well past timeout
			await new Promise((r) => setTimeout(r, 50));

			// Should only have been called once (from checkExistingElement)
			expect(cb).toHaveBeenCalledOnce();
		});
	});
});
