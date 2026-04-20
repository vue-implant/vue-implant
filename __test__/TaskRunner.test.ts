import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchHandle } from 'vue';
import { createVueAdapter } from '../src/core/adapter/vue/VueAdapter';
import { VuePlugin } from '../src/core/adapter/vue/VuePlugin';
import { ObserverHub } from '../src/core/hooks/ObserverHub';
import type { ObserveEvent } from '../src/core/hooks/type';
import { createObserveEmitter } from '../src/core/hooks/util';
import { Action } from '../src/core/Injector/types';
import { Logger } from '../src/core/logger/Logger';
import { createActivityStore } from '../src/core/signal/observeActivitySignal';
import { TaskContext } from '../src/core/Task/TaskContext';
import { TaskRunner } from '../src/core/Task/TaskRunner';
import type { ArtifactTask, ListenerTask } from '../src/core/Task/types';
import { DOMWatcher } from '../src/core/watcher/DomWatcher';
import { createArtifactTask, createListenerTask, createVueComponent } from './factory/TaskFactor';

describe('TaskRunner', () => {
	let taskContext: TaskContext;
	let taskRunner: TaskRunner;
	let vueAdapter: ReturnType<typeof createVueAdapter>;

	beforeEach(() => {
		const observer = new ObserverHub();
		const logger = new Logger();
		taskContext = new TaskContext();
		vueAdapter = createVueAdapter(logger);
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger()
			},
			createObserveEmitter(observer)
		);
		document.body.innerHTML = '';
		vi.spyOn(console, 'info').mockImplementation(() => { });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		VuePlugin.clear();
		document.body.innerHTML = '';
	});

	it('should throw when no task exists on run', () => {
		expect(() => taskRunner.run()).toThrow('No registered tasks found');
	});

	it('should emit normalized run payloads for start, skipped and scheduled', () => {
		const observer = new ObserverHub();
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);

		taskContext.set(
			'run-idle-task',
			createArtifactTask({
				taskId: 'run-idle-task',
				taskStatus: 'idle',
				componentInjectAt: '#run-idle',
				timeout: 7000
			})
		);
		taskContext.set(
			'run-pending-task',
			createListenerTask({
				taskId: 'run-pending-task',
				taskStatus: 'pending',
				listenAt: '#run-pending',
				event: 'click',
				callback: vi.fn(),
				withEvent: true
			})
		);
		taskContext.set(
			'run-active-task',
			createArtifactTask({
				taskId: 'run-active-task',
				taskStatus: 'active',
				componentInjectAt: '#run-active'
			})
		);

		taskContext.taskRecords.push({ taskId: 'run-idle-task', injectAt: '#run-idle' });
		taskContext.taskRecords.push({ taskId: 'run-pending-task', injectAt: '#run-pending' });
		taskContext.taskRecords.push({ taskId: 'run-active-task', injectAt: '#run-active' });

		vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => { });

		const runEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('run:')) {
				runEvents.push(event);
			}
		});

		taskRunner.run();

		expect(runEvents.find((event) => event.name === 'run:start')).toMatchObject({
			name: 'run:start',
			meta: {
				totalTasks: 3,
				idleTasks: 1,
				pendingTasks: 1,
				activeTasks: 1
			}
		});

		expect(
			runEvents.find(
				(event) => event.name === 'run:taskSkipped' && event.taskId === 'run-pending-task'
			)
		).toMatchObject({
			name: 'run:taskSkipped',
			taskId: 'run-pending-task',
			kind: 'listener',
			injectAt: '#run-pending',
			status: 'pending',
			meta: {
				skipReason: 'already-pending'
			}
		});

		expect(
			runEvents.find(
				(event) => event.name === 'run:taskSkipped' && event.taskId === 'run-active-task'
			)
		).toMatchObject({
			name: 'run:taskSkipped',
			taskId: 'run-active-task',
			kind: 'component',
			injectAt: '#run-active',
			status: 'active',
			meta: {
				skipReason: 'already-active'
			}
		});

		expect(
			runEvents.find(
				(event) => event.name === 'run:taskScheduled' && event.taskId === 'run-idle-task'
			)
		).toMatchObject({
			name: 'run:taskScheduled',
			taskId: 'run-idle-task',
			kind: 'component',
			injectAt: '#run-idle',
			status: 'pending',
			preStatus: 'idle',
			meta: {
				timeout: 7000
			}
		});
	});

	it('should schedule onDomReady and mark task pending on run', () => {
		taskContext.set(
			'task-a',
			createArtifactTask({
				taskId: 'task-a',
				taskStatus: 'idle'
			})
		);
		taskContext.taskRecords.push({ taskId: 'task-a', injectAt: '#app' });

		const spy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => { });

		taskRunner.run();

		expect(spy).toHaveBeenCalledWith(
			'#app',
			expect.any(Function),
			document,
			expect.objectContaining({
				once: true
			}),
			expect.objectContaining({
				logger: expect.anything(),
				emit: expect.any(Function)
			})
		);
		expect(taskContext.getTaskStatus('task-a')).toBe('pending');
	});

	it('should skip task that is active or pending on run', () => {
		taskContext.set(
			'active-task',
			createArtifactTask({
				taskId: 'active-task',
				taskStatus: 'active'
			})
		);
		taskContext.set(
			'pending-task',
			createArtifactTask({
				taskId: 'pending-task',
				taskStatus: 'pending'
			})
		);
		taskContext.taskRecords.push({ taskId: 'active-task', injectAt: '#a' });
		taskContext.taskRecords.push({ taskId: 'pending-task', injectAt: '#b' });

		const spy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => { });

		taskRunner.run();

		expect(spy).not.toHaveBeenCalled();
	});

	it('should mount component and mark task active on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'host';
		document.body.appendChild(host);

		const task = createArtifactTask({
			taskId: 'mount-task',
			taskStatus: 'idle',
			componentName: 'MountComp',
			componentInjectAt: '#host',
			component: createVueComponent('MountComp')
		});

		taskContext.set(task.taskId, task);
		taskRunner.onTargetReady(host, task.taskId);

		expect(task.mountHandle).toBeDefined();
		expect(task.appRoot?.parentElement).toBe(host);
		expect(task.taskStatus).toBe('active');
	});

	it('should emit normalized target ready payload', () => {
		const observer = new ObserverHub();
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);

		taskContext.set(
			'target-ready-listener',
			createListenerTask({
				taskId: 'target-ready-listener',
				taskStatus: 'idle',
				listenAt: '#target-ready',
				event: 'click',
				callback: vi.fn(),
				withEvent: false
			})
		);

		const targetEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name === 'target:ready') {
				targetEvents.push(event);
			}
		});

		taskRunner.onTargetReady(document.createElement('div'), 'target-ready-listener');

		expect(targetEvents[0]).toMatchObject({
			name: 'target:ready',
			taskId: 'target-ready-listener',
			kind: 'listener',
			injectAt: '#target-ready',
			status: 'idle'
		});
	});

	it('should emit normalized inject start and success payloads', () => {
		const observer = new ObserverHub();
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);

		const host = document.createElement('div');
		host.id = 'inject-observe-host';
		document.body.appendChild(host);

		const btn = document.createElement('button');
		btn.id = 'inject-observe-btn';
		document.body.appendChild(btn);

		taskContext.set(
			'inject-observe-task',
			createArtifactTask({
				taskId: 'inject-observe-task',
				taskStatus: 'idle',
				componentName: 'InjectObserveComp',
				componentInjectAt: '#inject-observe-host',
				component: createVueComponent('InjectObserveComp'),
				alive: true,
				scope: 'global',
				withEvent: true,
				listener: {
					listenAt: '#inject-observe-btn',
					event: 'click',
					callback: vi.fn()
				}
			})
		);

		const injectEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('inject:')) {
				injectEvents.push(event);
			}
		});

		taskRunner.onTargetReady(host, 'inject-observe-task');

		expect(injectEvents[0]).toMatchObject({
			name: 'inject:start',
			taskId: 'inject-observe-task',
			kind: 'component',
			injectAt: '#inject-observe-host',
			status: 'idle',
			meta: {
				componentName: 'InjectObserveComp',
				alive: true,
				scope: 'global',
				withEvent: true
			}
		});

		expect(injectEvents[1]).toMatchObject({
			name: 'inject:success',
			taskId: 'inject-observe-task',
			kind: 'component',
			injectAt: '#inject-observe-host',
			status: 'idle',
			meta: {
				componentName: 'InjectObserveComp',
				alive: true,
				scope: 'global'
			}
		});
	});

	it('should emit normalized inject fail payload', () => {
		const observer = new ObserverHub();
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);

		taskContext.set(
			'inject-fail-task',
			createArtifactTask({
				taskId: 'inject-fail-task',
				taskStatus: 'pending',
				componentName: 'InjectFailComp',
				componentInjectAt: '#inject-fail-host',
				component: createVueComponent('InjectFailComp'),
				alive: false,
				scope: 'local'
			})
		);

		const injectEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('inject:')) {
				injectEvents.push(event);
			}
		});

		taskRunner.onTargetReady(document.createElement('div'), 'inject-fail-task');

		expect(injectEvents[0]).toMatchObject({
			name: 'inject:start',
			taskId: 'inject-fail-task',
			kind: 'component',
			injectAt: '#inject-fail-host',
			status: 'pending',
			meta: {
				componentName: 'InjectFailComp',
				alive: false,
				scope: 'local',
				withEvent: false
			}
		});

		expect(injectEvents[1]).toMatchObject({
			name: 'inject:fail',
			taskId: 'inject-fail-task',
			kind: 'component',
			injectAt: '#inject-fail-host',
			status: 'idle',
			meta: {
				componentName: 'InjectFailComp'
			}
		});
		expect(injectEvents[1].error).toBeDefined();
	});

	it('should emit task:active when a task becomes active', () => {
		const observer = new ObserverHub();
		const activeEvents: ObserveEvent[] = [];
		taskContext = new TaskContext(createObserveEmitter(observer), new Logger());
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);
		observer.on('task:active', (event) => {
			activeEvents.push(event);
		});

		const host = document.createElement('div');
		host.id = 'active-event-host';
		document.body.appendChild(host);

		taskContext.set(
			'active-event-task',
			createArtifactTask({
				taskId: 'active-event-task',
				taskStatus: 'idle',
				componentName: 'ActiveEventComp',
				componentInjectAt: '#active-event-host',
				component: createVueComponent('ActiveEventComp')
			})
		);

		taskRunner.onTargetReady(host, 'active-event-task');

		expect(activeEvents).toHaveLength(1);
		expect(activeEvents[0]).toMatchObject({
			name: 'task:active',
			taskId: 'active-event-task',
			kind: 'component',
			injectAt: '#active-event-host',
			status: 'active',
			preStatus: 'idle'
		});
	});

	it('should install all registered shared plugins when mounting component', () => {
		const host = document.createElement('div');
		host.id = 'plugin-host';
		document.body.appendChild(host);
		const pluginA = { install: vi.fn() };
		const pluginB = { install: vi.fn() };

		VuePlugin.usePlugins(pluginA, pluginB);
		const plugins = VuePlugin.getPlugins();
		taskContext.set(
			'plugin-task',
			createArtifactTask({
				taskId: 'plugin-task',
				taskStatus: 'idle',
				componentName: 'PluginComp',
				componentInjectAt: '#plugin-host',
				component: createVueComponent('PluginComp'),
				adapter: vueAdapter
			})
		);

		taskRunner.onTargetReady(host, 'plugin-task');

		expect(pluginA.install).toHaveBeenCalledOnce();
		expect(pluginB.install).toHaveBeenCalledOnce();
	});

	it('should route to bindListenerSignal when activitySignal exists on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'route-signal';
		document.body.appendChild(host);

		const bindSpy = vi.spyOn(taskRunner, 'bindListenerSignal').mockReturnValue(true);
		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);
		const signal = createActivityStore(true);

		taskContext.set(
			'route-task',
			createListenerTask({
				taskId: 'route-task',
				taskStatus: 'idle',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				activitySignal: () => signal
			})
		);

		taskRunner.onTargetReady(host, 'route-task');

		expect(bindSpy).toHaveBeenCalledOnce();
		expect(controlSpy).not.toHaveBeenCalledWith('route-task', Action.OPEN);
	});

	it('should route to controlListener OPEN without activitySignal on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'route-open';
		document.body.appendChild(host);

		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);

		taskContext.set(
			'open-task',
			createArtifactTask({
				taskId: 'open-task',
				taskStatus: 'idle',
				componentName: 'OpenComp',
				componentInjectAt: '#route-open',
				component: createVueComponent('OpenComp'),
				withEvent: true,
				listener: {
					listenAt: '#btn',
					event: 'click',
					callback: vi.fn()
				}
			})
		);

		taskRunner.onTargetReady(host, 'open-task');

		expect(controlSpy).toHaveBeenCalledWith('open-task', Action.OPEN);
	});

	it('should stop previous watcher and respond immediately on bindListenerSignal', () => {
		const oldWatcher = vi.fn() as unknown as WatchHandle;
		const source = createActivityStore(false);
		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);

		taskContext.set(
			'signal-task',
			createListenerTask({
				taskId: 'signal-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				watcher: {
					watcher: oldWatcher,
					watchSource: source
				}
			})
		);

		taskRunner.bindListenerSignal('signal-task', source);
		expect(oldWatcher).toHaveBeenCalledOnce();
		expect(controlSpy).toHaveBeenCalledWith('signal-task', Action.CLOSE);

		source.set(true);
		expect(controlSpy).toHaveBeenCalledWith('signal-task', Action.OPEN);
	});

	it('should attach and detach event on controlListener open and close', () => {
		const btn = document.createElement('button');
		btn.id = 'listener-btn';
		document.body.appendChild(btn);

		const callback = vi.fn();
		taskContext.set(
			'listener-task',
			createListenerTask({
				taskId: 'listener-task',
				withEvent: true,
				listenAt: '#listener-btn',
				event: 'click',
				callback
			})
		);

		expect(taskRunner.controlListener('listener-task', Action.OPEN)).toBe(true);
		btn.click();
		expect(callback).toHaveBeenCalledOnce();

		expect(taskRunner.controlListener('listener-task', Action.CLOSE)).toBe(true);
		btn.click();
		expect(callback).toHaveBeenCalledOnce();
	});

	it('should emit normalized listener open and close payloads', () => {
		const observer = new ObserverHub();
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);

		const btn = document.createElement('button');
		btn.id = 'listener-observe-btn';
		document.body.appendChild(btn);

		taskContext.set(
			'listener-observe-task',
			createListenerTask({
				taskId: 'listener-observe-task',
				taskStatus: 'idle',
				withEvent: true,
				listenAt: '#listener-observe-btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		const listenerEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('listener:')) {
				listenerEvents.push(event);
			}
		});

		expect(taskRunner.controlListener('listener-observe-task', Action.OPEN)).toBe(true);
		expect(taskRunner.controlListener('listener-observe-task', Action.CLOSE)).toBe(true);

		expect(
			listenerEvents.find(
				(event) =>
					event.name === 'listener:open' && event.taskId === 'listener-observe-task'
			)
		).toMatchObject({
			name: 'listener:open',
			taskId: 'listener-observe-task',
			kind: 'listener',
			injectAt: '#listener-observe-btn',
			status: 'idle',
			meta: {
				listenerEvent: 'click',
				listenAt: '#listener-observe-btn'
			}
		});

		expect(
			listenerEvents.find(
				(event) =>
					event.name === 'listener:close' && event.taskId === 'listener-observe-task'
			)
		).toMatchObject({
			name: 'listener:close',
			taskId: 'listener-observe-task',
			kind: 'listener',
			injectAt: '#listener-observe-btn',
			status: 'idle',
			meta: {
				listenerEvent: 'click',
				listenAt: '#listener-observe-btn'
			}
		});
	});

	it('should emit normalized listener attachFail payload', () => {
		const observer = new ObserverHub();
		taskRunner = new TaskRunner(
			taskContext,
			{
				alive: false,
				scope: 'local',
				timeout: 5000,
				logger: new Logger(),
				observer
			},
			createObserveEmitter(observer)
		);

		vi.spyOn(
			taskRunner as unknown as {
				attachEvent: (
					id: string,
					listenAt: string,
					event: string,
					callback: EventListener
				) => AbortController | null;
			},
			'attachEvent'
		).mockImplementation(() => null);

		taskContext.set(
			'listener-fail-task',
			createListenerTask({
				taskId: 'listener-fail-task',
				taskStatus: 'pending',
				withEvent: true,
				listenAt: '#listener-fail-btn',
				event: 'mouseenter',
				callback: vi.fn()
			})
		);

		const listenerEvents: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('listener:')) {
				listenerEvents.push(event);
			}
		});

		expect(taskRunner.controlListener('listener-fail-task', Action.OPEN)).toBe(false);

		const failEvent = listenerEvents.find(
			(event) => event.name === 'listener:attachFail' && event.taskId === 'listener-fail-task'
		);
		expect(failEvent).toMatchObject({
			name: 'listener:attachFail',
			taskId: 'listener-fail-task',
			kind: 'listener',
			injectAt: '#listener-fail-btn',
			status: 'pending',
			meta: {
				listenerEvent: 'mouseenter',
				listenAt: '#listener-fail-btn'
			}
		});
		expect(failEvent?.error).toBeInstanceOf(Error);
	});

	it('should warn and return false when attachEvent fails', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
		const attachEventSpy = vi
			.spyOn(
				taskRunner as unknown as { attachEvent: (taskId: string) => void },
				'attachEvent'
			)
			.mockImplementation(() => null);
		taskContext.set(
			'invalid-event',
			createListenerTask({
				taskId: 'invalid-event',
				withEvent: true,
				listenAt: '#listener-btn',
				event: 'invalid-event',
				callback: vi.fn()
			})
		);

		const result = taskRunner.controlListener('invalid-event', Action.OPEN);
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'Failed to attach event "invalid-event" for task "invalid-event"'
			)
		);
	});

	it('should warn on invalid action in controlListener', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
		taskContext.set(
			'invalid-action',
			createListenerTask({
				taskId: 'invalid-action',
				withEvent: true,
				listenAt: '#x',
				event: 'click',
				callback: vi.fn()
			})
		);

		const result = taskRunner.controlListener('invalid-action', 'UNKNOWN' as Action);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action type'));
	});

	it('should start onDomAlive for alive component after successful mount', () => {
		const host = document.createElement('div');
		host.id = 'alive-host';
		document.body.appendChild(host);

		const stopHandler = vi.fn();
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);
		taskContext.set(
			'alive-task',
			createArtifactTask({
				taskId: 'alive-task',
				taskStatus: 'idle',
				componentName: 'AliveComp',
				componentInjectAt: '#alive-host',
				component: createVueComponent('AliveComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		taskRunner.onTargetReady(host, 'alive-task');

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(stopHandler).not.toHaveBeenCalled();
		expect(taskContext.get<ArtifactTask>('alive-task')?.disableAlive).toBe(stopHandler);
		expect(taskContext.get<ArtifactTask>('alive-task')?.isObserver).toBe(true);
	});

	it('should keep task idle when target is detached on onTargetReady', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
		const detached = document.createElement('div');

		taskContext.set(
			'detached-task',
			createArtifactTask({
				taskId: 'detached-task',
				taskStatus: 'pending',
				componentName: 'DetachedComp',
				componentInjectAt: '#detached',
				component: createVueComponent('DetachedComp')
			})
		);

		taskRunner.onTargetReady(detached, 'detached-task');

		expect(taskContext.get('detached-task')?.taskStatus).toBe('idle');
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('detached from DOM'));
	});

	it('should warn and return when task is missing on onTargetReady', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
		taskRunner.onTargetReady(document.createElement('div'), 'missing-task');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Task "missing-task" not found')
		);
	});

	it('should return early when task is already active on onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		taskContext.set(
			'active-short-circuit',
			createArtifactTask({
				taskId: 'active-short-circuit',
				taskStatus: 'active',
				componentName: 'AlreadyActiveComp',
				componentInjectAt: '#x',
				component: createVueComponent('AlreadyActiveComp')
			})
		);

		const controlSpy = vi.spyOn(taskRunner, 'controlListener');
		taskRunner.onTargetReady(host, 'active-short-circuit');

		expect(controlSpy).not.toHaveBeenCalled();
	});

	it('should set task idle when event binding fails on onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		vi.spyOn(taskRunner, 'controlListener').mockReturnValue(false);

		taskContext.set(
			'event-fail-task',
			createListenerTask({
				taskId: 'event-fail-task',
				taskStatus: 'pending',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		taskRunner.onTargetReady(host, 'event-fail-task');
		expect(taskContext.get('event-fail-task')?.taskStatus).toBe('idle');
	});

	it('should return false when bindListenerSignal task is missing', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
		const result = taskRunner.bindListenerSignal('missing-signal-task', createActivityStore(true));
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('unable to bind activity signal')
		);
	});

	it('should return false when watch throws in bindListenerSignal', () => {
		taskContext.set(
			'watch-error-task',
			createListenerTask({
				taskId: 'watch-error-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		vi.spyOn(taskRunner, 'controlListener').mockImplementation(() => {
			throw new Error('watch failed');
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

		const result = taskRunner.bindListenerSignal('watch-error-task', createActivityStore(true));

		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to bind activity signal'),
			expect.any(Error)
		);
	});

	it('should return false when task is missing in controlListener', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
		const result = taskRunner.controlListener('missing-listener-task', Action.OPEN);
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('unable to manage listener state')
		);
	});

	it('should return false when event binding config is incomplete in controlListener', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
		taskContext.set(
			'incomplete-listener-task',
			createListenerTask({
				taskId: 'incomplete-listener-task',
				withEvent: true,
				listenAt: '',
				event: '',
				callback: undefined
			})
		);

		const result = taskRunner.controlListener('incomplete-listener-task', Action.OPEN);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('has no event binding configured')
		);
	});

	it('should skip OPEN when controller already exists in controlListener', () => {
		const addEventSpy = vi.spyOn(Element.prototype, 'addEventListener');
		taskContext.set(
			'opened-task',
			createListenerTask({
				taskId: 'opened-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn(),
				controller: new AbortController()
			})
		);

		const result = taskRunner.controlListener('opened-task', Action.OPEN);
		expect(result).toBe(false);
		expect(addEventSpy).not.toHaveBeenCalled();
	});

	it('should keep returning false when CLOSE is called without controller', () => {
		taskContext.set(
			'closed-task',
			createListenerTask({
				taskId: 'closed-task',
				withEvent: true,
				listenAt: '#btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		const result = taskRunner.controlListener('closed-task', Action.CLOSE);
		expect(result).toBe(false);
	});

	it('should use onDomReady fallback when listen target does not exist in OPEN', () => {
		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_, cb) => {
			const el = document.createElement('button');
			cb(el);
			return () => { };
		});
		taskContext.set(
			'fallback-open-task',
			createListenerTask({
				taskId: 'fallback-open-task',
				withEvent: true,
				listenAt: '#non-existing-btn',
				event: 'click',
				callback: vi.fn()
			})
		);

		const result = taskRunner.controlListener('fallback-open-task', Action.OPEN);
		expect(result).toBe(true);
		expect(readySpy).toHaveBeenCalledOnce();
		expect(taskContext.get<ListenerTask>('fallback-open-task')?.controller).toBeInstanceOf(
			AbortController
		);
	});

	it('should set task idle when component taskId field is empty in onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

		taskContext.set(
			'broken-task-key',
			createArtifactTask({
				taskId: '',
				taskStatus: 'pending',
				componentName: 'BrokenComp',
				componentInjectAt: '#host',
				component: createVueComponent('BrokenComp')
			})
		);

		taskRunner.onTargetReady(host, 'broken-task-key');
		expect(taskContext.get('broken-task-key')?.taskStatus).toBe('idle');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('No artifact found for task')
		);
	});

	it('should set task idle when component mount throws in onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

		taskContext.set(
			'mount-error-task',
			createArtifactTask({
				taskId: 'mount-error-task',
				taskStatus: 'pending',
				componentName: 'MountErrorComp',
				componentInjectAt: '#host',
				component: {
					name: 'MountErrorComp',
					render: () => {
						throw new Error('mount failed');
					}
				}
			})
		);

		taskRunner.onTargetReady(host, 'mount-error-task');
		expect(taskContext.get('mount-error-task')?.taskStatus).toBe('idle');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Artifact mount failed for task'),
			expect.any(Error)
		);
	});

	it('should use document root for onDomAlive when scope is global', () => {
		const host = document.createElement('div');
		host.id = 'global-alive-host';
		document.body.appendChild(host);

		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => { });
		taskContext.set(
			'global-alive-task',
			createArtifactTask({
				taskId: 'global-alive-task',
				taskStatus: 'idle',
				componentName: 'GlobalAliveComp',
				componentInjectAt: '#global-alive-host',
				component: createVueComponent('GlobalAliveComp'),
				alive: true,
				isObserver: false,
				scope: 'global'
			})
		);

		taskRunner.onTargetReady(host, 'global-alive-task');

		expect(aliveSpy).toHaveBeenCalledOnce();
		expect(aliveSpy.mock.calls[0][4]).toBe(document);
	});

	it('should call stopHandler when alive setup is cancelled during onDomAlive setup', () => {
		const host = document.createElement('div');
		host.id = 'stale-alive-host';
		document.body.appendChild(host);

		taskContext.set(
			'stale-alive-task',
			createArtifactTask({
				taskId: 'stale-alive-task',
				taskStatus: 'idle',
				componentName: 'StaleAliveComp',
				componentInjectAt: '#stale-alive-host',
				component: createVueComponent('StaleAliveComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		const stopHandler = vi.fn();
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(() => {
			const ctx = taskContext.get<ArtifactTask>('stale-alive-task');
			if (ctx) {
				ctx.alive = false;
			}
			return stopHandler;
		});

		taskRunner.onTargetReady(host, 'stale-alive-task');

		expect(stopHandler).toHaveBeenCalledOnce();
		expect(taskContext.get<ArtifactTask>('stale-alive-task')?.isObserver).toBe(false);
	});

	it('should assign alive observer handler immediately when setup succeeds', () => {
		const host = document.createElement('div');
		host.id = 'cancel-alive-host';
		document.body.appendChild(host);

		const stopHandler = vi.fn();
		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(stopHandler);
		taskContext.set(
			'cancel-alive-task',
			createArtifactTask({
				taskId: 'cancel-alive-task',
				taskStatus: 'idle',
				componentName: 'CancelAliveComp',
				componentInjectAt: '#cancel-alive-host',
				component: createVueComponent('CancelAliveComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		taskRunner.onTargetReady(host, 'cancel-alive-task');
		const context = taskContext.get<ArtifactTask>('cancel-alive-task');

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(context?.disableAlive).toBe(stopHandler);
		expect(context?.isObserver).toBe(true);
	});

	it('should call reset and onTargetReady from onDomAlive callbacks', () => {
		const host = document.createElement('div');
		host.id = 'alive-callback-host';
		document.body.appendChild(host);

		taskContext.set(
			'alive-callback-task',
			createArtifactTask({
				taskId: 'alive-callback-task',
				taskStatus: 'idle',
				componentName: 'AliveCallbackComp',
				componentInjectAt: '#alive-callback-host',
				component: createVueComponent('AliveCallbackComp'),
				alive: true,
				isObserver: false,
				scope: 'local'
			})
		);

		const resetSpy = vi.spyOn(taskContext, 'reset');
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(
			(_matchedElement, _injectAt, onRemove, onRestore) => {
				onRemove();
				const ctx = taskContext.get<ArtifactTask>('alive-callback-task');
				if (ctx) {
					ctx.alive = false;
				}
				onRestore(document.createElement('div'));
				return () => { };
			}
		);

		taskRunner.onTargetReady(host, 'alive-callback-task');

		expect(resetSpy).toHaveBeenCalledWith('alive-callback-task');
		expect(taskContext.get('alive-callback-task')?.taskStatus).toBe('active');
	});
	it('should set Task`s timeout config correctly', async () => {
		const onDomReadySpy = vi.spyOn(DOMWatcher, 'onDomReady');
		taskContext.set(
			'timeout-task',
			createArtifactTask({
				taskId: 'timeout-task',
				taskStatus: 'idle',
				timeout: 5000
			})
		);
		taskContext.taskRecords.push({ taskId: 'timeout-task', injectAt: '#app' });

		taskRunner.run();

		expect(onDomReadySpy).toHaveBeenCalledWith(
			'#app',
			expect.any(Function),
			document,
			{
				once: true,
				timeout: 5000
			},
			expect.objectContaining({
				logger: expect.anything(),
				emit: expect.any(Function)
			})
		);
	});
});
