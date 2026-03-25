import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { TaskContext } from '../src/core/task/TaskContext';
import { TaskLifeCycle } from '../src/core/task/TaskLifeCycle';
import { DOMWatcher } from '../src/core/watcher/DomWatcher';
import type { Task } from '../src/type';

describe('TaskLifeCycle', () => {
	let taskContext: TaskContext;
	let onTargetReady: ReturnType<
		typeof vi.fn<(targetElement: HTMLElement, taskId: string) => void>
	>;
	let lifeCycle: TaskLifeCycle;

	beforeEach(() => {
		taskContext = new TaskContext();
		onTargetReady = vi.fn<(targetElement: HTMLElement, taskId: string) => void>();
		lifeCycle = new TaskLifeCycle(taskContext, onTargetReady, {
			alive: false,
			scope: 'local',
			timeout: 5000
		});
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('should warn for non-existent task on enableAlive', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		lifeCycle.enableAlive('missing');
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Task "missing" not found'));
	});

	it('should warn for listener-only task on enableAlive', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set('listener-task', {
			taskId: 'listener-task',
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});

		lifeCycle.enableAlive('listener-task');
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('enableAlive is not applicable to non-component task')
		);
	});

	it('should warn when already observing on enableAlive', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set('already-alive', {
			taskId: 'already-alive',
			componentName: 'Comp',
			componentInjectAt: '#app',
			component: { name: 'Comp' },
			alive: true,
			isObserver: true
		});

		lifeCycle.enableAlive('already-alive');
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('already has an active alive observer')
		);
	});

	it('should start onDomAlive in enableAlive case 1 (mounted and connected)', async () => {
		const host = document.createElement('div');
		host.id = 'mounted-host';
		document.body.appendChild(host);

		const appRoot = document.createElement('div');
		host.appendChild(appRoot);

		taskContext.set('mounted-task', {
			taskId: 'mounted-task',
			componentName: 'MountedComp',
			componentInjectAt: '#mounted-host',
			component: { name: 'MountedComp' },
			app: { unmount: vi.fn() } as unknown as Task['app'],
			appRoot,
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const stopHandler = vi.fn();
		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);

		lifeCycle.enableAlive('mounted-task');
		await nextTick();

		expect(aliveSpy).toHaveBeenCalledOnce();
		expect(taskContext.get('mounted-task')?.disableAlive).toBe(stopHandler);
		expect(taskContext.get('mounted-task')?.isObserver).toBe(true);
	});

	it('should call reset and onTargetReady from onDomAlive callbacks in case 1', async () => {
		const host = document.createElement('div');
		host.id = 'mounted-host-callback';
		document.body.appendChild(host);

		const appRoot = document.createElement('div');
		host.appendChild(appRoot);

		taskContext.set('mounted-callback-task', {
			taskId: 'mounted-callback-task',
			componentName: 'MountedCallbackComp',
			componentInjectAt: '#mounted-host-callback',
			component: { name: 'MountedCallbackComp' },
			app: { unmount: vi.fn() } as unknown as Task['app'],
			appRoot,
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const resetSpy = vi.spyOn(taskContext, 'reset');
		const aliveSpy = vi
			.spyOn(DOMWatcher, 'onDomAlive')
			.mockImplementation((_matchedElement, _injectAt, onRemove, onRestore) => {
				onRemove();
				onRestore(document.createElement('div'));
				return () => {};
			});

		lifeCycle.enableAlive('mounted-callback-task');
		await nextTick();

		expect(aliveSpy).toHaveBeenCalledOnce();
		expect(resetSpy).toHaveBeenCalledWith('mounted-callback-task');
		expect(onTargetReady).toHaveBeenCalledWith(
			expect.any(HTMLElement),
			'mounted-callback-task'
		);
	});

	it('should warn and return when appRoot is connected but parentElement is missing', () => {
		const host = document.createElement('div');
		host.id = 'shadow-host';
		document.body.appendChild(host);

		const shadow = host.attachShadow({ mode: 'open' });
		const appRoot = document.createElement('div');
		shadow.appendChild(appRoot);

		taskContext.set('shadow-task', {
			taskId: 'shadow-task',
			componentName: 'ShadowComp',
			componentInjectAt: '#shadow-host',
			component: { name: 'ShadowComp' },
			app: { unmount: vi.fn() } as unknown as Task['app'],
			appRoot,
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});

		lifeCycle.enableAlive('shadow-task');

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('host element not found, unable to activate alive observer')
		);
		expect(aliveSpy).not.toHaveBeenCalled();
		expect(taskContext.get('shadow-task')?.isObserver).toBe(false);
	});

	it('should abort setup and call the returned stopHandler if alive was cancelled during nextTick', async () => {
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(vi.fn());
		const appRoot = document.createElement('div');
		appRoot.id = 'app';
		document.body.appendChild(appRoot);

		taskContext.set('alive-task', {
			taskId: 'alive-task',
			alive: true,
			appRoot: appRoot,
			componentName: 'AliveComp',
			componentInjectAt: '#app',
			component: { name: 'AliveComp' },
			app: { unmount: vi.fn() } as unknown as Task['app'],
			aliveEpoch: 0,
			scope: 'local'
		});

		// Cancel alive synchronously before nextTick fires,
		// simulating "alive was cancelled during nextTick"
		lifeCycle.enableAlive('alive-task');
		lifeCycle.disableAlive('alive-task');

		await nextTick();

		// The first guard (!context.alive) in the nextTick callback should
		// short-circuit immediately, so onDomAlive must never be called
		expect(onDomAliveSpy).not.toHaveBeenCalled();
		expect(taskContext.get('alive-task')?.isObserver).toBe(false);
	});

	it('should abort setup if aliveEpoch changed during nextTick (stale epoch guard)', async () => {
		const appRoot = document.createElement('div');
		appRoot.id = 'app';
		document.body.appendChild(appRoot);

		taskContext.set('alive-task', {
			taskId: 'alive-task',
			alive: true,
			appRoot: appRoot,
			componentName: 'AliveComp',
			componentInjectAt: '#app',
			component: { name: 'AliveComp' },
			app: { unmount: vi.fn() } as unknown as Task['app'],
			aliveEpoch: 0,
			scope: 'local'
		});

		const fakeStopHandler = vi.fn();
		// Simulate epoch changing after onDomAlive returns but before the second guard check.
		// Mutating epoch directly avoids recursive enableAlive scheduling.
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(() => {
			const ctx = taskContext.get('alive-task');
			if (ctx?.aliveEpoch) {
				ctx.aliveEpoch += 1;
			}
			return fakeStopHandler;
		});

		lifeCycle.enableAlive('alive-task');
		await nextTick();

		// The second guard inside the nextTick callback detects a stale epoch and
		// must call the returned stopHandler to clean up the observer
		expect(fakeStopHandler).toHaveBeenCalledOnce();
		// isObserver must remain false because the stale setup was aborted
		expect(taskContext.get('alive-task')?.isObserver).toBe(false);
	});

	it('should reset and then onDomReady in enableAlive case 2 (disconnected appRoot)', () => {
		const host = document.createElement('div');
		host.id = 'detached-host';
		document.body.appendChild(host);
		host.remove();

		const appRoot = document.createElement('div');
		taskContext.set('detached-task', {
			taskId: 'detached-task',
			componentName: 'DetachedComp',
			componentInjectAt: '#detached-host',
			component: { name: 'DetachedComp' },
			app: { unmount: vi.fn() } as unknown as Task['app'],
			appRoot,
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const resetSpy = vi.spyOn(taskContext, 'reset');
		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		lifeCycle.enableAlive('detached-task');

		expect(resetSpy).toHaveBeenCalledWith('detached-task');
		expect(readySpy).toHaveBeenCalled();
		expect(taskContext.get('detached-task')?.isObserver).toBe(true);
	});

	it('should wait and forward to onTargetReady in enableAlive case 3 (app undefined)', () => {
		taskContext.set('case3-task', {
			taskId: 'case3-task',
			componentName: 'Case3Comp',
			componentInjectAt: '#app',
			component: { name: 'Case3Comp' },
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_, cb) => {
			const el = document.createElement('div');
			cb(el);
			return () => {};
		});

		lifeCycle.enableAlive('case3-task');

		expect(readySpy).toHaveBeenCalledOnce();
		expect(onTargetReady).toHaveBeenCalledOnce();
		expect(taskContext.get('case3-task')?.isObserver).toBe(true);
	});

	it('should warn and skip onTargetReady when case 3 callback fires after cancellation', () => {
		taskContext.set('case3-cancelled-task', {
			taskId: 'case3-cancelled-task',
			componentName: 'Case3CancelledComp',
			componentInjectAt: '#app',
			component: { name: 'Case3CancelledComp' },
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		let readyCallback: ((el: HTMLElement) => void) | undefined;
		vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_selector, cb) => {
			readyCallback = cb;
			return () => {};
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		lifeCycle.enableAlive('case3-cancelled-task');
		taskContext.get('case3-cancelled-task')?.disableAlive?.();
		readyCallback?.(document.createElement('div'));

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('alive epoch changed before element appears')
		);
		expect(onTargetReady).not.toHaveBeenCalled();
	});

	it('should warn and skip onTargetReady when case 3 callback sees stale aliveEpoch', () => {
		taskContext.set('case3-stale-task', {
			taskId: 'case3-stale-task',
			componentName: 'Case3StaleComp',
			componentInjectAt: '#app',
			component: { name: 'Case3StaleComp' },
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		let readyCallback: ((el: HTMLElement) => void) | undefined;
		vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_selector, cb) => {
			readyCallback = cb;
			return () => {};
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		lifeCycle.enableAlive('case3-stale-task');
		const context = taskContext.get('case3-stale-task');
		if (context?.aliveEpoch) {
			context.aliveEpoch += 1;
		}
		readyCallback?.(document.createElement('div'));

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('alive epoch changed before element appears')
		);
		expect(onTargetReady).not.toHaveBeenCalled();
	});

	it('should stop ready observer in enableAlive case 3 cancel path', () => {
		const stopReadyObserver = vi.fn();
		vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(stopReadyObserver);

		taskContext.set('cancel-task', {
			taskId: 'cancel-task',
			componentName: 'CancelComp',
			componentInjectAt: '#cancel',
			component: { name: 'CancelComp' },
			alive: false,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		lifeCycle.enableAlive('cancel-task');
		const disable = taskContext.get('cancel-task')?.disableAlive;
		disable?.();

		expect(stopReadyObserver).toHaveBeenCalledOnce();
	});

	it('should clear observer state and call stop handler on disableAlive', () => {
		const stop = vi.fn();
		taskContext.set('disable-task', {
			taskId: 'disable-task',
			componentName: 'DisableComp',
			componentInjectAt: '#app',
			component: { name: 'DisableComp' },
			alive: true,
			isObserver: true,
			aliveEpoch: 2,
			disableAlive: stop
		});

		lifeCycle.disableAlive('disable-task');
		const context = taskContext.get('disable-task');

		expect(stop).toHaveBeenCalledOnce();
		expect(context?.alive).toBe(false);
		expect(context?.isObserver).toBe(false);
		expect(context?.disableAlive).toBeUndefined();
		expect(context?.aliveEpoch).toBe(3);
	});

	it('should warn when disableAlive task is missing', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		lifeCycle.disableAlive('missing-disable-task');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Task "missing-disable-task" not found')
		);
	});

	it('should warn when disableAlive is called for task with alive=false', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set('not-alive-task', {
			taskId: 'not-alive-task',
			componentName: 'NotAliveComp',
			componentInjectAt: '#app',
			component: { name: 'NotAliveComp' },
			alive: false
		});

		lifeCycle.disableAlive('not-alive-task');
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('has no active alive observer to stop')
		);
	});

	it('should delegate destroy and reset to TaskContext after stopping alive', () => {
		taskContext.set('life-task', {
			taskId: 'life-task',
			componentName: 'LifeComp',
			componentInjectAt: '#app',
			component: { name: 'LifeComp' },
			alive: true,
			disableAlive: vi.fn()
		});

		const destroySpy = vi.spyOn(taskContext, 'destroy');
		const resetSpy = vi.spyOn(taskContext, 'reset');

		lifeCycle.destroy('life-task');
		expect(destroySpy).toHaveBeenCalledWith('life-task');

		taskContext.set('life-task', {
			taskId: 'life-task',
			componentName: 'LifeComp',
			componentInjectAt: '#app',
			component: { name: 'LifeComp' },
			alive: true,
			disableAlive: vi.fn()
		});

		lifeCycle.reset('life-task');
		expect(resetSpy).toHaveBeenCalledWith('life-task');
	});

	it('should disable alive tasks then call destroyAll', () => {
		taskContext.set('alive-destroy-all', {
			taskId: 'alive-destroy-all',
			componentName: 'AliveDestroyAllComp',
			componentInjectAt: '#app',
			component: { name: 'AliveDestroyAllComp' },
			alive: true,
			disableAlive: vi.fn()
		});
		taskContext.set('idle-destroy-all', {
			taskId: 'idle-destroy-all',
			componentName: 'IdleDestroyAllComp',
			componentInjectAt: '#app',
			component: { name: 'IdleDestroyAllComp' },
			alive: false
		});

		const disableSpy = vi.spyOn(lifeCycle, 'disableAlive');
		const destroyAllSpy = vi.spyOn(taskContext, 'destroyAll');

		lifeCycle.destroyAll();

		expect(disableSpy).toHaveBeenCalledTimes(1);
		expect(disableSpy).toHaveBeenCalledWith('alive-destroy-all');
		expect(destroyAllSpy).toHaveBeenCalledOnce();
	});

	it('should disable alive tasks then call resetAll', () => {
		taskContext.set('alive-reset-all', {
			taskId: 'alive-reset-all',
			componentName: 'AliveResetAllComp',
			componentInjectAt: '#app',
			component: { name: 'AliveResetAllComp' },
			alive: true,
			disableAlive: vi.fn()
		});
		taskContext.set('idle-reset-all', {
			taskId: 'idle-reset-all',
			componentName: 'IdleResetAllComp',
			componentInjectAt: '#app',
			component: { name: 'IdleResetAllComp' },
			alive: false
		});

		const disableSpy = vi.spyOn(lifeCycle, 'disableAlive');
		const resetAllSpy = vi.spyOn(taskContext, 'resetAll');

		lifeCycle.resetAll();

		expect(disableSpy).toHaveBeenCalledTimes(1);
		expect(disableSpy).toHaveBeenCalledWith('alive-reset-all');
		expect(resetAllSpy).toHaveBeenCalledOnce();
	});
});
