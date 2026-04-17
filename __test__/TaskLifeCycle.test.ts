import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type App } from 'vue';
import { ObserverHub } from '../src/core/hooks/ObserverHub';
import type { ObserveEvent } from '../src/core/hooks/type';
import { createObserveEmitter } from '../src/core/hooks/util';
import { Logger } from '../src/core/logger/Logger';
import { TaskContext } from '../src/core/Task/TaskContext';
import { TaskLifeCycle } from '../src/core/Task/TaskLifeCycle';
import type { ComponentTask } from '../src/core/Task/types';
import { DOMWatcher } from '../src/core/watcher/DomWatcher';
import { createComponentTask, createListenerTask } from './factory/TaskFactor';

describe('TaskLifeCycle', () => {
	let taskContext: TaskContext;
	let onTargetReady: ReturnType<
		typeof vi.fn<(targetElement: HTMLElement, taskId: string) => void>
	>;
	let lifeCycle: TaskLifeCycle;

	beforeEach(() => {
		const observer = new ObserverHub();
		taskContext = new TaskContext();
		onTargetReady = vi.fn<(targetElement: HTMLElement, taskId: string) => void>();
		lifeCycle = new TaskLifeCycle(
			taskContext,
			onTargetReady,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger()
			},
			createObserveEmitter(observer)
		);
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
		taskContext.set(
			'listener-task',
			createListenerTask({
				taskId: 'listener-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		lifeCycle.enableAlive('listener-task');
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('enableAlive is not applicable to non-component task')
		);
	});

	it('should warn when already observing on enableAlive', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set(
			'already-alive',
			createComponentTask({
				taskId: 'already-alive',
				componentName: 'Comp',
				componentInjectAt: '#app',
				component: { name: 'Comp' },
				alive: true,
				isObserver: true
			})
		);

		lifeCycle.enableAlive('already-alive');
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('already has an active alive observer')
		);
	});

	it('should start onDomAlive in enableAlive case 1 (mounted and connected)', () => {
		const host = document.createElement('div');
		host.id = 'mounted-host';
		document.body.appendChild(host);

		const appRoot = document.createElement('div');
		host.appendChild(appRoot);

		taskContext.set(
			'mounted-task',
			createComponentTask({
				taskId: 'mounted-task',
				componentName: 'MountedComp',
				componentInjectAt: '#mounted-host',
				component: { name: 'MountedComp' },
				app: { unmount: vi.fn() } as unknown as App,
				appRoot,
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		const stopHandler = vi.fn();
		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);

		lifeCycle.enableAlive('mounted-task');

		expect(aliveSpy).toHaveBeenCalledOnce();
		expect(taskContext.get<ComponentTask>('mounted-task')?.disableAlive).toBe(stopHandler);
		expect(taskContext.get<ComponentTask>('mounted-task')?.isObserver).toBe(true);
	});

	it('should call reset and onTargetReady from onDomAlive callbacks in case 1', () => {
		const host = document.createElement('div');
		host.id = 'mounted-host-callback';
		document.body.appendChild(host);

		const appRoot = document.createElement('div');
		host.appendChild(appRoot);

		taskContext.set(
			'mounted-callback-task',
			createComponentTask({
				taskId: 'mounted-callback-task',
				componentName: 'MountedCallbackComp',
				componentInjectAt: '#mounted-host-callback',
				component: { name: 'MountedCallbackComp' },
				app: { unmount: vi.fn() } as unknown as App,
				appRoot,
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		const resetSpy = vi.spyOn(taskContext, 'reset');
		const aliveSpy = vi
			.spyOn(DOMWatcher, 'onDomAlive')
			.mockImplementation((_matchedElement, _injectAt, onRemove, onRestore) => {
				onRemove();
				onRestore(document.createElement('div'));
				return () => {};
			});

		lifeCycle.enableAlive('mounted-callback-task');

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

		taskContext.set(
			'shadow-task',
			createComponentTask({
				taskId: 'shadow-task',
				componentName: 'ShadowComp',
				componentInjectAt: '#shadow-host',
				component: { name: 'ShadowComp' },
				app: { unmount: vi.fn() } as unknown as App,
				appRoot,
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});

		lifeCycle.enableAlive('shadow-task');

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('host element not found, unable to activate alive observer')
		);
		expect(aliveSpy).not.toHaveBeenCalled();
		expect(taskContext.get<ComponentTask>('shadow-task')?.isObserver).toBe(false);
	});

	it('should stop mounted alive observer when disabled right after setup', () => {
		const stopHandler = vi.fn();
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);
		const appRoot = document.createElement('div');
		appRoot.id = 'app';
		document.body.appendChild(appRoot);

		taskContext.set(
			'alive-task',
			createComponentTask({
				taskId: 'alive-task',
				alive: true,
				appRoot,
				componentName: 'AliveComp',
				componentInjectAt: '#app',
				component: { name: 'AliveComp' },
				app: { unmount: vi.fn() } as unknown as App,
				scope: 'local'
			})
		);

		lifeCycle.enableAlive('alive-task');
		lifeCycle.disableAlive('alive-task');

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(stopHandler).toHaveBeenCalledOnce();
		expect(taskContext.get<ComponentTask>('alive-task')?.isObserver).toBe(false);
	});

	it('should keep mounted observer active when setup succeeds', () => {
		const appRoot = document.createElement('div');
		appRoot.id = 'app';
		document.body.appendChild(appRoot);

		taskContext.set(
			'alive-task',
			createComponentTask({
				taskId: 'alive-task',
				alive: true,
				appRoot,
				componentName: 'AliveComp',
				componentInjectAt: '#app',
				component: { name: 'AliveComp' },
				app: { unmount: vi.fn() } as unknown as App,
				scope: 'local'
			})
		);

		const fakeStopHandler = vi.fn();
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(fakeStopHandler);

		lifeCycle.enableAlive('alive-task');

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(fakeStopHandler).not.toHaveBeenCalled();
		expect(taskContext.get<ComponentTask>('alive-task')?.isObserver).toBe(true);
	});

	it('should reset and then onDomReady in enableAlive case 2 (disconnected appRoot)', () => {
		const host = document.createElement('div');
		host.id = 'detached-host';
		document.body.appendChild(host);
		host.remove();

		const appRoot = document.createElement('div');
		taskContext.set(
			'detached-task',
			createComponentTask({
				taskId: 'detached-task',
				componentName: 'DetachedComp',
				componentInjectAt: '#detached-host',
				component: { name: 'DetachedComp' },
				app: { unmount: vi.fn() } as unknown as App,
				appRoot,
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		const resetSpy = vi.spyOn(taskContext, 'reset');
		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		lifeCycle.enableAlive('detached-task');

		expect(resetSpy).toHaveBeenCalledWith('detached-task');
		expect(readySpy).toHaveBeenCalled();
		expect(taskContext.get<ComponentTask>('detached-task')?.isObserver).toBe(true);
	});

	it('should wait and forward to onTargetReady in enableAlive case 3 (app undefined)', () => {
		taskContext.set(
			'case3-task',
			createComponentTask({
				taskId: 'case3-task',
				componentName: 'Case3Comp',
				componentInjectAt: '#app',
				component: { name: 'Case3Comp' },
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_, cb) => {
			const el = document.createElement('div');
			cb(el);
			return () => {};
		});

		lifeCycle.enableAlive('case3-task');

		expect(readySpy).toHaveBeenCalledOnce();
		expect(onTargetReady).toHaveBeenCalledOnce();
		expect(taskContext.get<ComponentTask>('case3-task')?.isObserver).toBe(true);
	});

	it('should warn and skip onTargetReady when case 3 callback fires after cancellation', () => {
		taskContext.set(
			'case3-cancelled-task',
			createComponentTask({
				taskId: 'case3-cancelled-task',
				componentName: 'Case3CancelledComp',
				componentInjectAt: '#app',
				component: { name: 'Case3CancelledComp' },
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		let readyCallback: ((el: HTMLElement) => void) | undefined;
		vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_selector, cb) => {
			readyCallback = cb;
			return () => {};
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		lifeCycle.enableAlive('case3-cancelled-task');
		taskContext.get<ComponentTask>('case3-cancelled-task')?.disableAlive?.();
		readyCallback?.(document.createElement('div'));

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('alive state changed before element appears')
		);
		expect(onTargetReady).not.toHaveBeenCalled();
	});

	it('should warn and skip onTargetReady when case 3 callback sees inactive alive state', () => {
		taskContext.set(
			'case3-stale-task',
			createComponentTask({
				taskId: 'case3-stale-task',
				componentName: 'Case3StaleComp',
				componentInjectAt: '#app',
				component: { name: 'Case3StaleComp' },
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		let readyCallback: ((el: HTMLElement) => void) | undefined;
		vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_selector, cb) => {
			readyCallback = cb;
			return () => {};
		});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		lifeCycle.enableAlive('case3-stale-task');
		const context = taskContext.get<ComponentTask>('case3-stale-task');
		if (context) {
			context.alive = false;
		}
		readyCallback?.(document.createElement('div'));

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('alive state changed before element appears')
		);
		expect(onTargetReady).not.toHaveBeenCalled();
	});

	it('should stop ready observer in enableAlive case 3 cancel path', () => {
		const stopReadyObserver = vi.fn();
		vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(stopReadyObserver);

		taskContext.set(
			'cancel-task',
			createComponentTask({
				taskId: 'cancel-task',
				componentName: 'CancelComp',
				componentInjectAt: '#cancel',
				component: { name: 'CancelComp' },
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		lifeCycle.enableAlive('cancel-task');
		const disable = taskContext.get<ComponentTask>('cancel-task')?.disableAlive;
		disable?.();

		expect(stopReadyObserver).toHaveBeenCalledOnce();
	});

	it('should clear observer state and call stop handler on disableAlive', () => {
		const stop = vi.fn();
		taskContext.set(
			'disable-task',
			createComponentTask({
				taskId: 'disable-task',
				componentName: 'DisableComp',
				componentInjectAt: '#app',
				component: { name: 'DisableComp' },
				alive: true,
				isObserver: true,
				disableAlive: stop
			})
		);

		lifeCycle.disableAlive('disable-task');
		const context = taskContext.get<ComponentTask>('disable-task');

		expect(stop).toHaveBeenCalledOnce();
		expect(context?.alive).toBe(false);
		expect(context?.isObserver).toBe(false);
		expect(context?.disableAlive).toBeUndefined();
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
		taskContext.set(
			'not-alive-task',
			createComponentTask({
				taskId: 'not-alive-task',
				componentName: 'NotAliveComp',
				componentInjectAt: '#app',
				component: { name: 'NotAliveComp' },
				alive: false
			})
		);

		lifeCycle.disableAlive('not-alive-task');
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('has no active alive observer to stop')
		);
	});

	it('should delegate destroy and reset to TaskContext after stopping alive', () => {
		taskContext.set(
			'life-task',
			createComponentTask({
				taskId: 'life-task',
				componentName: 'LifeComp',
				componentInjectAt: '#app',
				component: { name: 'LifeComp' },
				alive: true,
				disableAlive: vi.fn()
			})
		);

		const destroySpy = vi.spyOn(taskContext, 'destroy');
		const resetSpy = vi.spyOn(taskContext, 'reset');

		lifeCycle.destroy('life-task');
		expect(destroySpy).toHaveBeenCalledWith('life-task');

		taskContext.set(
			'life-task',
			createComponentTask({
				taskId: 'life-task',
				componentName: 'LifeComp',
				componentInjectAt: '#app',
				component: { name: 'LifeComp' },
				alive: true,
				disableAlive: vi.fn()
			})
		);

		lifeCycle.reset('life-task');
		expect(resetSpy).toHaveBeenCalledWith('life-task');
	});

	it('should disable alive tasks then call destroyAll', () => {
		taskContext.set(
			'alive-destroy-all',
			createComponentTask({
				taskId: 'alive-destroy-all',
				componentName: 'AliveDestroyAllComp',
				componentInjectAt: '#app',
				component: { name: 'AliveDestroyAllComp' },
				alive: true,
				disableAlive: vi.fn()
			})
		);
		taskContext.set(
			'idle-destroy-all',
			createComponentTask({
				taskId: 'idle-destroy-all',
				componentName: 'IdleDestroyAllComp',
				componentInjectAt: '#app',
				component: { name: 'IdleDestroyAllComp' },
				alive: false
			})
		);

		const disableSpy = vi.spyOn(lifeCycle, 'disableAlive');
		const destroyAllSpy = vi.spyOn(taskContext, 'destroyAll');

		lifeCycle.destroyAll();

		expect(disableSpy).toHaveBeenCalledTimes(1);
		expect(disableSpy).toHaveBeenCalledWith('alive-destroy-all');
		expect(destroyAllSpy).toHaveBeenCalledOnce();
	});

	it('should disable alive tasks then call resetAll', () => {
		taskContext.set(
			'alive-reset-all',
			createComponentTask({
				taskId: 'alive-reset-all',
				componentName: 'AliveResetAllComp',
				componentInjectAt: '#app',
				component: { name: 'AliveResetAllComp' },
				alive: true,
				disableAlive: vi.fn()
			})
		);
		taskContext.set(
			'idle-reset-all',
			createComponentTask({
				taskId: 'idle-reset-all',
				componentName: 'IdleResetAllComp',
				componentInjectAt: '#app',
				component: { name: 'IdleResetAllComp' },
				alive: false
			})
		);

		const disableSpy = vi.spyOn(lifeCycle, 'disableAlive');
		const resetAllSpy = vi.spyOn(taskContext, 'resetAll');

		lifeCycle.resetAll();

		expect(disableSpy).toHaveBeenCalledTimes(1);
		expect(disableSpy).toHaveBeenCalledWith('alive-reset-all');
		expect(resetAllSpy).toHaveBeenCalledOnce();
	});

	it('should emit alive and task lifecycle events', () => {
		const observer = new ObserverHub();
		const events: string[] = [];
		observer.onAny((event) => {
			events.push(event.name);
		});

		const lifecycleWithObserver = new TaskLifeCycle(
			taskContext,
			onTargetReady,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger()
			},
			createObserveEmitter(observer)
		);

		const host = document.createElement('div');
		host.id = 'obs-life-host';
		document.body.appendChild(host);
		const appRoot = document.createElement('div');
		host.appendChild(appRoot);

		taskContext.set(
			'obs-life-task',
			createComponentTask({
				taskId: 'obs-life-task',
				componentName: 'ObsLifeComp',
				componentInjectAt: '#obs-life-host',
				component: { name: 'ObsLifeComp' },
				app: { unmount: vi.fn() } as unknown as App<Element>,
				appRoot,
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});

		lifecycleWithObserver.enableAlive('obs-life-task');
		lifecycleWithObserver.disableAlive('obs-life-task');
		lifecycleWithObserver.reset('obs-life-task');
		lifecycleWithObserver.destroy('obs-life-task');

		expect(events).toContain('alive:enable');
		expect(events).toContain('alive:observeStart');
		expect(events).toContain('alive:disable');
		expect(events).toContain('alive:observeStop');
		expect(events).toContain('task:beforeReset');
		expect(events).toContain('task:reset');
		expect(events).toContain('task:afterReset');
		expect(events).toContain('task:beforeDestroy');
		expect(events).toContain('task:destroy');
		expect(events).toContain('task:afterDestroy');
	});

	it('should emit normalized alive payloads for mounted observer mode', () => {
		const observer = new ObserverHub();
		const lifecycleWithObserver = new TaskLifeCycle(
			taskContext,
			onTargetReady,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger()
			},
			createObserveEmitter(observer)
		);

		const host = document.createElement('div');
		host.id = 'alive-mounted-host';
		document.body.appendChild(host);
		const appRoot = document.createElement('div');
		host.appendChild(appRoot);

		taskContext.set(
			'alive-mounted-task',
			createComponentTask({
				taskId: 'alive-mounted-task',
				taskStatus: 'idle',
				componentName: 'AliveMountedComp',
				componentInjectAt: '#alive-mounted-host',
				component: { name: 'AliveMountedComp' },
				app: { unmount: vi.fn() } as unknown as App<Element>,
				appRoot,
				alive: false,
				isObserver: false,
				scope: 'global'
			})
		);

		vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});

		const aliveEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('alive:')) {
				aliveEvents.push(event);
			}
		});

		lifecycleWithObserver.enableAlive('alive-mounted-task');
		lifecycleWithObserver.disableAlive('alive-mounted-task');

		expect(aliveEvents.find((event) => event.name === 'alive:enable')).toMatchObject({
			name: 'alive:enable',
			taskId: 'alive-mounted-task',
			kind: 'component',
			injectAt: '#alive-mounted-host',
			status: 'idle',
			meta: {
				scope: 'global'
			}
		});

		expect(
			aliveEvents.find(
				(event) =>
					event.name === 'alive:observeStart' && event.meta?.observerMode === 'mounted'
			)
		).toMatchObject({
			name: 'alive:observeStart',
			taskId: 'alive-mounted-task',
			kind: 'component',
			injectAt: '#alive-mounted-host',
			status: 'idle',
			meta: {
				scope: 'global',
				observerMode: 'mounted'
			}
		});

		expect(aliveEvents.find((event) => event.name === 'alive:disable')).toMatchObject({
			name: 'alive:disable',
			taskId: 'alive-mounted-task',
			kind: 'component',
			injectAt: '#alive-mounted-host',
			status: 'idle',
			meta: {
				scope: 'global'
			}
		});

		expect(
			aliveEvents.find(
				(event) =>
					event.name === 'alive:observeStop' && event.meta?.observerMode === 'mounted'
			)
		).toMatchObject({
			name: 'alive:observeStop',
			taskId: 'alive-mounted-task',
			kind: 'component',
			injectAt: '#alive-mounted-host',
			status: 'idle',
			meta: {
				scope: 'global',
				observerMode: 'mounted'
			}
		});
	});

	it('should emit normalized alive payloads for await-target observer mode', () => {
		const observer = new ObserverHub();
		const lifecycleWithObserver = new TaskLifeCycle(
			taskContext,
			onTargetReady,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger()
			},
			createObserveEmitter(observer)
		);

		taskContext.set(
			'alive-await-task',
			createComponentTask({
				taskId: 'alive-await-task',
				taskStatus: 'idle',
				componentName: 'AliveAwaitComp',
				componentInjectAt: '#alive-await-host',
				component: { name: 'AliveAwaitComp' },
				alive: false,
				isObserver: false,
				scope: 'local'
			})
		);

		vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		const aliveEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('alive:')) {
				aliveEvents.push(event);
			}
		});

		lifecycleWithObserver.enableAlive('alive-await-task');
		lifecycleWithObserver.disableAlive('alive-await-task');

		expect(
			aliveEvents.find(
				(event) =>
					event.name === 'alive:observeStart' &&
					event.meta?.observerMode === 'await-target'
			)
		).toMatchObject({
			name: 'alive:observeStart',
			taskId: 'alive-await-task',
			kind: 'component',
			injectAt: '#alive-await-host',
			status: 'idle',
			meta: {
				scope: 'local',
				observerMode: 'await-target'
			}
		});

		expect(aliveEvents.find((event) => event.name === 'alive:disable')).toMatchObject({
			name: 'alive:disable',
			taskId: 'alive-await-task',
			kind: 'component',
			injectAt: '#alive-await-host',
			status: 'idle',
			meta: {
				scope: 'local'
			}
		});

		expect(
			aliveEvents.find(
				(event) =>
					event.name === 'alive:observeStop' &&
					event.meta?.observerMode === 'await-target'
			)
		).toMatchObject({
			name: 'alive:observeStop',
			taskId: 'alive-await-task',
			kind: 'component',
			injectAt: '#alive-await-host',
			status: 'idle',
			meta: {
				scope: 'local',
				observerMode: 'await-target'
			}
		});
	});

	it('should emit normalized task reset and destroy payloads', () => {
		const observer = new ObserverHub();
		const lifecycleWithObserver = new TaskLifeCycle(
			taskContext,
			onTargetReady,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger()
			},
			createObserveEmitter(observer)
		);

		taskContext.set(
			'task-life-observe',
			createComponentTask({
				taskId: 'task-life-observe',
				taskStatus: 'pending',
				componentName: 'TaskLifeObserveComp',
				componentInjectAt: '#task-life-observe',
				component: { name: 'TaskLifeObserveComp' },
				alive: false,
				scope: 'local'
			})
		);

		const taskEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('task:')) {
				taskEvents.push(event);
			}
		});

		lifecycleWithObserver.reset('task-life-observe');

		expect(
			taskEvents.find(
				(event) => event.name === 'task:beforeReset' && event.taskId === 'task-life-observe'
			)
		).toMatchObject({
			name: 'task:beforeReset',
			taskId: 'task-life-observe',
			kind: 'component',
			injectAt: '#task-life-observe',
			status: 'pending'
		});

		expect(
			taskEvents.find(
				(event) => event.name === 'task:reset' && event.taskId === 'task-life-observe'
			)
		).toMatchObject({
			name: 'task:reset',
			taskId: 'task-life-observe',
			kind: 'component',
			injectAt: '#task-life-observe',
			status: 'pending'
		});

		expect(
			taskEvents.find(
				(event) => event.name === 'task:afterReset' && event.taskId === 'task-life-observe'
			)
		).toMatchObject({
			name: 'task:afterReset',
			taskId: 'task-life-observe',
			kind: 'component',
			injectAt: '#task-life-observe',
			status: 'idle',
			preStatus: 'pending'
		});

		taskContext.set(
			'task-life-observe',
			createComponentTask({
				taskId: 'task-life-observe',
				taskStatus: 'active',
				componentName: 'TaskLifeObserveComp',
				componentInjectAt: '#task-life-observe',
				component: { name: 'TaskLifeObserveComp' },
				alive: false,
				scope: 'local'
			})
		);

		taskEvents.length = 0;
		lifecycleWithObserver.destroy('task-life-observe');

		expect(
			taskEvents.find(
				(event) =>
					event.name === 'task:beforeDestroy' && event.taskId === 'task-life-observe'
			)
		).toMatchObject({
			name: 'task:beforeDestroy',
			taskId: 'task-life-observe',
			kind: 'component',
			injectAt: '#task-life-observe',
			status: 'active'
		});

		expect(
			taskEvents.find(
				(event) => event.name === 'task:destroy' && event.taskId === 'task-life-observe'
			)
		).toMatchObject({
			name: 'task:destroy',
			taskId: 'task-life-observe',
			kind: 'component',
			injectAt: '#task-life-observe',
			status: 'active'
		});

		expect(
			taskEvents.find(
				(event) =>
					event.name === 'task:afterDestroy' && event.taskId === 'task-life-observe'
			)
		).toMatchObject({
			name: 'task:afterDestroy',
			taskId: 'task-life-observe',
			kind: 'component',
			injectAt: '#task-life-observe',
			preStatus: 'active'
		});
	});
});
