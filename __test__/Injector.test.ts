import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { Injector } from '../src/core/Injector';
import { TaskContext } from '../src/core/task/TaskContext';
import type { TaskLifeCycle } from '../src/core/task/TaskLifeCycle';
import type { TaskRegister } from '../src/core/task/TaskRegister';
import type { TaskRunner } from '../src/core/task/TaskRunner';
import { Action } from '../src/type';

describe('Injector', () => {
	let injector: Injector;
	let taskContext: TaskContext;
	let taskRegister: TaskRegister;
	let taskRunner: TaskRunner;
	let taskLifeCycle: TaskLifeCycle;

	beforeEach(() => {
		injector = new Injector();
		const internals = injector as unknown as {
			taskContext: TaskContext;
			taskRegister: TaskRegister;
			taskRunner: TaskRunner;
			taskLifeCycle: TaskLifeCycle;
		};
		taskContext = internals.taskContext;
		taskRegister = internals.taskRegister;
		taskRunner = internals.taskRunner;
		taskLifeCycle = internals.taskLifeCycle;
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('should create injector and keep default config', () => {
		expect(injector).toBeInstanceOf(Injector);
	});

	it('should forward register to TaskRegister and wrap lifecycle callbacks', () => {
		const registerSpy = vi.spyOn(taskRegister, 'register');
		const enableSpy = vi.spyOn(taskLifeCycle, 'enableAlive').mockImplementation(() => {});
		const disableSpy = vi.spyOn(taskLifeCycle, 'disableAlive').mockImplementation(() => {});

		const result = injector.register('#app', { name: 'FacadeComp' });

		expect(registerSpy).toHaveBeenCalledWith('#app', { name: 'FacadeComp' }, undefined);
		result.enableAlive();
		result.disableAlive();
		expect(enableSpy).toHaveBeenCalledWith(result.taskId);
		expect(disableSpy).toHaveBeenCalledWith(result.taskId);
	});

	it('should forward registerListener to TaskRegister', () => {
		const spy = vi.spyOn(taskRegister, 'registerListener');
		const cb = vi.fn();

		injector.registerListener('#btn', 'click', cb);

		expect(spy).toHaveBeenCalledWith('#btn', 'click', cb, undefined);
	});

	it('should forward run to TaskRunner', () => {
		const runSpy = vi.spyOn(taskRunner, 'run').mockImplementation(() => {});
		injector.run();
		expect(runSpy).toHaveBeenCalledOnce();
	});

	it('should forward enableAlive and disableAlive to TaskLifeCycle', () => {
		const enableSpy = vi.spyOn(taskLifeCycle, 'enableAlive').mockImplementation(() => {});
		const disableSpy = vi.spyOn(taskLifeCycle, 'disableAlive').mockImplementation(() => {});

		injector.enableAlive('task-a');
		injector.disableAlive('task-a');

		expect(enableSpy).toHaveBeenCalledWith('task-a');
		expect(disableSpy).toHaveBeenCalledWith('task-a');
	});

	it('should forward bindListenerSignal and controlListener to TaskRunner', () => {
		const source = ref(true);
		const bindSpy = vi.spyOn(taskRunner, 'bindListenerSignal').mockReturnValue(true);
		const controlSpy = vi.spyOn(taskRunner, 'controlListener').mockReturnValue(true);

		injector.bindListenerSignal('task-b', source);
		injector.controlListener('task-b', Action.OPEN);

		expect(bindSpy).toHaveBeenCalledWith('task-b', source);
		expect(controlSpy).toHaveBeenCalledWith('task-b', Action.OPEN);
	});

	it('should get task context', () => {
		const context = injector.getContext();
		expect(context).toBeDefined();
		expect(context).toBeInstanceOf(TaskContext);
		expect(taskContext).toBe(context);
	});

	it('should register shared plugins in Injector', () => {
		const pluginA = { install: vi.fn() };
		const pluginB = { install: vi.fn() };

		const result = injector.use(pluginA).usePlugins(pluginB);

		expect(result).toBe(injector);
		expect(injector.getPlugins()).toEqual([pluginA, pluginB]);
	});

	it('should keep setPinia/getPinia compatible with shared plugin registration', () => {
		const pinia = createPinia();
		injector.setPinia(pinia);
		expect(injector.getPlugins()).toContain(pinia);
		expect(injector.getPinia()).toBe(pinia);
	});

	it('should reset task context', () => {
		injector.register('#reset', { name: 'ResetComp' });
		injector.reset('task-a');
		const context = taskContext.get('task-a');
		expect(context).toBeUndefined();
	});

	it('should reset all task contexts', () => {
		injector.register('#reset', { name: 'ResetComp' });
		injector.register('#reset', { name: 'ResetComp2' });
		injector.register('#reset', { name: 'ResetComp3' });
		injector.resetAll();
		expect([...taskContext.keys()]).toHaveLength(3);
	});

	it('should destroy task context', () => {
		injector.register('#destroy', { name: 'DestroyComp' });
		injector.destroy('task-destroy');
		const context = taskContext.get('task-destroy');
		expect(context).toBeUndefined();
	});

	it('should destroy all task contexts', () => {
		injector.register('#destroy', { name: 'DestroyComp' });
		injector.register('#destroy', { name: 'DestroyComp2' });
		injector.register('#destroy', { name: 'DestroyComp3' });
		injector.destroyAll();
		expect([...taskContext.keys()]).toHaveLength(0);
	});

	it('should pass integration smoke: register + run activates task and mounts component', () => {
		const host = document.createElement('div');
		host.id = 'smoke';
		document.body.appendChild(host);

		const { taskId } = injector.register('#smoke', { name: 'SmokeComp', render: () => null });
		injector.run();

		const context = taskContext.get(taskId);
		expect(context?.taskStatus).toBe('active');
		expect(context?.app).toBeDefined();
		expect(context?.appRoot?.parentElement).toBe(host);
	});
});
