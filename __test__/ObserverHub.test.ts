import { describe, expect, it, vi } from 'vitest';
import { ObserverHub } from '../src/core/hooks/ObservabilityHook/ObserverHub';
import type { ObserveEvent } from '../src/core/hooks/ObservabilityHook/type';

const makeEvent = (name: ObserveEvent['name']): ObserveEvent => ({
	name,
	ts: Date.now(),
	taskId: 'task-1',
	status: 'idle'
});

describe('ObserverHub', () => {
	it('should trigger event-specific hooks', () => {
		const hub = new ObserverHub();
		const hook = vi.fn();
		hub.on('run:start', hook);

		const event = makeEvent('run:start');
		hub.emit(event);

		expect(hook).toHaveBeenCalledOnce();
		expect(hook).toHaveBeenCalledWith(event);
	});

	it('should trigger onAny hooks for any event', () => {
		const hub = new ObserverHub();
		const hook = vi.fn();
		hub.onAny(hook);

		hub.emit(makeEvent('run:start'));
		hub.emit(makeEvent('inject:success'));

		expect(hook).toHaveBeenCalledTimes(2);
	});

	it('should support unsubscribe from on()', () => {
		const hub = new ObserverHub();
		const hook = vi.fn();
		const off = hub.on('inject:fail', hook);

		hub.emit(makeEvent('inject:fail'));
		off();
		hub.emit(makeEvent('inject:fail'));

		expect(hook).toHaveBeenCalledTimes(1);
	});

	it('should support unsubscribe from onAny()', () => {
		const hub = new ObserverHub();
		const hook = vi.fn();
		const off = hub.onAny(hook);

		hub.emit(makeEvent('target:ready'));
		off();
		hub.emit(makeEvent('target:ready'));

		expect(hook).toHaveBeenCalledTimes(1);
	});

	it('should remove specific event hooks with off(event)', () => {
		const hub = new ObserverHub();
		const runHook = vi.fn();
		const injectHook = vi.fn();

		hub.on('run:start', runHook);
		hub.on('inject:success', injectHook);
		hub.off('run:start');

		hub.emit(makeEvent('run:start'));
		hub.emit(makeEvent('inject:success'));

		expect(runHook).not.toHaveBeenCalled();
		expect(injectHook).toHaveBeenCalledOnce();
	});

	it('should clear all hooks', () => {
		const hub = new ObserverHub();
		const eventHook = vi.fn();
		const anyHook = vi.fn();

		hub.on('alive:enable', eventHook);
		hub.onAny(anyHook);
		hub.clear();

		hub.emit(makeEvent('alive:enable'));

		expect(eventHook).not.toHaveBeenCalled();
		expect(anyHook).not.toHaveBeenCalled();
	});

	it('should report hook existence with hasHooks()', () => {
		const hub = new ObserverHub();
		expect(hub.hasHooks()).toBe(false);
		expect(hub.hasHooks('inject:success')).toBe(false);

		hub.on('inject:success', () => {});
		expect(hub.hasHooks()).toBe(true);
		expect(hub.hasHooks('inject:success')).toBe(true);
		expect(hub.hasHooks('inject:fail')).toBe(false);
	});

	it('should consider onAny in hasHooks(event)', () => {
		const hub = new ObserverHub();
		hub.onAny(() => {});

		expect(hub.hasHooks('register:start')).toBe(true);
		expect(hub.hasHooks()).toBe(true);
	});

	it('should isolate hook errors and continue dispatch', () => {
		const logger = {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			debug: vi.fn()
		};
		const hub = new ObserverHub(logger);
		const badHook = vi.fn(() => {
			throw new Error('boom');
		});
		const goodHook = vi.fn();

		hub.on('run:start', badHook);
		hub.on('run:start', goodHook);

		hub.emit(makeEvent('run:start'));

		expect(badHook).toHaveBeenCalledOnce();
		expect(goodHook).toHaveBeenCalledOnce();
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining('Hook execution failed for event "run:start".')
		);
	});
});
