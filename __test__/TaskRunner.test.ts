import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref, type WatchHandle } from 'vue';
import { TaskContext } from '../src/core/task/TaskContext';
import { TaskRunner } from '../src/core/task/TaskRunner';
import { DOMWatcher } from '../src/core/watcher/DomWatcher';
import { Action, type Task } from '../src/type';

describe('TaskRunner', () => {
	let taskContext: TaskContext;
	let taskRunner: TaskRunner;

	beforeEach(() => {
		taskContext = new TaskContext();
		taskRunner = new TaskRunner(taskContext, {
			alive: false,
			scope: 'local',
			timeout: 5000
		});
		document.body.innerHTML = '';
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('should throw when no task exists on run', () => {
		expect(() => taskRunner.run()).toThrow('No registered tasks found');
	});

	it('should schedule onDomReady and mark task pending on run', () => {
		taskContext.set('task-a', { taskId: 'task-a', taskStatus: 'idle' });
		taskContext.taskRecords.push({ taskId: 'task-a', injectAt: '#app' });

		const spy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		taskRunner.run();

		expect(spy).toHaveBeenCalledWith('#app', expect.any(Function), document, {
			once: true,
			timeout: 5000
		});
		expect(taskContext.getTaskStatus('task-a')).toBe('pending');
	});

	it('should skip task that is active or pending on run', () => {
		taskContext.set('active-task', { taskId: 'active-task', taskStatus: 'active' });
		taskContext.set('pending-task', { taskId: 'pending-task', taskStatus: 'pending' });
		taskContext.taskRecords.push({ taskId: 'active-task', injectAt: '#a' });
		taskContext.taskRecords.push({ taskId: 'pending-task', injectAt: '#b' });

		const spy = vi.spyOn(DOMWatcher, 'onDomReady').mockReturnValue(() => {});

		taskRunner.run();

		expect(spy).not.toHaveBeenCalled();
	});

	it('should mount component and mark task active on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'host';
		document.body.appendChild(host);

		const task: Task = {
			taskId: 'mount-task',
			taskStatus: 'idle',
			componentName: 'MountComp',
			componentInjectAt: '#host',
			component: { name: 'MountComp', render: () => null }
		};

		taskContext.set(task.taskId, task);
		taskRunner.onTargetReady(host, task.taskId);

		expect(task.app).toBeDefined();
		expect(task.appRoot?.parentElement).toBe(host);
		expect(task.taskStatus).toBe('active');
	});

	it('should route to bindListenerSignal when activitySignal exists on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'route-signal';
		document.body.appendChild(host);

		const bindSpy = vi.spyOn(taskRunner, 'bindListenerSignal').mockReturnValue(true);
		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);
		const signal = ref(true);

		taskContext.set('route-task', {
			taskId: 'route-task',
			taskStatus: 'idle',
			componentName: 'RouteComp',
			componentInjectAt: '#route-signal',
			component: { name: 'RouteComp', render: () => null },
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn(),
			activitySignal: () => signal
		});

		taskRunner.onTargetReady(host, 'route-task');

		expect(bindSpy).toHaveBeenCalledOnce();
		expect(controlSpy).not.toHaveBeenCalledWith('route-task', Action.OPEN);
	});

	it('should route to controlListener OPEN without activitySignal on onTargetReady', () => {
		const host = document.createElement('div');
		host.id = 'route-open';
		document.body.appendChild(host);

		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);

		taskContext.set('open-task', {
			taskId: 'open-task',
			taskStatus: 'idle',
			componentName: 'OpenComp',
			componentInjectAt: '#route-open',
			component: { name: 'OpenComp', render: () => null },
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});

		taskRunner.onTargetReady(host, 'open-task');

		expect(controlSpy).toHaveBeenCalledWith('open-task', Action.OPEN);
	});

	it('should stop previous watcher and respond immediately on bindListenerSignal', async () => {
		const oldWatcher = vi.fn() as unknown as WatchHandle;
		const source = ref(false);
		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);

		taskContext.set('signal-task', {
			taskId: 'signal-task',
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn(),
			watcher: oldWatcher
		});

		taskRunner.bindListenerSignal('signal-task', source);
		expect(oldWatcher).toHaveBeenCalledOnce();
		expect(controlSpy).toHaveBeenCalledWith('signal-task', Action.CLOSE);

		source.value = true;
		await nextTick();
		expect(controlSpy).toHaveBeenCalledWith('signal-task', Action.OPEN);
	});

	it('should attach and detach event on controlListener open and close', () => {
		const btn = document.createElement('button');
		btn.id = 'listener-btn';
		document.body.appendChild(btn);

		const callback = vi.fn();
		taskContext.set('listener-task', {
			taskId: 'listener-task',
			withEvent: true,
			listenAt: '#listener-btn',
			event: 'click',
			callback
		});

		expect(taskRunner.controlListener('listener-task', Action.OPEN)).toBe(true);
		btn.click();
		expect(callback).toHaveBeenCalledOnce();

		expect(taskRunner.controlListener('listener-task', Action.CLOSE)).toBe(true);
		btn.click();
		expect(callback).toHaveBeenCalledOnce();
	});

	it('should warn and return false when attachEvent fails', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const attachEventSpy = vi
			.spyOn(
				taskRunner as unknown as { attachEvent: (taskId: string) => void },
				'attachEvent'
			)
			.mockImplementation(() => null);
		taskContext.set('invalid-event', {
			taskId: 'invalid-event',
			withEvent: true,
			listenAt: '#listener-btn',
			event: 'invalid-event',
			callback: vi.fn()
		});

		const result = taskRunner.controlListener('invalid-event', Action.OPEN);
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'Failed to attach event "invalid-event" for task "invalid-event"'
			)
		);
	});

	it('should warn on invalid action in controlListener', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set('invalid-action', {
			taskId: 'invalid-action',
			withEvent: true,
			listenAt: '#x',
			event: 'click',
			callback: vi.fn()
		});

		const result = taskRunner.controlListener('invalid-action', 'UNKNOWN' as Action);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action type'));
	});

	it('should start onDomAlive for alive component after successful mount', async () => {
		const host = document.createElement('div');
		host.id = 'alive-host';
		document.body.appendChild(host);

		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});
		taskContext.set('alive-task', {
			taskId: 'alive-task',
			taskStatus: 'idle',
			componentName: 'AliveComp',
			componentInjectAt: '#alive-host',
			component: { name: 'AliveComp', render: () => null },
			alive: true,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		taskRunner.onTargetReady(host, 'alive-task');
		await nextTick();

		expect(onDomAliveSpy).toHaveBeenCalledOnce();
		expect(taskContext.get('alive-task')?.isObserver).toBe(true);
	});

	it('should keep task idle when target is detached on onTargetReady', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const detached = document.createElement('div');

		taskContext.set('detached-task', {
			taskId: 'detached-task',
			taskStatus: 'pending',
			componentName: 'DetachedComp',
			componentInjectAt: '#detached',
			component: { name: 'DetachedComp', render: () => null }
		});

		taskRunner.onTargetReady(detached, 'detached-task');

		expect(taskContext.get('detached-task')?.taskStatus).toBe('idle');
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('detached from DOM'));
	});

	it('should warn and return when task is missing on onTargetReady', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		taskRunner.onTargetReady(document.createElement('div'), 'missing-task');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Task "missing-task" not found')
		);
	});

	it('should return early when task is already active on onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		taskContext.set('active-short-circuit', {
			taskId: 'active-short-circuit',
			taskStatus: 'active',
			componentName: 'AlreadyActiveComp',
			componentInjectAt: '#x',
			component: { name: 'AlreadyActiveComp', render: () => null }
		});

		const controlSpy = vi.spyOn(taskRunner, 'controlListener');
		taskRunner.onTargetReady(host, 'active-short-circuit');

		expect(controlSpy).not.toHaveBeenCalled();
	});

	it('should set task idle when event binding fails on onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		vi.spyOn(taskRunner, 'controlListener').mockReturnValue(false);

		taskContext.set('event-fail-task', {
			taskId: 'event-fail-task',
			taskStatus: 'pending',
			componentName: 'EventFailComp',
			componentInjectAt: '#host',
			component: { name: 'EventFailComp', render: () => null },
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});

		taskRunner.onTargetReady(host, 'event-fail-task');
		expect(taskContext.get('event-fail-task')?.taskStatus).toBe('idle');
	});

	it('should return false when bindListenerSignal task is missing', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = taskRunner.bindListenerSignal('missing-signal-task', ref(true));
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('unable to bind activity signal')
		);
	});

	it('should return false when watch throws in bindListenerSignal', () => {
		taskContext.set('watch-error-task', {
			taskId: 'watch-error-task',
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});

		vi.spyOn(taskRunner, 'controlListener').mockImplementation(() => {
			throw new Error('watch failed');
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = taskRunner.bindListenerSignal('watch-error-task', ref(true));

		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to bind activity signal'),
			expect.any(Error)
		);
	});

	it('should return false when task is missing in controlListener', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = taskRunner.controlListener('missing-listener-task', Action.OPEN);
		expect(result).toBe(false);
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('unable to manage listener state')
		);
	});

	it('should return false when event binding config is incomplete in controlListener', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		taskContext.set('incomplete-listener-task', {
			taskId: 'incomplete-listener-task',
			withEvent: true
		});

		const result = taskRunner.controlListener('incomplete-listener-task', Action.OPEN);
		expect(result).toBe(false);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('has no event binding configured')
		);
	});

	it('should skip OPEN when controller already exists in controlListener', () => {
		const addEventSpy = vi.spyOn(Element.prototype, 'addEventListener');
		taskContext.set('opened-task', {
			taskId: 'opened-task',
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn(),
			controller: new AbortController()
		});

		const result = taskRunner.controlListener('opened-task', Action.OPEN);
		expect(result).toBe(false);
		expect(addEventSpy).not.toHaveBeenCalled();
	});

	it('should keep returning false when CLOSE is called without controller', () => {
		taskContext.set('closed-task', {
			taskId: 'closed-task',
			withEvent: true,
			listenAt: '#btn',
			event: 'click',
			callback: vi.fn()
		});

		const result = taskRunner.controlListener('closed-task', Action.CLOSE);
		expect(result).toBe(false);
	});

	it('should use onDomReady fallback when listen target does not exist in OPEN', () => {
		const readySpy = vi.spyOn(DOMWatcher, 'onDomReady').mockImplementation((_, cb) => {
			const el = document.createElement('button');
			cb(el);
			return () => {};
		});
		taskContext.set('fallback-open-task', {
			taskId: 'fallback-open-task',
			withEvent: true,
			listenAt: '#non-existing-btn',
			event: 'click',
			callback: vi.fn()
		});

		const result = taskRunner.controlListener('fallback-open-task', Action.OPEN);
		expect(result).toBe(true);
		expect(readySpy).toHaveBeenCalledOnce();
		expect(taskContext.get('fallback-open-task')?.controller).toBeInstanceOf(AbortController);
	});

	it('should set task idle when component taskId field is empty in onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		taskContext.set('broken-task-key', {
			taskId: '',
			taskStatus: 'pending',
			componentName: 'BrokenComp',
			componentInjectAt: '#host',
			component: { name: 'BrokenComp', render: () => null }
		});

		taskRunner.onTargetReady(host, 'broken-task-key');
		expect(taskContext.get('broken-task-key')?.taskStatus).toBe('idle');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('No component found for task')
		);
	});

	it('should set task idle when component mount throws in onTargetReady', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		taskContext.set('mount-error-task', {
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
		});

		taskRunner.onTargetReady(host, 'mount-error-task');
		expect(taskContext.get('mount-error-task')?.taskStatus).toBe('idle');
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Component mount failed for task'),
			expect.any(Error)
		);
	});

	it('should use document root for onDomAlive when scope is global', async () => {
		const host = document.createElement('div');
		host.id = 'global-alive-host';
		document.body.appendChild(host);

		const aliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});
		taskContext.set('global-alive-task', {
			taskId: 'global-alive-task',
			taskStatus: 'idle',
			componentName: 'GlobalAliveComp',
			componentInjectAt: '#global-alive-host',
			component: { name: 'GlobalAliveComp', render: () => null },
			alive: true,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'global'
		});

		taskRunner.onTargetReady(host, 'global-alive-task');
		await nextTick();

		expect(aliveSpy).toHaveBeenCalledOnce();
		expect(aliveSpy.mock.calls[0][4]).toBe(document);
	});

	it('should call stopHandler when alive setup becomes stale after onDomAlive call', async () => {
		const host = document.createElement('div');
		host.id = 'stale-alive-host';
		document.body.appendChild(host);

		taskContext.set('stale-alive-task', {
			taskId: 'stale-alive-task',
			taskStatus: 'idle',
			componentName: 'StaleAliveComp',
			componentInjectAt: '#stale-alive-host',
			component: { name: 'StaleAliveComp', render: () => null },
			alive: true,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const stopHandler = vi.fn();
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(() => {
			const ctx = taskContext.get('stale-alive-task');
			if (ctx) {
				ctx.aliveEpoch = (ctx.aliveEpoch ?? 0) + 1;
			}
			return stopHandler;
		});

		taskRunner.onTargetReady(host, 'stale-alive-task');
		await nextTick();

		expect(stopHandler).toHaveBeenCalledOnce();
		expect(taskContext.get('stale-alive-task')?.isObserver).toBe(false);
	});

	it('should short-circuit alive setup when alive is cancelled before nextTick', async () => {
		const host = document.createElement('div');
		host.id = 'cancel-alive-host';
		document.body.appendChild(host);

		const onDomAliveSpy = vi.spyOn(DOMWatcher, 'onDomAlive').mockReturnValue(() => {});
		taskContext.set('cancel-alive-task', {
			taskId: 'cancel-alive-task',
			taskStatus: 'idle',
			componentName: 'CancelAliveComp',
			componentInjectAt: '#cancel-alive-host',
			component: { name: 'CancelAliveComp', render: () => null },
			alive: true,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		taskRunner.onTargetReady(host, 'cancel-alive-task');
		const context = taskContext.get('cancel-alive-task');
		if (context) {
			context.alive = false;
		}
		await nextTick();

		expect(onDomAliveSpy).not.toHaveBeenCalled();
		expect(taskContext.get('cancel-alive-task')?.isObserver).toBe(false);
	});

	it('should call reset and onTargetReady from onDomAlive callbacks', async () => {
		const host = document.createElement('div');
		host.id = 'alive-callback-host';
		document.body.appendChild(host);

		taskContext.set('alive-callback-task', {
			taskId: 'alive-callback-task',
			taskStatus: 'idle',
			componentName: 'AliveCallbackComp',
			componentInjectAt: '#alive-callback-host',
			component: { name: 'AliveCallbackComp', render: () => null },
			alive: true,
			isObserver: false,
			aliveEpoch: 0,
			scope: 'local'
		});

		const resetSpy = vi.spyOn(taskContext, 'reset');
		vi.spyOn(DOMWatcher, 'onDomAlive').mockImplementation(
			(_matchedElement, _injectAt, onRemove, onRestore) => {
				onRemove();
				const ctx = taskContext.get('alive-callback-task');
				if (ctx) {
					ctx.alive = false;
				}
				onRestore(document.createElement('div'));
				return () => {};
			}
		);

		taskRunner.onTargetReady(host, 'alive-callback-task');
		await nextTick();

		expect(resetSpy).toHaveBeenCalledWith('alive-callback-task');
		expect(taskContext.get('alive-callback-task')?.taskStatus).toBe('idle');
	});
});
