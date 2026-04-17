import type { ComponentTask, Task, TaskListenerFeature } from './types';

export function isComponentTask(task: Task): task is ComponentTask {
	return task.kind === 'component';
}
export function getTaskInjectAt(task: Task): string {
	return isComponentTask(task) ? task.componentInjectAt : task.listenAt;
}

export function getTaskListener(task: Task): TaskListenerFeature | undefined {
	if (!task.withEvent) {
		return undefined;
	}

	const listener = isComponentTask(task) ? task.listener : task;
	if (!listener?.listenAt || !listener.event || !listener.callback) {
		return undefined;
	}

	return listener;
}
