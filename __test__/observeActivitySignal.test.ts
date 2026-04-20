import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import {
	createActivityStore,
	observeActivitySignal,
	stopActivitySignal
} from '../src/core/signal/observeActivitySignal';

describe('observeActivitySignal', () => {
	it('should observe protocol stores via get and subscribe', () => {
		const store = createActivityStore(false);
		const listener = vi.fn();

		const unsubscribe = observeActivitySignal(store, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenNthCalledWith(1, false);

		store.set(true);
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenNthCalledWith(2, true);

		stopActivitySignal(unsubscribe);
		store.set(false);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('should read the current value before subscribing to protocol stores', () => {
		const listener = vi.fn();
		const source = {
			get: () => true,
			subscribe: vi.fn(() => () => { })
		};

		const unsubscribe = observeActivitySignal(source, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(true);
		expect(source.subscribe).toHaveBeenCalledWith(listener);
		expect(typeof unsubscribe).toBe('function');
	});

	it('should wrap ref-like sources into the built-in signal protocol', async () => {
		const source = ref(false);
		const listener = vi.fn();

		const unsubscribe = observeActivitySignal(source, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenNthCalledWith(1, false);

		source.value = true;
		await nextTick();

		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener).toHaveBeenNthCalledWith(2, true);

		stopActivitySignal(unsubscribe);
	});
});
