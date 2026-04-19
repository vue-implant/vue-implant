import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { ObserverHub } from '../src/core/hooks/ObserverHub';
import type { ObserveEvent } from '../src/core/hooks/type';
import { createObserveEmitter } from '../src/core/hooks/util';
import { Logger } from '../src/core/logger/Logger';
import { TaskContext } from '../src/core/Task/TaskContext';
import { TaskRegister } from '../src/core/Task/TaskRegister';
import type { ArtifactTask } from '../src/core/Task/types';
import { createTask, createVueComponent } from './factory/TaskFactor';

describe('TaskRegister', () => {
	let taskContext: TaskContext;
	let taskRegister: TaskRegister;

	beforeEach(() => {
		const observer = new ObserverHub();
		taskContext = new TaskContext();
		taskRegister = new TaskRegister(
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
		vi.restoreAllMocks();
	});

	it('should register a component task with defaults', () => {
		const component = createVueComponent('CompA');
		const result = taskRegister.register('#app', component);
		const context = taskContext.get(result.taskId);

		expect(result).toEqual({ taskId: 'CompA@#app', isSuccess: true });
		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'CompA@#app',
			artifactName: 'CompA',
			injectAt: '#app',
			artifact: component,
			timeout: 5000,
			isObserver: false,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			}
		});
		expect(taskContext.taskRecords).toEqual([{ taskId: 'CompA@#app', injectAt: '#app' }]);
	});

	it('should use option override for alive and scope', () => {
		const component = createVueComponent('CompB');
		const result = taskRegister.register('#root', component, { alive: true, scope: 'global' });
		const context = taskContext.get(result.taskId);

		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'CompB@#root',
			artifactName: 'CompB',
			injectAt: '#root',
			artifact: component,
			alive: true,
			scope: 'global',
			timeout: 5000,
			isObserver: false,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			}
		});
	});

	it('should store event config and activity signal when provided', () => {
		const component = createVueComponent('CompC');
		const signal = ref(true);
		const activitySignal = () => signal;
		const callback = vi.fn();

		const result = taskRegister.register('#event-host', component, {
			on: {
				listenAt: '#btn',
				type: 'click',
				callback,
				activitySignal
			}
		});

		const context = taskContext.get(result.taskId);
		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'CompC@#event-host',
			artifactName: 'CompC',
			injectAt: '#event-host',
			artifact: component,
			withEvent: true,
			timeout: 5000,
			isObserver: false,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			},
			listener: {
				listenAt: '#btn',
				event: 'click',
				callback,
				activitySignal
			}
		});
	});

	it('should register an artifact task with a custom adapter', () => {
		const artifact = createVueComponent('NativeBadge');

		const result = taskRegister.register('#native-host', artifact, {
			artifactName: 'NativeBadge',
			alive: true,
			scope: 'global'
		});
		const context = taskContext.get<ArtifactTask>(result.taskId);

		expect(result).toEqual({ taskId: 'NativeBadge@#native-host', isSuccess: true });
		expect(context).toMatchObject({
			kind: 'component',
			taskId: 'NativeBadge@#native-host',
			artifactName: 'NativeBadge',
			injectAt: '#native-host',
			artifact,
			adapter: {
				name: 'vue',
				mount: expect.any(Function),
				unmount: expect.any(Function)
			},
			alive: true,
			scope: 'global',
			timeout: 5000,
			isObserver: false
		});
	});

	it('should return existing result for duplicate component registration', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

		const component = createVueComponent('CompDup');
		const first = taskRegister.register('#dup', component);
		const second = taskRegister.register('#dup', component);

		expect(second).toEqual(first);
		expect(taskContext.taskRecords).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
	});

	it('should reuse generated anonymous name for same component reference', () => {
		const anonymous = createVueComponent('anonymous');
		const a = taskRegister.register('#a', anonymous);
		const b = taskRegister.register('#b', anonymous);

		expect(a.taskId.split('@')[0]).toBe(b.taskId.split('@')[0]);
	});

	it('should register listener-only task', () => {
		const callback = vi.fn();
		const result = taskRegister.registerListener('#btn', 'click', callback);
		const context = taskContext.get(result.taskId);

		expect(result).toEqual({ taskId: 'listener-#btn-click', isSuccess: true });
		expect(context).toMatchObject(
			createTask({
				kind: 'listener',
				taskId: 'listener-#btn-click',
				listenAt: '#btn',
				event: 'click',
				callback,
				withEvent: true,
				timeout: 5000
			})
		);
	});

	it('should return existing result for duplicate listener registration', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

		const first = taskRegister.registerListener('#btn', 'click', vi.fn());
		const second = taskRegister.registerListener('#btn', 'click', vi.fn());

		expect(second).toEqual(first);
		expect(taskContext.taskRecords).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
	});

	it('should emit normalized register payloads for component registration', () => {
		const observer = new ObserverHub();
		const registerWithObserver = new TaskRegister(
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
		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		const component = createVueComponent('ObsComp');
		const first = registerWithObserver.register('#obs', component);
		registerWithObserver.register('#obs', component);

		expect(events).toHaveLength(4);

		expect(events[0]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle'
		});
		expect(events[0].meta).toEqual({
			componentName: 'ObsComp',
			listenerEvent: undefined,
			listenAt: undefined,
			alive: false,
			scope: 'local',
			timeout: 5000,
			withEvent: false
		});

		expect(events[1]).toMatchObject({
			name: 'register:success',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle'
		});
		expect(events[1].meta).toEqual({
			componentName: 'ObsComp',
			listenerEvent: undefined,
			listenAt: undefined,
			alive: false,
			scope: 'local',
			timeout: 5000,
			withEvent: false
		});

		expect(events[2]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle'
		});
		expect(events[2].meta).toEqual({
			componentName: 'ObsComp',
			listenerEvent: undefined,
			listenAt: undefined,
			alive: false,
			scope: 'local',
			timeout: 5000,
			withEvent: false
		});

		expect(events[3]).toMatchObject({
			name: 'register:duplicate',
			taskId: first.taskId,
			kind: 'component',
			injectAt: '#obs',
			status: 'idle',
			meta: {
				componentName: 'ObsComp'
			}
		});
		expect(events[3].meta).toEqual({
			componentName: 'ObsComp'
		});
	});

	it('should emit normalized register payloads for listener registration', () => {
		const observer = new ObserverHub();
		const registerWithObserver = new TaskRegister(
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
		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		const first = registerWithObserver.registerListener('#btn-obs', 'click', vi.fn());
		registerWithObserver.registerListener('#btn-obs', 'click', vi.fn());

		expect(events).toHaveLength(4);

		expect(events[0]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle'
		});
		expect(events[0].meta).toEqual({
			componentName: undefined,
			listenerEvent: 'click',
			listenAt: '#btn-obs',
			alive: undefined,
			scope: undefined,
			timeout: undefined,
			withEvent: true
		});

		expect(events[1]).toMatchObject({
			name: 'register:success',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle'
		});
		expect(events[1].meta).toEqual({
			componentName: undefined,
			listenerEvent: 'click',
			listenAt: '#btn-obs',
			alive: undefined,
			scope: undefined,
			timeout: undefined,
			withEvent: true
		});

		expect(events[2]).toMatchObject({
			name: 'register:start',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle'
		});
		expect(events[2].meta).toEqual({
			componentName: undefined,
			listenerEvent: 'click',
			listenAt: '#btn-obs',
			alive: undefined,
			scope: undefined,
			timeout: undefined,
			withEvent: true
		});

		expect(events[3]).toMatchObject({
			name: 'register:duplicate',
			taskId: first.taskId,
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle',
			meta: {
				listenerEvent: 'click'
			}
		});
		expect(events[3].meta).toEqual({
			listenerEvent: 'click'
		});
	});

	it('should emit register:error with normalized payload', () => {
		const observer = new ObserverHub();
		const registerWithObserver = new TaskRegister(
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

		vi.spyOn(taskContext, 'set').mockImplementation((_k, _v) => {
			throw new Error('set error');
		});

		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		registerWithObserver.register('#obs', createVueComponent('ObsComp'));

		const errorEvent = events.find((event) => event.name === 'register:error');
		expect(errorEvent).toBeDefined();
		expect(errorEvent).toMatchObject({
			name: 'register:error',
			taskId: 'ObsComp@#obs',
			kind: 'component',
			injectAt: '#obs',
			status: 'idle',
			meta: {
				componentName: 'ObsComp'
			}
		});
		expect(errorEvent?.error).toBeInstanceOf(Error);
	});

	it('should emit register:error with listener identity payload', () => {
		const observer = new ObserverHub();
		const registerWithObserver = new TaskRegister(
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

		vi.spyOn(taskContext, 'set').mockImplementation((_k, _v) => {
			throw new Error('set error');
		});

		const events: ObserveEvent[] = [];
		observer.onAny((event) => {
			if (event.name.startsWith('register:')) {
				events.push(event);
			}
		});

		registerWithObserver.registerListener('#btn-obs', 'click', vi.fn());

		const errorEvent = events.find((event) => event.name === 'register:error');
		expect(errorEvent).toBeDefined();
		expect(errorEvent).toMatchObject({
			name: 'register:error',
			taskId: 'listener-#btn-obs-click',
			kind: 'listener',
			injectAt: '#btn-obs',
			status: 'idle',
			meta: {
				listenerEvent: 'click'
			}
		});
		expect(errorEvent?.error).toBeInstanceOf(Error);
	});
});
