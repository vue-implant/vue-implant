import type { ArtifactTask, Task, TaskListenerFeature } from './types';

export function isArtifactTask(task: Task): task is ArtifactTask {
	return task.kind === 'component';
}

export function getTaskInjectAt(task: Task): string {
	return isArtifactTask(task) ? task.injectAt : task.listenAt;
}

export function getTaskListener(task: Task): TaskListenerFeature | undefined {
	if (!task.withEvent) {
		return undefined;
	}

	const listener = isArtifactTask(task) ? task.listener : task;
	if (!listener?.listenAt || !listener.event || !listener.callback) {
		return undefined;
	}

	return listener;
}
