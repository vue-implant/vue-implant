/// <reference types="vitest/config" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref, type WatchHandle } from 'vue';
import { DOMWatcher } from '../src/core/DomWatcher';
import { Injector } from '../src/core/Injector';
import type { TaskContext } from '../src/core/TaskContext';
import { Action, type RegisterResult } from '../src/type';

describe('Injector', () => {
	let injector: Injector;
	let taskContext: TaskContext;
	beforeEach(() => {
		injector = new Injector();
		taskContext = injector.getTaskContext() as TaskContext;
		document.body.innerHTML = '';
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	describe('constructor', () => {
		it('should create an instance of Injector', () => {
			expect(injector).toBeInstanceOf(Injector);
		});

		it('should accept partial config without error', () => {
			expect(() => new Injector({ timeout: 10000 })).not.toThrow();
		});

		it('should accept full config without error', () => {
			expect(
				() => new Injector({ alive: true, scope: 'global', timeout: 3000 })
			).not.toThrow();
		});

		it('should apply custom timeout — warn appears earlier with shorter timeout', () => {
			vi.useFakeTimers();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const fast = new Injector({ timeout: 100 });
			fast.register('#nonexistent', { name: 'T' });
			fast.run();

			vi.advanceTimersByTime(200);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found within 100ms'));

			vi.useRealTimers();
		});

		it('should apply custom timeout — default 5000ms does not warn before that', () => {
			vi.useFakeTimers();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			injector.register('#nonexistent', { name: 'T' });
			injector.run();

			vi.advanceTimersByTime(1000);
			expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('not found within'));

			vi.useRealTimers();
		});
	});

	describe('register', () => {
		it('should return RegisterResult with correct id format (name@selector)', () => {
			const result: RegisterResult = injector.register('#app', {
				name: 'MyComp'
			});

			expect(result.taskId).toBe('MyComp@#app');
			expect(typeof result.keepAlive).toBe('function');
			expect(typeof result.stopAlive).toBe('function');
		});

		it('should use __name when name is not present (SFC-style component)', () => {
			const result = injector.register('#app', { __name: 'SfcComp' });
			expect(result.taskId).toBe('SfcComp@#app');
		});

		it('should generate a unique id for anonymous plain-object component', () => {
			const result = injector.register('#app', {});
			expect(result.taskId).toMatch(/^component-[0-9a-f]+@#app$/);
		});

		it('should generate a unique id for anonymous function component', () => {
			const comp = [() => {}][0];
			const result = injector.register('#app', comp);
			expect(result.taskId).toMatch(/^component-[0-9a-f]+@#app$/);
		});

		it('should reuse the same generated name for the same anonymous component ref', () => {
			const comp = {};
			const r1 = injector.register('#a', comp);
			const r2 = injector.register('#b', comp);

			const name1 = r1.taskId.split('@')[0];
			const name2 = r2.taskId.split('@')[0];
			expect(name1).toBe(name2);
		});

		it('should generate different names for different anonymous components', () => {
			const r1 = injector.register('#a', {});
			const r2 = injector.register('#b', {});

			expect(r1.taskId.split('@')[0]).not.toBe(r2.taskId.split('@')[0]);
		});

		it('should warn and return same id on duplicate registration', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const comp = { name: 'Dup' };

			const first = injector.register('#app', comp);
			const second = injector.register('#app', comp);

			expect(second.taskId).toBe(first.taskId);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
		});

		it('should log on successful first registration', () => {
			const logSpy = vi.mocked(console.log);
			injector.register('#app', { name: 'Comp' });

			expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"Comp@#app" registered'));
		});

		it('should allow run() to succeed after registration (proves taskRecords populated)', () => {
			injector.register('#app', { name: 'X' });
			expect(() => injector.run()).not.toThrow();
		});

		it('duplicate registration should not cause run() to observe twice for the same id', () => {
			vi.useFakeTimers();
			vi.spyOn(console, 'warn').mockImplementation(() => {});

			injector.register('#target', { name: 'D' });
			injector.register('#target', { name: 'D' }); // duplicate

			const el = document.createElement('div');
			el.id = 'target';
			document.body.appendChild(el);

			injector.run();
			vi.useRealTimers();

			const logCalls = vi
				.mocked(console.log)
				.mock.calls.map((c) => c[0] as string)
				.filter((msg) => msg.includes('injected'));
			expect(logCalls.length).toBeLessThanOrEqual(1);
		});

		it('should allow registering multiple different components', () => {
			const r1 = injector.register('#a', { name: 'A' });
			const r2 = injector.register('#b', { name: 'B' });

			expect(r1.taskId).toBe('A@#a');
			expect(r2.taskId).toBe('B@#b');
		});

		it('should skip activity Task and inject not active Task register() after run() has started', () => {
			const taskContext = injector.getTaskContext();
			const div = document.createElement('div');
			div.id = 'late';
			document.body.appendChild(div);

			injector.register('#late', { name: 'LateComp' });
			injector.run();

			injector.register('#late', { name: 'LateComp2' });
			injector.run();

			const lateComp = taskContext?.getTaskStatus('LateComp@#late');
			const lateComp2 = taskContext?.getTaskStatus('LateComp2@#late');

			expect(lateComp).toBe('active');
			expect(lateComp2).toBe('active');
		});

		it('should allow same component at different selectors', () => {
			const comp = { name: 'Shared' };
			const r1 = injector.register('#a', comp);
			const r2 = injector.register('#b', comp);

			expect(r1.taskId).toBe('Shared@#a');
			expect(r2.taskId).toBe('Shared@#b');
		});

		it('destroyed() should not warn about missing task (proves context exists)', () => {
			const { taskId: id } = injector.register('#app', { name: 'Del' });
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			injector.destroyed(id);

			expect(warnSpy).not.toHaveBeenCalledWith(
				expect.stringContaining('may already be destroyed')
			);
		});

		it('returned keepAlive() should not throw for a component task', () => {
			vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { keepAlive } = injector.register('#app', { name: 'KA' });
			expect(() => keepAlive()).not.toThrow();
		});

		it('returned stopAlive() should warn when alive was not started', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { stopAlive } = injector.register('#app', { name: 'SA' });
			stopAlive();
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('no active alive observer')
			);
		});

		it('should enable event binding when on option is provided', () => {
			const btn = document.createElement('button');
			btn.id = 'btn';
			document.body.appendChild(btn);

			const cb = vi.fn();
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'Evt' },
				{
					on: { listenAt: '#btn', type: 'click', callback: cb }
				}
			);

			injector.listenerActivity(id, Action.OPEN);

			btn.click();
			expect(cb).toHaveBeenCalledOnce();
		});

		it('should not have event binding when no on option is provided', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { taskId: id } = injector.register('#app', { name: 'NoEvt' });

			injector.listenerActivity(id, Action.OPEN);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('no event binding configured')
			);
		});
	});
	describe('registerListener', () => {
		it('should register a listener correctly', () => {
			const btn = document.createElement('button');
			btn.id = 'btn';
			document.body.appendChild(btn);
			const cb = vi.fn();
			const result = injector.registerListener('#btn', 'click', cb);
			expect(result).toEqual({ taskId: 'listener-#btn-click', isSuccess: true });
			injector.run();
			btn.click();
			expect(cb).toHaveBeenCalledOnce();
		});
		it('should warn if registering a listener on an element that does not exist', () => {
			vi.useFakeTimers();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			injector.registerListener('#nonexistent', 'click', () => {});
			injector.run();
			vi.advanceTimersByTime(5005);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Element "#nonexistent" not found within')
			);
		});
		it('should set up listener of context task that not component info correctly', () => {
			injector.registerListener('#btn', 'click', () => {});
			const task = taskContext.get('listener-#btn-click');
			expect(task?.component).toBeUndefined();
			expect(task?.componentInjectAt).toBeUndefined();
			expect(task?.componentName).toBeUndefined();
			expect(task?.listenAt).toBe('#btn');
			expect(task?.event).toBe('click');
			expect(task?.callback).toBeInstanceOf(Function);
		});
		it('should warn and return same id on duplicate listener registration', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const first = injector.registerListener('#btn', 'click', () => {});
			const second = injector.registerListener('#btn', 'click', () => {});

			expect(second.taskId).toBe(first.taskId);
			expect(second.isSuccess).toBe(true);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
		});
		it('should set up activitySignal for the listener correctly', async () => {
			const mockRef = ref<boolean>(false);
			const mockRefCb = vi.fn().mockReturnValue(mockRef);
			const btn = document.createElement('button');
			btn.id = 'btn';
			document.body.appendChild(btn);
			const cb = vi.fn();
			injector.registerListener('#btn', 'click', cb, mockRefCb);
			injector.run();

			expect(mockRefCb).toHaveBeenCalledOnce();

			btn.click();
			expect(cb).not.toHaveBeenCalled();

			mockRef.value = true;
			await nextTick();
			btn.click();
			expect(cb).toHaveBeenCalledOnce();
		});

		it('should allow registerListener() after run() and activate on next run', () => {
			const boot = document.createElement('div');
			boot.id = 'boot2';
			document.body.appendChild(boot);

			const lateBtn = document.createElement('button');
			lateBtn.id = 'late-btn';
			document.body.appendChild(lateBtn);

			injector.register('#boot2', { name: 'BootComp2' });
			injector.run();

			const cb = vi.fn();
			const result = injector.registerListener('#late-btn', 'click', cb);
			expect(result.taskId).toBe('listener-#late-btn-click');
			expect(result.isSuccess).toBe(true);

			injector.run();
			lateBtn.click();
			expect(cb).toHaveBeenCalledOnce();
		});
	});
	describe('run', () => {
		it('should call run() correctly without error', () => {
			injector.register('#app', { name: 'RunTest' });
			expect(() => injector.run()).not.toThrow();
		});
		it('should not double inject when double call run()', () => {
			const testInjector = new Injector({
				timeout: 10000
			});
			const onDomReadyspy = vi
				.spyOn(DOMWatcher.prototype, 'onDomReady')
				.mockReturnValue(() => {});
			testInjector.register('#app', { name: 'RunTest' });
			testInjector.run();
			testInjector.run();
			expect(onDomReadyspy).toHaveBeenCalledOnce();
		});
		it('should call run() will throw error if have not task in injector', () => {
			expect(() => injector.run()).toThrow('No registered tasks found');
		});
		it('should allow run() to be called multiple times without throwing', () => {
			injector.register('#app', { name: 'RunMulti' });
			expect(() => {
				injector.run();
				injector.run();
			}).not.toThrow();
		});

		it('should mark task active after run() when target exists', () => {
			const host = document.createElement('div');
			host.id = 'app';
			document.body.appendChild(host);

			const { taskId } = injector.register('#app', { name: 'FlagCheck' });
			injector.run();
			expect(taskContext.getTaskStatus(taskId)).toBe('active');
		});

		it('should call domWatcher.onDomReady once for a single injectPoint with correct args', () => {
			const onDomReadySpy = vi
				.spyOn(DOMWatcher.prototype, 'onDomReady')
				.mockReturnValue(() => {});

			injector.register('#root', { name: 'Single' });
			injector.run();

			expect(onDomReadySpy).toHaveBeenCalledOnce();
			expect(onDomReadySpy).toHaveBeenCalledWith('#root', expect.any(Function), document, {
				once: true,
				timeout: 5000
			});
		});

		it('should call domWatcher.onDomReady once per injectPoint for multiple registrations', () => {
			const onDomReadySpy = vi
				.spyOn(DOMWatcher.prototype, 'onDomReady')
				.mockReturnValue(() => {});

			injector.register('#header', { name: 'CompA' });
			injector.register('#footer', { name: 'CompB' });
			injector.register('#sidebar', { name: 'CompC' });
			injector.run();

			expect(onDomReadySpy).toHaveBeenCalledTimes(3);
			expect(onDomReadySpy).toHaveBeenNthCalledWith(
				1,
				'#header',
				expect.any(Function),
				document,
				{ once: true, timeout: 5000 }
			);
			expect(onDomReadySpy).toHaveBeenNthCalledWith(
				2,
				'#footer',
				expect.any(Function),
				document,
				{ once: true, timeout: 5000 }
			);
			expect(onDomReadySpy).toHaveBeenNthCalledWith(
				3,
				'#sidebar',
				expect.any(Function),
				document,
				{ once: true, timeout: 5000 }
			);
		});

		it('should pass the custom timeout from InjectionConfig to onDomReady', () => {
			const onDomReadySpy = vi
				.spyOn(DOMWatcher.prototype, 'onDomReady')
				.mockReturnValue(() => {});

			const customInjector = new Injector({ timeout: 8000 });
			customInjector.register('#app', { name: 'TimeoutComp' });
			customInjector.run();

			expect(onDomReadySpy).toHaveBeenCalledOnce();
			expect(onDomReadySpy).toHaveBeenCalledWith('#app', expect.any(Function), document, {
				once: true,
				timeout: 8000
			});
		});

		it('should always pass once: true to onDomReady regardless of injectConfig', () => {
			const onDomReadySpy = vi
				.spyOn(DOMWatcher.prototype, 'onDomReady')
				.mockReturnValue(() => {});

			injector.register('#target', { name: 'OnceCheck' });
			injector.run();

			const callArgs = onDomReadySpy.mock.calls[0];
			const options = callArgs[3] as { once: boolean; timeout?: number };
			expect(options.once).toBe(true);
		});

		it('should pass the injectAt selector of each injectPoint as the first arg to onDomReady', () => {
			const onDomReadySpy = vi
				.spyOn(DOMWatcher.prototype, 'onDomReady')
				.mockReturnValue(() => {});

			const selectors = ['#one', '.two', '[data-three]'];
			for (const sel of selectors) {
				injector.register(sel, { name: `Comp-${sel}` });
			}
			injector.run();

			const calledSelectors = onDomReadySpy.mock.calls.map((c) => c[0]);
			expect(calledSelectors).toEqual(selectors);
		});

		it('should not call domWatcher.onDomReady again when task is already active', () => {
			const host = document.createElement('div');
			host.id = 'app';
			document.body.appendChild(host);

			const onDomReadySpy = vi.spyOn(DOMWatcher.prototype, 'onDomReady');

			injector.register('#app', { name: 'NoDupRun' });
			injector.run();
			injector.run();

			expect(onDomReadySpy).toHaveBeenCalledOnce();
		});
	});

	describe('handleInjectionReady (indirect via run)', () => {
		it('should mount component into DOM when target element is ready', () => {
			const host = document.createElement('div');
			host.id = 'inject-host';
			document.body.appendChild(host);

			const { taskId: id } = injector.register('#inject-host', { name: 'ReadyMount' });
			injector.run();

			const context = taskContext.get(id);
			expect(context?.appRoot).toBeInstanceOf(HTMLElement);
			expect(context?.appRoot?.parentElement).toBe(host);
		});

		it('should route to bindActivitySignal when activitySignal is provided', () => {
			const host = document.createElement('div');
			host.id = 'ready-with-signal';
			document.body.appendChild(host);

			const btn = document.createElement('button');
			btn.id = 'btn-signal';
			document.body.appendChild(btn);

			const bindSignalSpy = vi.spyOn(injector, 'bindActivitySignal');
			const listenerSpy = vi.spyOn(injector, 'listenerActivity');
			const signal = ref(true);

			injector.register(
				'#ready-with-signal',
				{ name: 'ReadyWithSignal' },
				{
					on: {
						listenAt: '#btn-signal',
						type: 'click',
						callback: vi.fn(),
						activitySignal: () => signal
					}
				}
			);

			injector.run();

			expect(bindSignalSpy).toHaveBeenCalledOnce();
			expect(listenerSpy).not.toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ type: Action.OPEN })
			);
		});

		it('should call listenerActivity OPEN directly when activitySignal is not provided', () => {
			const host = document.createElement('div');
			host.id = 'ready-open';
			document.body.appendChild(host);

			const btn = document.createElement('button');
			btn.id = 'btn-open';
			document.body.appendChild(btn);

			const listenerSpy = vi.spyOn(injector, 'listenerActivity');

			const { taskId: id } = injector.register(
				'#ready-open',
				{ name: 'ReadyOpen' },
				{
					on: {
						listenAt: '#btn-open',
						type: 'click',
						callback: vi.fn()
					}
				}
			);

			injector.run();

			expect(listenerSpy).toHaveBeenCalledWith(id, Action.OPEN);
		});

		it('registerListener task should bind event without mounting component', () => {
			const btn = document.createElement('button');
			btn.id = 'listener-only';
			document.body.appendChild(btn);

			const addSpy = vi.spyOn(btn, 'addEventListener');
			const cb = vi.fn();
			const { taskId: id } = injector.registerListener('#listener-only', 'click', cb);
			injector.run();

			const context = taskContext.get(id);
			expect(context?.app).toBeUndefined();
			expect(context?.appRoot).toBeUndefined();
			expect(addSpy).toHaveBeenCalledWith(
				'click',
				expect.any(Function),
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			);
		});
	});

	describe('listenerActivity', () => {
		it('Action.OPEN should bind event and save controller', () => {
			const btn = document.createElement('button');
			btn.id = 'open-bind';
			document.body.appendChild(btn);

			const addSpy = vi.spyOn(btn, 'addEventListener');
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'OpenBind' },
				{
					on: { listenAt: '#open-bind', type: 'click', callback: vi.fn() }
				}
			);

			injector.listenerActivity(id, Action.OPEN);

			expect(addSpy).toHaveBeenCalledOnce();
			expect(taskContext.get(id)?.controller).toBeInstanceOf(AbortController);
		});

		it('Action.OPEN repeated should not bind again when controller exists', () => {
			const btn = document.createElement('button');
			btn.id = 'open-repeat';
			document.body.appendChild(btn);

			const addSpy = vi.spyOn(btn, 'addEventListener');
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'OpenRepeat' },
				{
					on: { listenAt: '#open-repeat', type: 'click', callback: vi.fn() }
				}
			);

			injector.listenerActivity(id, Action.OPEN);
			injector.listenerActivity(id, Action.OPEN);

			expect(addSpy).toHaveBeenCalledOnce();
		});

		it('Action.CLOSE should call controller.abort and clear controller', () => {
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'CloseAction' },
				{
					on: { listenAt: '#close-target', type: 'click', callback: vi.fn() }
				}
			);
			const controller = new AbortController();
			const abortSpy = vi.spyOn(controller, 'abort');
			const context = taskContext.get(id);
			if (!context) throw new Error('Task context not found');
			context.controller = controller;

			injector.listenerActivity(id, Action.CLOSE);

			expect(abortSpy).toHaveBeenCalledOnce();
			expect(context.controller).toBeUndefined();
		});

		it('should warn for task without event configuration', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { taskId: id } = injector.register('#app', { name: 'NoEventConfig' });

			injector.listenerActivity(id, Action.OPEN);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('has no event binding configured')
			);
		});

		it('should warn for unknown action type', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'UnknownAction' },
				{
					on: { listenAt: '#ua', type: 'click', callback: vi.fn() }
				}
			);

			injector.listenerActivity(id, 'UNKNOWN' as Action);

			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Unknown action type "UNKNOWN"')
			);
		});
	});

	describe('bindActivitySignal', () => {
		it('should trigger OPEN when signal becomes true and CLOSE when false', async () => {
			const signal = ref(false);
			const spy = vi.spyOn(injector, 'listenerActivity');
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'SignalFlow' },
				{
					on: { listenAt: '#sig', type: 'click', callback: vi.fn() }
				}
			);

			injector.bindActivitySignal(id, signal);

			signal.value = true;
			await nextTick();
			signal.value = false;
			await nextTick();

			expect(spy).toHaveBeenCalledWith(id, Action.CLOSE);
			expect(spy).toHaveBeenCalledWith(id, Action.OPEN);
			expect(spy).toHaveBeenCalledTimes(3);
		});

		it('should stop old watcher before creating new watcher', () => {
			const signal = ref(false);
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'RebindSignal' },
				{
					on: { listenAt: '#sig2', type: 'click', callback: vi.fn() }
				}
			);

			const oldWatcher = vi.fn();
			const context = taskContext.get(id);
			if (!context) throw new Error('Task context not found');
			context.watcher = oldWatcher as unknown as WatchHandle;

			injector.bindActivitySignal(id, signal);

			expect(oldWatcher).toHaveBeenCalledOnce();
			expect(context.watcher).toBeInstanceOf(Function);
		});

		it('should run immediately once when binding (immediate: true)', () => {
			const signal = ref(true);
			const spy = vi.spyOn(injector, 'listenerActivity');
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'ImmediateSignal' },
				{
					on: { listenAt: '#sig3', type: 'click', callback: vi.fn() }
				}
			);

			injector.bindActivitySignal(id, signal);

			expect(spy).toHaveBeenCalledWith(id, Action.OPEN);
		});
	});

	describe('injectComponent (indirect via run and DOM)', () => {
		it('should append created appRoot div under matchedElement', () => {
			const host = document.createElement('div');
			host.id = 'mount-host';
			document.body.appendChild(host);

			const { taskId: id } = injector.register('#mount-host', { name: 'MountTarget' });
			injector.run();

			const context = taskContext.get(id);
			expect(context?.appRoot).toBeTruthy();
			expect(context?.appRoot?.parentElement).toBe(host);
			expect(context?.appRoot?.id.startsWith('vue-injector-')).toBe(true);
		});

		it('should skip injection when matchedElement is detached from DOM', () => {
			const detached = document.createElement('div');
			detached.id = 'detached-host';

			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			vi.spyOn(DOMWatcher.prototype, 'onDomReady').mockImplementation((_, cb) => {
				cb(detached);
				return () => {};
			});

			const { taskId: id } = injector.register('#detached-host', { name: 'DetachedComp' });
			injector.run();

			expect(taskContext.get(id)?.app).toBeUndefined();
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('detached from DOM, injection skipped')
			);
		});

		it('should ignore second ready callback when task is already active', () => {
			const host = document.createElement('div');
			host.id = 'already-mounted';
			document.body.appendChild(host);

			let cbRef: ((el: HTMLElement) => void) | undefined;
			vi.spyOn(DOMWatcher.prototype, 'onDomReady').mockImplementation((_, cb) => {
				cbRef = cb;
				return () => {};
			});

			injector.register('#already-mounted', {
				name: 'AlreadyMounted',
				render: () => null
			});
			injector.run();

			if (!cbRef) throw new Error('onDomReady callback should be captured');
			cbRef(host);
			const firstChildCount = host.childElementCount;
			cbRef(host);

			expect(host.childElementCount).toBe(firstChildCount);
		});

		it('alive=true should start onDomAlive observer after successful injection', async () => {
			const host = document.createElement('div');
			host.id = 'alive-inject';
			document.body.appendChild(host);

			const onDomAliveSpy = vi
				.spyOn(DOMWatcher.prototype, 'onDomAlive')
				.mockReturnValue(() => {});

			injector.register('#alive-inject', { name: 'AliveInject' }, { alive: true });
			injector.run();
			await nextTick();

			expect(onDomAliveSpy).toHaveBeenCalledOnce();
		});

		it('should catch mount error and remove appRoot', () => {
			const host = document.createElement('div');
			host.id = 'mount-error';
			document.body.appendChild(host);

			const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const { taskId: id } = injector.register('#mount-error', {
				name: 'MountErrorComp',
				setup() {
					throw new Error('mount failed');
				}
			});
			injector.run();

			expect(errorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Component mount failed for task'),
				expect.any(Error)
			);
			expect(taskContext.get(id)?.appRoot).toBeUndefined();
			expect(host.querySelector('[id^="vue-injector-"]')).toBeNull();
		});
	});

	describe('destroyed / destroyedAll', () => {
		it('destroyed should stop alive task first, then call taskContext.destroy', () => {
			const { taskId: id } = injector.register(
				'#app',
				{ name: 'DestroyOne' },
				{ alive: true }
			);
			const context = taskContext.get(id);
			if (!context) throw new Error('Task context not found');
			context.alive = true;

			const stopAliveSpy = vi.spyOn(injector, 'stopAlive');
			const destroySpy = vi.spyOn(taskContext, 'destroy');

			injector.destroyed(id);

			expect(stopAliveSpy).toHaveBeenCalledWith(id);
			expect(destroySpy).toHaveBeenCalledWith(id);
			expect(stopAliveSpy.mock.invocationCallOrder[0]).toBeLessThan(
				destroySpy.mock.invocationCallOrder[0]
			);
			expect(taskContext.get(id)).toBeUndefined();
		});

		it('destroyedAll should stop alive tasks then clear all contexts', () => {
			const aliveA = injector.register('#a', { name: 'AliveA' }, { alive: true }).taskId;
			const aliveB = injector.register('#b', { name: 'AliveB' }, { alive: true }).taskId;
			const normal = injector.register('#c', { name: 'NormalC' }).taskId;

			const a = taskContext.get(aliveA);
			const b = taskContext.get(aliveB);
			if (!a || !b) throw new Error('Alive contexts should exist');
			a.alive = true;
			b.alive = true;

			const stopAliveSpy = vi.spyOn(injector, 'stopAlive');
			const destroyAllSpy = vi.spyOn(taskContext, 'destroyedAll');

			injector.destroyedAll();

			expect(stopAliveSpy).toHaveBeenCalledWith(aliveA);
			expect(stopAliveSpy).toHaveBeenCalledWith(aliveB);
			expect(stopAliveSpy).not.toHaveBeenCalledWith(normal);
			expect(destroyAllSpy).toHaveBeenCalledOnce();
			expect(taskContext.get(aliveA)).toBeUndefined();
			expect(taskContext.get(aliveB)).toBeUndefined();
			expect(taskContext.get(normal)).toBeUndefined();
		});
	});

	describe('reseted / resetedAll', () => {
		it('reseted should stop alive task first, then call taskContext.resetState', () => {
			const { taskId: id } = injector.register('#app', { name: 'ResetOne' }, { alive: true });
			const context = taskContext.get(id);
			if (!context) throw new Error('Task context not found');
			context.alive = true;

			const stopAliveSpy = vi.spyOn(injector, 'stopAlive');
			const resetStateSpy = vi.spyOn(taskContext, 'resetState');

			injector.reseted(id);

			expect(stopAliveSpy).toHaveBeenCalledWith(id);
			expect(resetStateSpy).toHaveBeenCalledWith(id);
			expect(stopAliveSpy.mock.invocationCallOrder[0]).toBeLessThan(
				resetStateSpy.mock.invocationCallOrder[0]
			);
		});

		it('resetedAll should stop alive tasks and call taskContext.resetAll once', () => {
			const aliveA = injector.register(
				'#ra',
				{ name: 'ResetAliveA' },
				{ alive: true }
			).taskId;
			const aliveB = injector.register(
				'#rb',
				{ name: 'ResetAliveB' },
				{ alive: true }
			).taskId;
			const normal = injector.register('#rc', { name: 'ResetNormalC' }).taskId;

			const a = taskContext.get(aliveA);
			const b = taskContext.get(aliveB);
			if (!a || !b) throw new Error('Alive contexts should exist');
			a.alive = true;
			b.alive = true;

			const stopAliveSpy = vi.spyOn(injector, 'stopAlive');
			const resetAllSpy = vi.spyOn(taskContext, 'resetAll');

			injector.resetedAll();

			expect(stopAliveSpy).toHaveBeenCalledWith(aliveA);
			expect(stopAliveSpy).toHaveBeenCalledWith(aliveB);
			expect(stopAliveSpy).not.toHaveBeenCalledWith(normal);
			expect(resetAllSpy).toHaveBeenCalledOnce();
			expect(taskContext.has(aliveA)).toBe(true);
			expect(taskContext.has(aliveB)).toBe(true);
			expect(taskContext.has(normal)).toBe(true);
		});
	});

	describe('setPinia', () => {
		it('should use provided pinia plugin for later injected component', () => {
			const host = document.createElement('div');
			host.id = 'pinia-host';
			document.body.appendChild(host);

			const install = vi.fn();
			const fakePinia = { install };
			injector.setPinia(fakePinia);

			injector.register('#pinia-host', { name: 'PiniaComp' });
			injector.run();

			expect(install).toHaveBeenCalledOnce();
		});
	});
	describe('keepAlive/stopAlive', () => {
		describe('keepAlive', () => {
			it('should warn and return early when called on a pure listener task (no component)', () => {
				const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const { taskId: id } = injector.registerListener('#app', 'click', () => {});
				injector.keepAlive(id);
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('keepAlive is not applicable to non-component task')
				);
			});
			it('should warn and skip when an alive observer is already active (alive=true && isObserver=true)', () => {
				const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const { taskId: id } = injector.register('#app', { name: 'NoDupRun' });
				injector.keepAlive(id);
				injector.keepAlive(id);
				expect(warnSpy).toHaveBeenCalledWith(
					expect.stringContaining('already has an active alive observer')
				);
			});
			it('should increment aliveEpoch each time keepAlive is called', () => {
				const { taskId: id } = injector.register('#app', { name: 'NoDupRun' });
				const epoch = taskContext.get(id)?.aliveEpoch;
				expect(epoch).toBe(0);
				injector.keepAlive(id);
				const epoch2 = taskContext.get(id)?.aliveEpoch;
				expect(epoch2).toBe(1);
			});

			describe('Case 1 — component already mounted and appRoot.isConnected', () => {
				it('should call domWatcher.onDomAlive after nextTick when component is mounted and connected', async () => {
					const div = document.createElement('div');
					div.id = 'app';
					document.body.appendChild(div);

					const onDomAliveSpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomAlive')
						.mockReturnValue(() => {});
					const testInjector = new Injector({ alive: true });
					testInjector.register('#app', { name: 'NoDupRun' }, { alive: true });
					testInjector.run();

					await nextTick();
					expect(onDomAliveSpy).toHaveBeenCalledOnce();
				});
				it('should pass the matched host element and injectAt selector to onDomAlive', async () => {
					const div = document.createElement('div');
					div.id = 'app';
					document.body.appendChild(div);

					const onDomAliveSpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomAlive')
						.mockReturnValue(() => {});
					const testInjector = new Injector({ alive: true });
					testInjector.register('#app', { name: 'NoDupRun' });
					testInjector.run();

					await nextTick();

					const [el, selector, , , root, opts] = onDomAliveSpy.mock.calls[0];
					expect(el).toBeInstanceOf(HTMLElement);
					expect(el).toBe(div);
					expect(selector).toBe('#app');
					expect(root).toBe(div);
					expect(opts).toEqual({ once: true, timeout: 5000 });
				});
				it('should use document as root when scope is "global"', async () => {
					const div = document.createElement('div');
					div.id = 'app';
					document.body.appendChild(div);

					const onDomAliveSpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomAlive')
						.mockReturnValue(() => {});
					const testInjector = new Injector({ alive: true });
					testInjector.register(
						'#app',
						{ name: 'NoDupRun' },
						{ alive: true, scope: 'global' }
					);
					testInjector.run();

					await nextTick();
					const [el, selector, , , root, opts] = onDomAliveSpy.mock.calls[0];
					expect(el).toBeInstanceOf(HTMLElement);
					expect(el).toBe(document.getElementById('app'));
					expect(selector).toBe('#app');
					expect(root).toBe(document);
					expect(opts).toEqual({ once: true, timeout: 5000 });
				});
				it('should use matchedElement as root when scope is "local"', async () => {
					const div = document.createElement('div');
					div.id = 'app';
					document.body.appendChild(div);

					const onDomAliveSpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomAlive')
						.mockReturnValue(() => {});

					const testInjector = new Injector({ alive: true });
					testInjector.register(
						'#app',
						{ name: 'NoDupRun' },
						{ alive: true, scope: 'local' }
					);
					testInjector.run();

					await nextTick();

					const [el, selector, , , root, opts] = onDomAliveSpy.mock.calls[0];
					expect(root).toBe(div);
					expect(el).toBeInstanceOf(HTMLElement);
					expect(el).toBe(div);
					expect(selector).toBe('#app');
					expect(opts).toEqual({ once: true, timeout: 5000 });
				});
				it('should set isObserver=true and assign stopAlive handler after onDomAlive is called', async () => {
					const div = document.createElement('div');
					div.id = 'app';
					document.body.appendChild(div);

					injector.register('#app', { name: 'NoDupRun' }, { alive: true });
					injector.run();

					await nextTick();

					const taskContext = injector.getTaskContext();
					const ctx = taskContext?.get('NoDupRun@#app');
					expect(ctx?.isObserver).toBe(true);
					expect(ctx?.stopAlive).toBeInstanceOf(Function);
				});

				it('should abort setup and call the returned stopHandler if alive was cancelled during nextTick', async () => {
					const div = document.createElement('div');
					div.id = 'abort-test';
					document.body.appendChild(div);

					const onDomAliveSpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomAlive')
						.mockReturnValue(vi.fn());

					const { taskId: id } = injector.register('#abort-test', {
						name: 'AbortTest'
					});
					injector.run();

					// Cancel alive synchronously before nextTick fires,
					// simulating "alive was cancelled during nextTick"
					injector.keepAlive(id);
					injector.stopAlive(id);

					await nextTick();

					// The first guard (!context.alive) in the nextTick callback should
					// short-circuit immediately, so onDomAlive must never be called
					expect(onDomAliveSpy).not.toHaveBeenCalled();
					expect(taskContext.get(id)?.isObserver).toBe(false);
				});
				it('should abort setup if aliveEpoch changed during nextTick (stale epoch guard)', async () => {
					const div = document.createElement('div');
					div.id = 'epoch-guard';
					document.body.appendChild(div);

					const { taskId: id } = injector.register(
						'#epoch-guard',
						{
							name: 'EpochGuard'
						},
						{ alive: true, scope: 'local' }
					);
					injector.run();

					const fakeStopHandler = vi.fn();
					// Mock onDomAlive to simulate epoch changing *after* onDomAlive is called
					// but before isObserver is assigned (i.e. the second guard is the one that fires)
					vi.spyOn(DOMWatcher.prototype, 'onDomAlive').mockImplementation(() => {
						// Calling keepAlive again bumps aliveEpoch, making the current epoch stale
						injector.keepAlive(id);
						return fakeStopHandler;
					});

					injector.keepAlive(id);
					await nextTick();

					// The second guard inside the nextTick callback detects a stale epoch and
					// must call the returned stopHandler to clean up the observer
					expect(fakeStopHandler).toHaveBeenCalledOnce();
					// isObserver must remain false because the stale setup was aborted
					expect(taskContext.get(id)?.isObserver).toBe(false);
				});
			});

			describe('Case 2 — component not yet mounted (app is undefined)', () => {
				it('should call domWatcher.onDomReady to wait for the target element when app is undefined', () => {
					const onDomReadySpy = vi.spyOn(DOMWatcher.prototype, 'onDomReady');
					const { taskId: id } = injector.register('#app', { name: 'App' });
					injector.keepAlive(id);

					expect(onDomReadySpy).toHaveBeenCalledOnce();
				});
				it('should set isObserver=true and assign a cancellable stopAlive handler', () => {
					const { taskId: id } = injector.register('#app', { name: 'App' });
					injector.keepAlive(id);

					expect(taskContext.get(id)?.isObserver).toBe(true);
					expect(taskContext.get(id)?.stopAlive).toBeInstanceOf(Function);
				});
				it('should not invoke handleInjectionReady if the observer was cancelled before element appears', () => {
					const stopHandler = vi.fn();
					const onDomReadySpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomReady')
						.mockReturnValue(stopHandler);
					const handleInjectionReadySpy = vi.spyOn(
						injector as unknown as {
							handleInjectionReady: (...args: unknown[]) => unknown;
						},
						'handleInjectionReady'
					);

					const { taskId: id, stopAlive } = injector.register('#app', { name: 'App' });
					injector.keepAlive(id);
					stopAlive();

					expect(onDomReadySpy).toHaveBeenCalled();
					expect(stopHandler).toHaveBeenCalled();
					expect(handleInjectionReadySpy).not.toHaveBeenCalled();
				});
				it('should not invoke handleInjectionReady if aliveEpoch changed before element appears', () => {
					const div = document.createElement('div');
					div.id = 'app';
					document.body.appendChild(div);

					const stopHandler = () => {};

					const onDomReadySpy = vi
						.spyOn(DOMWatcher.prototype, 'onDomReady')
						.mockImplementation((selector, cb, document, opts) => {
							const ctx = taskContext.get(id);
							if (ctx?.aliveEpoch) ctx.aliveEpoch += 1;
							cb(div);
							return stopHandler;
						});

					const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

					const handleInjectionReadySpy = vi.spyOn(
						injector as unknown as {
							handleInjectionReady: (...args: unknown[]) => unknown;
						},
						'handleInjectionReady'
					);

					const { taskId: id } = injector.register('#app', { name: 'App' });
					injector.keepAlive(id);

					expect(consoleSpy).toHaveBeenCalledWith(
						expect.stringContaining('alive epoch changed before element appears')
					);
					expect(onDomReadySpy).toHaveBeenCalled();
					expect(handleInjectionReadySpy).not.toHaveBeenCalled();
				});
			});
		});

		describe('stopAlive', () => {
			it('should warn when stopAlive is called and alive is false', () => {
				const div = document.createElement('div');
				div.id = 'app';
				document.body.appendChild(div);

				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

				const { stopAlive } = injector.register('#app', { name: 'App' }, { alive: false });
				stopAlive();

				expect(consoleSpy).toHaveBeenCalledWith(
					expect.stringContaining('has no active alive observer to stop')
				);
			});
			it('should set alive=false and isObserver=false after stopAlive is called', () => {
				const div = document.createElement('div');
				div.id = 'app';
				document.body.appendChild(div);

				const { stopAlive } = injector.register('#app', { name: 'App' }, { alive: true });
				stopAlive();

				const taskContext = injector.getTaskContext();
				expect(taskContext?.get('App@#app')?.alive).toBe(false);
				expect(taskContext?.get('App@#app')?.isObserver).toBe(false);
			});

			it('should set stopAlive handler to undefined after stopAlive is called', () => {
				const div = document.createElement('div');
				div.id = 'app';
				document.body.appendChild(div);

				const { stopAlive } = injector.register('#app', { name: 'App' }, { alive: true });
				stopAlive();

				const taskContext = injector.getTaskContext();
				expect(taskContext?.get('App@#app')?.stopAlive).toBeUndefined();
			});
			it('should increment aliveEpoch when stopAlive is called to invalidate in-flight async callbacks', async () => {
				const div = document.createElement('div');
				div.id = 'app';
				document.body.appendChild(div);

				const { stopAlive } = injector.register('#app', { name: 'App' }, { alive: true });
				injector.run();

				stopAlive();

				await nextTick();

				const taskContext = injector.getTaskContext();
				expect(taskContext?.get('App@#app')?.aliveEpoch).toBe(1);
			});
			it('should invoke the stored stopAlive handler to tear down the active observer', () => {
				const div = document.createElement('div');
				div.id = 'app';
				document.body.appendChild(div);

				const fakeStopHandler = vi.fn();
				const { taskId: id } = injector.register('#app', { name: 'App' }, { alive: true });

				const taskContext = injector.getTaskContext();
				const ctx = taskContext?.get(id);
				if (!ctx) throw new Error('Task context should exist for registered component');

				ctx.stopAlive = fakeStopHandler;
				ctx.alive = true;
				ctx.isObserver = true;

				injector.stopAlive(id);

				expect(fakeStopHandler).toHaveBeenCalledOnce();
				expect(ctx.alive).toBe(false);
				expect(ctx.isObserver).toBe(false);
				expect(ctx.stopAlive).toBeUndefined();
			});
		});
	});
});
