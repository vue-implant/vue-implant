import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { TaskContext } from '../src/core/task/TaskContext';
import { TaskRegister } from '../src/core/task/TaskRegister';

describe('TaskRegister', () => {
	let taskContext: TaskContext;
	let taskRegister: TaskRegister;

	beforeEach(() => {
		taskContext = new TaskContext();
		taskRegister = new TaskRegister(taskContext, {
			alive: false,
			scope: 'local',
			timeout: 5000
		});
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	it('should register a component task with defaults', () => {
		const result = taskRegister.register('#app', { name: 'CompA' });
		const context = taskContext.get(result.taskId);

		expect(result).toEqual({ taskId: 'CompA@#app', isSuccess: true });
		expect(context?.componentName).toBe('CompA');
		expect(context?.alive).toBe(false);
		expect(context?.scope).toBe('local');
		expect(taskContext.taskRecords).toEqual([{ taskId: 'CompA@#app', injectAt: '#app' }]);
	});

	it('should use option override for alive and scope', () => {
		const result = taskRegister.register(
			'#root',
			{ name: 'CompB' },
			{ alive: true, scope: 'global' }
		);
		const context = taskContext.get(result.taskId);

		expect(context?.alive).toBe(true);
		expect(context?.scope).toBe('global');
	});

	it('should store event config and activity signal when provided', () => {
		const signal = ref(true);
		const callback = vi.fn();

		const result = taskRegister.register(
			'#event-host',
			{ name: 'CompC' },
			{
				on: {
					listenAt: '#btn',
					type: 'click',
					callback,
					activitySignal: () => signal
				}
			}
		);

		const context = taskContext.get(result.taskId);
		expect(context?.withEvent).toBe(true);
		expect(context?.listenAt).toBe('#btn');
		expect(context?.event).toBe('click');
		expect(context?.callback).toBe(callback);
		expect(context?.activitySignal?.()).toBe(signal);
	});

	it('should return existing result for duplicate component registration', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const first = taskRegister.register('#dup', { name: 'CompDup' });
		const second = taskRegister.register('#dup', { name: 'CompDup' });

		expect(second).toEqual(first);
		expect(taskContext.taskRecords).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
	});

	it('should reuse generated anonymous name for same component reference', () => {
		const anonymous = {};
		const a = taskRegister.register('#a', anonymous);
		const b = taskRegister.register('#b', anonymous);

		expect(a.taskId.split('@')[0]).toBe(b.taskId.split('@')[0]);
	});

	it('should register listener-only task', () => {
		const callback = vi.fn();
		const result = taskRegister.registerListener('#btn', 'click', callback);
		const context = taskContext.get(result.taskId);

		expect(result).toEqual({ taskId: 'listener-#btn-click', isSuccess: true });
		expect(context?.withEvent).toBe(true);
		expect(context?.listenAt).toBe('#btn');
		expect(context?.event).toBe('click');
		expect(context?.callback).toBe(callback);
	});

	it('should return existing result for duplicate listener registration', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const first = taskRegister.registerListener('#btn', 'click', vi.fn());
		const second = taskRegister.registerListener('#btn', 'click', vi.fn());

		expect(second).toEqual(first);
		expect(taskContext.taskRecords).toHaveLength(1);
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
	});
});
