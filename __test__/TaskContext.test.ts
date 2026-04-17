import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App, ComponentPublicInstance, Ref, WatchHandle } from 'vue';
import { ObserverHub } from '../src/core/hooks/ObserverHub';
import type { ObserveEvent } from '../src/core/hooks/type';
import { TaskContext } from '../src/core/Task/TaskContext';
import type { ComponentTask, Task } from '../src/core/Task/types';
import { createComponentTask, createListenerTask } from './factory/TaskFactor';

describe('TaskContext', () => {
	let taskContext: TaskContext;
	beforeEach(() => {
		taskContext = new TaskContext();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('base curd', () => {
		it('should set and get context correctly', () => {
			const context: Task = createComponentTask({
				taskId: 'test'
			});
			taskContext.set('test', context);
			expect(taskContext.get('test')).toEqual(context);
		});
		it('should return undefined for non-existent key', () => {
			expect(taskContext.get('nonexistent')).toBeUndefined();
		});
		it('should return true for existing key and false for non-existent key in has()', () => {
			const context: Task = createComponentTask({
				taskId: 'test'
			});
			taskContext.set('test', context);
			expect(taskContext.has('test')).toBe(true);
			expect(taskContext.has('nonexistent')).toBe(false);
		});
		it('should delete key correctly', () => {
			const context: Task = createComponentTask({
				taskId: 'test'
			});
			taskContext.set('test', context);
			taskContext.destroy('test');
			expect(taskContext.get('test')).toBeUndefined();
		});
		it('should return keys correctly', () => {
			const context1: Task = createComponentTask({ taskId: 'test1' });
			const context2: Task = createComponentTask({ taskId: 'test2' });
			taskContext.set('test1', context1);
			taskContext.set('test2', context2);
			const keys = Array.from(taskContext.keys());
			expect(keys).toContain('test1');
			expect(keys).toContain('test2');
		});

		it('should clear all contexts', () => {
			const context1: Task = createComponentTask({ taskId: 'test1' });
			const context2: Task = createComponentTask({ taskId: 'test2' });
			taskContext.set('test1', context1);
			taskContext.set('test2', context2);
			taskContext.destroyAll();
			expect(taskContext.get('test1')).toBeUndefined();
			expect(taskContext.get('test2')).toBeUndefined();
		});
	});

	describe('shared plugins', () => {
		it('should register shared plugins in order and ignore duplicates', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const pluginA = { install: vi.fn() };
			const pluginB = { install: vi.fn() };

			taskContext.use(pluginA);
			taskContext.usePlugins(pluginA, pluginB);

			expect(taskContext.getPlugins()).toEqual([pluginA, pluginB]);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Plugin already registered, skipping duplicate')
			);
		});

		it('should keep getPlugins isolated from external mutation', () => {
			const plugin = { install: vi.fn() };
			taskContext.use(plugin);
			const plugins = taskContext.getPlugins();

			plugins.length = 0;

			expect(taskContext.getPlugins()).toEqual([plugin]);
		});

		it('should keep setPinia/getPinia compatible and replace previous pinia plugin', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const otherPlugin = { install: vi.fn() };
			const piniaA = { install: vi.fn() };
			const piniaB = { install: vi.fn() };

			taskContext.use(otherPlugin);
			taskContext.setPinia(piniaA);
			taskContext.setPinia(piniaB);

			expect(taskContext.getPinia()).toBe(piniaB);
			expect(taskContext.getPlugins()).toEqual([otherPlugin, piniaB]);
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Pinia instance already set, overwriting')
			);
		});
	});

	describe('task active state', () => {
		it('should return null for unknown task and read active state for existing task', () => {
			expect(taskContext.getTaskStatus('missing')).toBeUndefined();

			taskContext.set(
				'inactive',
				createComponentTask({
					taskId: 'inactive',
					taskStatus: 'idle'
				})
			);
			taskContext.set(
				'active',
				createComponentTask({
					taskId: 'active',
					taskStatus: 'active'
				})
			);

			expect(taskContext.getTaskStatus('inactive')).toBe('idle');
			expect(taskContext.getTaskStatus('active')).toBe('active');
		});
		it('should set task status correctly', () => {
			taskContext.set(
				'test',
				createComponentTask({
					taskId: 'test',
					taskStatus: 'idle'
				})
			);
			taskContext.setTaskStatus('test', 'active');
			expect(taskContext.getTaskStatus('test')).toBe('active');
		});

		it('should emit normalized task status change payloads', () => {
			const observer = new ObserverHub();
			const observed = new TaskContext((name, payload) => {
				observer.emit({
					name,
					ts: Date.now(),
					...(payload ?? {})
				});
			}, undefined);

			observed.set(
				'status-observe-task',
				createListenerTask({
					taskId: 'status-observe-task',
					taskStatus: 'idle',
					withEvent: false,
					listenAt: '#status-observe',
					event: 'click',
					callback: vi.fn()
				})
			);

			const taskEvents: ObserveEvent[] = [];
			observer.onAny((event) => {
				if (event.name.startsWith('task:')) {
					taskEvents.push(event);
				}
			});

			observed.setTaskStatus('status-observe-task', 'pending');
			observed.setTaskStatus('status-observe-task', 'active');

			expect(
				taskEvents.find(
					(event) =>
						event.name === 'task:statusChange' &&
						event.taskId === 'status-observe-task' &&
						event.status === 'pending'
				)
			).toMatchObject({
				name: 'task:statusChange',
				taskId: 'status-observe-task',
				kind: 'listener',
				injectAt: '#status-observe',
				status: 'pending',
				preStatus: 'idle'
			});

			expect(
				taskEvents.find(
					(event) =>
						event.name === 'task:active' && event.taskId === 'status-observe-task'
				)
			).toMatchObject({
				name: 'task:active',
				taskId: 'status-observe-task',
				kind: 'listener',
				injectAt: '#status-observe',
				status: 'active',
				preStatus: 'pending'
			});
		});
	});

	describe('destroy', () => {
		it('should delete context of none existing id correctly', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			taskContext.destroy('nonexistent');
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
		});
		it('should delete context of existing id correctly', () => {
			const context: Task = createComponentTask({ taskId: 'test' });
			taskContext.set('test', context);
			taskContext.destroy('test');
			expect(taskContext.get('test')).toBeUndefined();
		});
		it('should delete taskRecords and taskErrorMessages of existing id correctly', () => {
			const context: Task = createComponentTask({ taskId: 'test' });
			taskContext.set('test', context);
			taskContext.taskRecords.push({ taskId: 'test', injectAt: 'inject_test' });
			taskContext.taskErrorMessages.push({ taskId: 'test', injectAt: 'inject_test' });
			taskContext.destroy('test');
			expect(taskContext.taskRecords).toHaveLength(0);
			expect(taskContext.taskErrorMessages).toHaveLength(0);
		});
		it('should destroy context of watcher correctly', () => {
			const spy = vi.fn(() => {});

			const mockWatcher = spy as unknown as WatchHandle;

			const context: Task = createComponentTask({
				taskId: 'test',
				watcher: {
					watcher: mockWatcher,
					watchSource: () => true
				}
			});

			taskContext.set('test', context);
			taskContext.destroy('test');

			expect(spy).toHaveBeenCalled();
		});
		it('should destroy context of listener correctly', () => {
			const mockFn = vi.fn(() => {});
			const context: Task = createComponentTask({
				taskId: 'test',
				withEvent: true,
				timeout: 5000,
				alive: false,
				scope: 'local',
				componentName: 'Comp',
				componentInjectAt: '#app',
				component: { name: 'Comp', render: () => null },
				listener: {
					listenAt: 'testListenAt',
					event: 'click',
					callback: () => undefined,
					activitySignal: () => true as unknown as Ref<boolean>,
					controller: {
						abort: mockFn
					} as unknown as AbortController
				}
			});
			const mockObject = vi.mockObject(context, { spy: true });
			taskContext.set('test', mockObject);
			taskContext.destroy('test');
			expect(mockFn).toHaveBeenCalled();
			expect(context.listener).toBeUndefined();
			expect(context.withEvent).toBe(false);
			expect(context.taskId).toBe('test');
		});
		it('should destroy context of component correctly', () => {
			const mockUnmount = vi.fn();
			const mockRemove = vi.fn();

			const context: Task = createComponentTask({
				taskId: 'test',
				componentName: 'TestComponent',
				componentInjectAt: '#app',
				app: {
					unmount: mockUnmount
				} as unknown as App<Element>,
				appRoot: {
					remove: mockRemove
				} as unknown as HTMLElement,
				instance: {} as ComponentPublicInstance
			});

			taskContext.set('test', context);
			taskContext.destroy('test');

			expect(mockUnmount).toHaveBeenCalled();
			expect(context.app).toBeUndefined();
			expect(context.instance).toBeUndefined();

			expect(mockRemove).toHaveBeenCalled();
			expect(context.appRoot).toBeUndefined();

			expect(taskContext.get('test')).toBeUndefined();
		});
		it('should only release watchers and listeners when componentName is missing', () => {
			const mockWatcher = vi.fn() as unknown as WatchHandle;
			const mockAbort = vi.fn();
			const mockUnmount = vi.fn();
			const mockRemove = vi.fn();

			const context: Task = createListenerTask({
				taskId: 'test',
				taskStatus: 'idle',
				timeout: 5000,
				watcher: {
					watcher: mockWatcher,
					watchSource: () => true
				},
				listenAt: 'testListenAt',
				event: 'click',
				callback: () => undefined,
				withEvent: true,
				controller: { abort: mockAbort } as unknown as AbortController
			});

			taskContext.set('test', context);
			taskContext.destroy('test');

			expect(context.watcher).toBeUndefined();
			expect(context.event).toBe('click');
			expect(context.withEvent).toBe(false);

			expect(mockUnmount).not.toHaveBeenCalled();
			expect(mockRemove).not.toHaveBeenCalled();
		});
	});
	describe('destroyAll', () => {
		it('should destroy all contexts correctly', () => {
			const context1: Task = createComponentTask({ taskId: 'test1' });
			const context2: Task = createComponentTask({ taskId: 'test2' });
			taskContext.set('test1', context1);
			taskContext.set('test2', context2);
			taskContext.destroyAll();
			expect(taskContext.get('test1')).toBeUndefined();
			expect(taskContext.get('test2')).toBeUndefined();
		});
		it('should destroy all contexts with taskRecords and taskErrorMessages correctly', () => {
			taskContext.taskRecords.push({ taskId: 'test1', injectAt: 'inject_test1' });
			taskContext.taskRecords.push({ taskId: 'test2', injectAt: 'inject_test2' });
			taskContext.taskErrorMessages.push({ taskId: 'test3', injectAt: 'inject_test3' });
			taskContext.taskErrorMessages.push({ taskId: 'test4', injectAt: 'inject_test4' });
			taskContext.destroyAll();
			expect(taskContext.taskRecords).toHaveLength(0);
			expect(taskContext.taskErrorMessages).toHaveLength(0);
		});
		it('should clear all tasks after destroyAll', () => {
			taskContext.set(
				'destroy-all-a',
				createComponentTask({
					taskId: 'destroy-all-a',
					taskStatus: 'active'
				})
			);
			taskContext.set(
				'destroy-all-b',
				createComponentTask({
					taskId: 'destroy-all-b',
					taskStatus: 'idle'
				})
			);
			taskContext.destroyAll();
			expect(taskContext.get('destroy-all-a')).toBeUndefined();
			expect(taskContext.get('destroy-all-b')).toBeUndefined();
		});
		it('should destroy all contexts with watchers and listeners correctly', () => {
			const mockWatcher1 = vi.fn() as unknown as WatchHandle;
			const mockWatcher2 = vi.fn() as unknown as WatchHandle;
			const mockAbort1 = vi.fn();
			const mockAbort2 = vi.fn();

			const context1: Task = createListenerTask({
				taskId: 'test1',
				taskStatus: 'idle',
				timeout: 5000,
				watcher: {
					watcher: mockWatcher1,
					watchSource: () => true
				},
				listenAt: 'testListenAt1',
				event: 'click',
				callback: () => undefined,
				withEvent: true,
				controller: { abort: mockAbort1 } as unknown as AbortController
			});

			const context2: Task = createListenerTask({
				taskId: 'test2',
				taskStatus: 'idle',
				timeout: 5000,
				watcher: {
					watcher: mockWatcher2,
					watchSource: () => true
				},
				listenAt: 'testListenAt2',
				event: 'mouseover',
				callback: () => undefined,
				withEvent: true,
				controller: { abort: mockAbort2 } as unknown as AbortController
			});

			taskContext.set('test1', context1);
			taskContext.set('test2', context2);
			taskContext.destroyAll();

			expect(mockWatcher1).toHaveBeenCalled();
			expect(mockWatcher2).toHaveBeenCalled();
		});
		it('should not throw an error when contextMap is empty', () => {
			expect(() => taskContext.destroyAll()).not.toThrow();
		});

		it('should clear shared plugins and legacy pinia on destroyAll', () => {
			const plugin = { install: vi.fn() };
			const pinia = { install: vi.fn() };

			taskContext.use(plugin);
			taskContext.setPinia(pinia);
			taskContext.destroyAll();

			expect(taskContext.getPlugins()).toEqual([]);
			expect(taskContext.getPinia()).toBeUndefined();
		});
	});

	describe('releaseComponentInstance', () => {
		it('should unmount app and remove DOM element', () => {
			const mockUnmount = vi.fn();

			const context: Task = createComponentTask({
				taskId: 'test',
				componentName: 'TestComponent',
				componentInjectAt: '#app',
				app: { unmount: mockUnmount } as unknown as App<Element>,
				instance: {} as ComponentPublicInstance
			});

			taskContext.set('test', context);
			taskContext.releaseComponentInstance('test');

			expect(mockUnmount).toHaveBeenCalled();
			expect(context.app).toBeUndefined();
			expect(context.instance).toBeUndefined();
		});
		it('should throw error when unmounting fails', () => {
			const mockUnmount = vi.fn().mockImplementation(() => {
				throw new Error('Unmount failed');
			});
			const context: Task = createComponentTask({
				taskId: 'test',
				componentName: 'TestComponent',
				componentInjectAt: '#app',
				app: { unmount: mockUnmount } as unknown as App<Element>,
				appRoot: {} as unknown as HTMLElement,
				instance: {} as ComponentPublicInstance
			});

			taskContext.set('test', context);
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			taskContext.releaseComponentInstance('test');

			expect(mockUnmount).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to unmount component for task "test"'),
				expect.any(Error)
			);
		});
		it('should warn if component is already unmounted', () => {
			const context: Task = createComponentTask({
				taskId: 'test',
				componentName: 'TestComponent',
				componentInjectAt: '#app'
			});

			taskContext.set('test', context);
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			taskContext.releaseComponentInstance('test');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Component for task "test" already unmounted')
			);
		});
	});
	describe('releaseDomElement', () => {
		it('should remove root element', () => {
			const mockRemove = vi.fn();
			const context: Task = createComponentTask({
				taskId: 'test',
				appRoot: { remove: mockRemove } as unknown as HTMLElement
			});
			taskContext.set('test', context);
			taskContext.releaseDomElement('test');
			expect(mockRemove).toHaveBeenCalled();
		});

		it('should warn if context not found', () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			taskContext.releaseDomElement('nonexistent');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Task "nonexistent" context not found')
			);
		});

		it('should warn if root element not found', () => {
			const context: Task = createComponentTask({ taskId: 'test' });
			taskContext.set('test', context);
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			taskContext.releaseDomElement('test');
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Root element for task "test" not found')
			);
		});

		it('should log error if removing root element fails', () => {
			const mockRemove = vi.fn().mockImplementation(() => {
				throw new Error('Remove failed');
			});
			const context: Task = createComponentTask({
				taskId: 'test',
				appRoot: { remove: mockRemove } as unknown as HTMLElement
			});
			taskContext.set('test', context);
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			taskContext.releaseDomElement('test');
			expect(mockRemove).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to remove root element for task "test"'),
				expect.any(Error)
			);
		});
	});
	describe('releaseListener', () => {
		it('should abort listener', () => {
			const mockAbort = vi.fn();
			const context: Task = createListenerTask({
				taskId: 'test',
				taskStatus: 'idle',
				timeout: 5000,
				listenAt: 'testListenAt',
				event: 'click',
				callback: () => undefined,
				withEvent: true,
				activitySignal: () => true as unknown as Ref<boolean>,
				controller: { abort: mockAbort } as unknown as AbortController
			});
			taskContext.set('test', context);
			taskContext.releaseListener('test');
			expect(mockAbort).toHaveBeenCalled();
			expect(context.controller).toBeUndefined();
			expect(context.withEvent).toBe(false);
		});
		it('should do nothing if context not found', () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			taskContext.releaseListener('nonexistent');
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});
		it('should log error if aborting listener fails', () => {
			const mockAbort = vi.fn().mockImplementation(() => {
				throw new Error('Abort failed');
			});
			const context: Task = createListenerTask({
				taskId: 'test',
				taskStatus: 'idle',
				timeout: 5000,
				listenAt: 'testListenAt',
				event: 'click',
				callback: () => undefined,
				withEvent: true,
				activitySignal: () => true as unknown as Ref<boolean>,
				controller: { abort: mockAbort } as unknown as AbortController
			});
			taskContext.set('test', context);
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			taskContext.releaseListener('test');
			expect(mockAbort).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to abort listener for task "test"'),
				expect.any(Error)
			);
		});

		it('should do nothing if controller is undefined', () => {
			const context: Task = createListenerTask({
				taskId: 'test',
				taskStatus: 'idle',
				timeout: 5000,
				listenAt: 'testListenAt',
				event: 'click',
				callback: () => undefined,
				withEvent: true,
				activitySignal: () => true as unknown as Ref<boolean>
			});
			taskContext.set('test', context);
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			taskContext.releaseListener('test');
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});
	});
	describe('releaseWatcher', () => {
		it('should stop watcher', () => {
			const mockWatcher = vi.fn() as unknown as WatchHandle;
			const context: Task = createComponentTask({
				taskId: 'test',
				watcher: {
					watcher: mockWatcher,
					watchSource: () => true
				}
			});
			taskContext.set('test', context);
			taskContext.releaseWatcher('test');
			expect(mockWatcher).toHaveBeenCalled();
			expect(context.watcher).toBeUndefined();
		});

		it('should do nothing if watcher is undefined', () => {
			const context: Task = createComponentTask({
				taskId: 'test'
			});
			taskContext.set('test', context);
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			taskContext.releaseWatcher('test');
			expect(consoleErrorSpy).not.toHaveBeenCalled();
		});

		it('should log error if stopping watcher fails', () => {
			const mockWatcher = vi.fn().mockImplementation(() => {
				throw new Error('Stop failed');
			}) as unknown as WatchHandle;
			const context: Task = createComponentTask({
				taskId: 'test',
				watcher: {
					watcher: mockWatcher,
					watchSource: () => true
				}
			});
			taskContext.set('test', context);
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
			taskContext.releaseWatcher('test');
			expect(mockWatcher).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Failed to stop watcher for task "test"'),
				expect.any(Error)
			);
		});
	});
	describe('reset', () => {
		it('should reset all context properties except taskId', () => {
			const mockWatcher = vi.fn() as unknown as WatchHandle;
			const mockAbort = vi.fn();
			const mockUnmount = vi.fn();
			const mockRemove = vi.fn();
			const mockStopAlive = vi.fn();

			const context: Task = createComponentTask({
				taskId: 'test',
				taskStatus: 'idle',
				timeout: 5000,
				watcher: {
					watcher: mockWatcher,
					watchSource: () => true
				},
				listener: {
					listenAt: 'testListenAt',
					event: 'click',
					callback: () => undefined,
					controller: { abort: mockAbort } as unknown as AbortController
				},
				withEvent: true,
				componentName: 'TestComponent',
				componentInjectAt: '#app',
				component: { name: 'TestComponent', render: () => null },
				alive: false,
				scope: 'local',
				app: { unmount: mockUnmount } as unknown as App<Element>,
				appRoot: { remove: mockRemove } as unknown as HTMLElement,
				instance: {} as ComponentPublicInstance,
				isObserver: true,
				disableAlive: mockStopAlive
			});

			taskContext.set('test', context);
			taskContext.reset('test');

			expect(context.taskId).toBe('test');

			expect(context.listener?.controller).toBeUndefined();

			expect(context.watcher).toBeUndefined();

			expect(context.app).toBeUndefined();
			expect(context.appRoot).toBeUndefined();
			expect(context.instance).toBeUndefined();

			expect(context.isObserver).toBe(false);
			expect(context.disableAlive).toBe(mockStopAlive);

			expect(mockAbort).toHaveBeenCalledOnce();
			expect(mockWatcher).toHaveBeenCalledOnce();
			expect(mockUnmount).toHaveBeenCalledOnce();
			expect(mockRemove).toHaveBeenCalledOnce();
			expect(mockStopAlive).not.toHaveBeenCalled();
		});
		it('should not throw error if context is undefined', () => {
			expect(() => taskContext.reset('nonexistent')).not.toThrow();
		});
		it('should stay in map after reset', () => {
			const context: Task = createComponentTask({
				taskId: 'test',
				taskStatus: 'idle'
			});
			taskContext.set('test', context);
			taskContext.reset('test');
			expect(taskContext.get('test')).toMatchObject({
				taskId: 'test',
				kind: 'component',
				taskStatus: 'idle',
				app: undefined,
				appRoot: undefined,
				instance: undefined,
				isObserver: false
			});
		});
	});

	describe('resetAll', () => {
		it('should reset all task states and keep contexts in map', () => {
			const unmountA = vi.fn();
			const unmountB = vi.fn();
			const removeA = vi.fn();
			const removeB = vi.fn();
			const abortA = vi.fn();
			const abortB = vi.fn();
			const watcherA = vi.fn() as unknown as WatchHandle;
			const watcherB = vi.fn() as unknown as WatchHandle;

			taskContext.set(
				'a',
				createComponentTask({
					taskId: 'a',
					taskStatus: 'idle',
					timeout: 5000,
					componentName: 'AComp',
					componentInjectAt: '#a',
					component: { name: 'AComp', render: () => null },
					alive: false,
					scope: 'local',
					withEvent: true,
					listener: {
						listenAt: '#btn-a',
						event: 'click',
						callback: () => undefined,
						controller: { abort: abortA } as unknown as AbortController
					},
					app: { unmount: unmountA } as unknown as App<Element>,
					appRoot: { remove: removeA } as unknown as HTMLElement,
					watcher: {
						watcher: watcherA,
						watchSource: () => true
					},
					isObserver: true
				})
			);

			taskContext.set(
				'b',
				createComponentTask({
					taskId: 'b',
					taskStatus: 'idle',
					timeout: 5000,
					componentName: 'BComp',
					componentInjectAt: '#b',
					component: { name: 'BComp', render: () => null },
					alive: false,
					scope: 'local',
					withEvent: true,
					listener: {
						listenAt: '#btn-b',
						event: 'click',
						callback: () => undefined,
						controller: { abort: abortB } as unknown as AbortController
					},
					app: { unmount: unmountB } as unknown as App<Element>,
					appRoot: { remove: removeB } as unknown as HTMLElement,
					watcher: {
						watcher: watcherB,
						watchSource: () => true
					},
					isObserver: true
				})
			);

			taskContext.resetAll();

			expect(unmountA).toHaveBeenCalledOnce();
			expect(unmountB).toHaveBeenCalledOnce();
			expect(removeA).toHaveBeenCalledOnce();
			expect(removeB).toHaveBeenCalledOnce();
			expect(abortA).toHaveBeenCalledOnce();
			expect(abortB).toHaveBeenCalledOnce();
			expect(watcherA).toHaveBeenCalledOnce();
			expect(watcherB).toHaveBeenCalledOnce();

			expect(taskContext.has('a')).toBe(true);
			expect(taskContext.has('b')).toBe(true);
			expect(taskContext.get<ComponentTask>('a')?.app).toBeUndefined();
			expect(taskContext.get<ComponentTask>('b')?.app).toBeUndefined();
			expect(taskContext.get<ComponentTask>('a')?.isObserver).toBe(false);
			expect(taskContext.get<ComponentTask>('b')?.isObserver).toBe(false);
		});

		it('should not throw when context map is empty', () => {
			expect(() => taskContext.resetAll()).not.toThrow();
		});
	});

	describe('observability resource events', () => {
		it('should emit resource release events from TaskContext', () => {
			const observer = new ObserverHub();
			const observed = new TaskContext((name, payload) => {
				observer.emit({
					name,
					ts: Date.now(),
					...(payload ?? {})
				});
			}, undefined);
			const events: string[] = [];
			observer.onAny((event) => {
				events.push(event.name);
			});

			const watcher = vi.fn() as unknown as WatchHandle;
			const abort = vi.fn();
			const unmount = vi.fn();
			observed.set(
				'obs-task',
				createComponentTask({
					taskId: 'obs-task',
					taskStatus: 'idle',
					timeout: 5000,
					componentName: 'ObsComp',
					componentInjectAt: '#obs',
					component: { name: 'ObsComp', render: () => null },
					alive: false,
					scope: 'local',
					watcher: {
						watcher,
						watchSource: () => true
					},
					withEvent: true,
					listener: {
						listenAt: '#btn',
						event: 'click',
						callback: vi.fn(),
						controller: { abort } as unknown as AbortController
					},
					app: { unmount } as unknown as App<Element>
				})
			);

			observed.releaseWatcher('obs-task');
			observed.releaseListener('obs-task');
			observed.releaseComponentInstance('obs-task');

			expect(events).toContain('resource:watcherReleased');
			expect(events).toContain('resource:listenerReleased');
			expect(events).toContain('resource:componentUnmounted');
		});

		it('should emit normalized resource payload fields', () => {
			const observer = new ObserverHub();
			const observed = new TaskContext((name, payload) => {
				observer.emit({
					name,
					ts: Date.now(),
					...(payload ?? {})
				});
			}, undefined);

			const released: Record<string, unknown> = {};
			observer.onAny((event) => {
				if (event.name.startsWith('resource:')) {
					released[event.name] = event;
				}
			});

			const watcher = vi.fn() as unknown as WatchHandle;
			const abort = vi.fn();
			const unmount = vi.fn();
			observed.set(
				'obs-resource',
				createComponentTask({
					taskId: 'obs-resource',
					taskStatus: 'idle',
					timeout: 5000,
					componentName: 'ObsResourceComp',
					componentInjectAt: '#obs-resource',
					component: { name: 'ObsResourceComp', render: () => null },
					alive: false,
					scope: 'local',
					watcher: {
						watcher,
						watchSource: () => true
					},
					withEvent: true,
					listener: {
						listenAt: '#resource-btn',
						event: 'click',
						callback: vi.fn(),
						controller: { abort } as unknown as AbortController
					},
					app: { unmount } as unknown as App<Element>
				})
			);

			observed.releaseWatcher('obs-resource');
			observed.releaseListener('obs-resource');
			observed.releaseComponentInstance('obs-resource');

			expect(released['resource:watcherReleased']).toMatchObject({
				name: 'resource:watcherReleased',
				taskId: 'obs-resource',
				kind: 'component',
				injectAt: '#obs-resource',
				status: 'idle',
				meta: {
					resource: 'watcher'
				}
			});

			expect(released['resource:listenerReleased']).toMatchObject({
				name: 'resource:listenerReleased',
				taskId: 'obs-resource',
				kind: 'component',
				injectAt: '#obs-resource',
				status: 'idle',
				meta: {
					resource: 'listener',
					listenerEvent: 'click',
					listenAt: '#resource-btn'
				}
			});

			expect(released['resource:componentUnmounted']).toMatchObject({
				name: 'resource:componentUnmounted',
				taskId: 'obs-resource',
				kind: 'component',
				injectAt: '#obs-resource',
				status: 'idle',
				meta: {
					resource: 'component',
					componentName: 'ObsResourceComp'
				}
			});
		});
	});
});
