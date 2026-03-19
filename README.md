# vue-implant 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[🇨🇳 中文文档](README.CN.md)

`vue-implant` is a Vue component injection framework designed for uncontrolled page environments such as userscripts and browser extensions.

It provides component lifecycle management, DOM waiting and target detection, and re-injection capabilities, helping you reliably enhance third-party pages without frequently dealing with complex native DOM APIs.

It is suitable for scenarios where page structures are unstable, async rendering is frequent, and long-running injection is required.

## Table of Contents 📚

- [Demo](#demo)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Compatibility](#compatibility)
- [API](#api)
- [Limitations](#limitations)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Demo 🎬

There is no public demo site yet. You can run the local `demo/` in this repository for a hands-on experience.

## Installation 📦

Supports `npm`, `pnpm`, and `yarn`:

```bash
npm install vue-implant
```

```bash
pnpm add vue-implant
```

```bash
yarn add vue-implant
```

## Quick Start ⚡

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();

injector.register('#app', TestAppComponent, {
	alive: true,
	scope: 'global'
});

injector.run();
```

## Compatibility ✅

- Vue: `3.x`
- Runtime environment: modern browser page environments (e.g., userscripts, browser extension content scripts)
- iframe: currently not supported

## API 🧩

### `new Injector(config?: Partial<InjectionConfig>)` 🏗️

Creates an `Injector` instance.

```ts
type InjectionConfig = {
	alive?: boolean;
	scope?: 'local' | 'global';
	timeout?: number;
};
```

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `alive` | `boolean` | Whether to enable global re-injection. | `false` |
| `scope` | `'local' \| 'global'` | `local` binds listeners to the target element's parent; `global` mounts listeners to `body`, so listeners can remain active when local DOM is rebuilt. | `'local'` |
| `timeout` | `number` | Timeout threshold (ms) for initial injection and re-injection. Setting it explicitly to `undefined` is not recommended. | `5000` |

### `Injector.run(): void`

Starts the injection process and handles registered tasks.

> [!WARNING]
> You must complete registrations like `register` / `registerListener` before calling `run()`; new registrations after `run()` will be ignored with warnings.

### `Injector.register(injectAt: string, component: Component, option?: ComponentOptions): RegisterResult`

Registers a component injection task.

Parameter description:

- `injectAt`: selector of the target where the component should be injected.
- `component`: Vue component to inject.
- `option`: optional configuration.

`option` structure:

| Property | Required | Type | Description |
| --- | --- | --- | --- |
| `alive` | no | `boolean` | Whether to enable re-injection (uses global config when omitted). |
| `scope` | no | `'local' \| 'global'` | Re-injection observation scope (uses global config when omitted). |
| `on` | no | `object` | External event binding configuration. |
| `on.listenAt` | yes | `string` | Selector of the event target element. |
| `on.type` | yes | `string` | Event type. |
| `on.callback` | yes | `EventListener` | Event callback. |
| `on.activitySignal` | no | `() => Ref<boolean>` | External signal controlling listener activation. |

Return value:

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `taskId` | `string` | Unique task identifier. | `[ComponentName]@[CSSSelector]` |
| `isSuccess` | `boolean` | Whether registration succeeds. | success `true`, failure `false` |
| `keepAlive` | `() => void` | Manually enables re-injection; empty function when registration fails. | callback function |
| `stopAlive` | `() => void` | Manually disables re-injection; empty function when registration fails. | callback function |

> [!NOTE]
> Re-registering the same component at the same target will not throw; it warns and returns the first registration result.

> [!WARNING]
> When called after `run()`, `isSuccess` is `false`, and `keepAlive` / `stopAlive` are empty functions.

### `Injector.registerListener(listenAt: string, event: string, callback: EventListener, activitySignal?: () => Ref<boolean>): ListenerRegisterResult`

Registers a pure listener task (without component injection).

Parameter description:

- `listenAt`: selector of the listener target element.
- `event`: listener event type.
- `callback`: event callback.
- `activitySignal`: optional, returns `Ref<boolean>` to dynamically control listener activation.

Return value:

| Property | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | Unique listener task identifier. |
| `isSuccess` | `boolean` | Whether registration succeeds (`false` when ignored). |

> [!NOTE]
> Re-registering the same `listenAt + event` will not throw; it warns and returns the same `taskId`.

> [!WARNING]
> When called after `run()`, registration is ignored and returns `isSuccess = false`.

### `Injector.keepAlive(taskId: string): void`

Enables re-injection for a component task.

Parameter description:

- `taskId`: task ID for enabling re-injection.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.keepAlive(taskId);
injector.run();
```

> [!NOTE]
> Tasks registered via pure event listeners cannot use this API. Forced calls will warn and return immediately.

### `Injector.stopAlive(taskId: string): void`

Disables re-injection for a component task.

Parameter description:

- `taskId`: task ID for disabling re-injection.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.keepAlive(taskId);
injector.stopAlive(taskId);
injector.run();
```

> [!NOTE]
> If re-injection is not currently enabled for this task, it will warn and return immediately.

### `Injector.destroyed(taskId: string): void`

Destroys a specific task and releases associated listeners, component instances, and state.

Parameter description:

- `taskId`: task ID to destroy.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.run();
injector.destroyed(taskId);
```

### `Injector.destroyedAll(): void`

Destroys all tasks registered in the current `Injector`.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
injector.register('#app', TestAppComponent);
injector.registerListener('#btn', 'click', () => console.log('clicked'));

injector.run();
injector.destroyedAll();
```

### `Injector.reseted(taskId: string): void`

Resets a specific task to reusable initial runtime state while keeping registration metadata.

Parameter description:

- `taskId`: task ID to reset.

Behavior summary:

- Stops alive observer first when the task is in alive mode.
- Unmounts mounted component instance and removes injected root element.
- Aborts listener and stops watcher.
- Keeps the task entry in context, so the task can be reused.

### `Injector.resetedAll(): void`

Resets all registered tasks to reusable initial runtime state.

Behavior summary:

- Stops alive observers for all alive tasks first.
- Calls context-level full reset once to clean runtime fields of every task.
- Keeps task registrations and task IDs in context.

### `Injector.bindActivitySignal(taskId: string, source: WatchSource<boolean>): void`

Binds an external reactive signal to listener activation: listener opens when `true`, closes when `false`.

Parameter description:

- `taskId`: task ID (must be a task configured with `on`).
- `source`: `WatchSource<boolean>`, usually a `ref<boolean>`.

**Minimal example:**

```ts
import { ref } from 'vue';
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const enabled = ref(true);

const { taskId } = injector.register('#app', TestAppComponent, {
	on: {
		listenAt: '#btn',
		type: 'click',
		callback: () => console.log('clicked')
	}
});

injector.bindActivitySignal(taskId, enabled);
injector.run();
```

### `Injector.listenerActivity(taskId: string, event: ActionEvent): void`

Manually controls the external listener state of a registered task: `Action.OPEN` to enable, `Action.CLOSE` to disable.

Parameter description:

- `taskId`: task ID (must be a task configured with event listening).
- `event`: action type, either `Action.OPEN` or `Action.CLOSE`.

**Minimal example:**

```ts
import { Action, Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent, {
	on: {
		listenAt: '#btn',
		type: 'click',
		callback: () => console.log('clicked')
	}
});

injector.listenerActivity(taskId, Action.OPEN);
injector.listenerActivity(taskId, Action.CLOSE);
```



## Limitations ⚠️

- `iframe` injection is currently not supported. In the current architecture, style injection and lifecycle management inside `iframe` are not fully handled.
- From a performance perspective, each injected component creates an independent Vue instance. In high-volume injection scenarios, the reactivity system and virtual DOM may introduce additional overhead.

## FAQ ❓

### 1) Why does calling `register` / `registerListener` after `run()` not work?

This is by design: `run()` starts and locks the current task scheduling cycle. New registrations after running are ignored and return `isSuccess = false` (or emit corresponding warnings). In later versions, there may be a dedicated API for post-`run()` registration, or `run()` may be significantly redesigned.

### 2) Does duplicate `registerListener` throw an error?

No. Re-registering the same `listenAt + event` emits a warning and returns the same `taskId`.

### 3) Should I use `local` or `global` for `scope`?

- `local`: smaller observation scope, lower side effects, recommended by default.
- `global`: more robust for local DOM rebuild scenarios, but with a larger observation scope and higher performance cost.

### 4) Can `keepAlive`/`stopAlive` be used for pure listener tasks?

No. Calling these APIs on pure listener tasks returns immediately with warnings.

## Roadmap 🛣️

- [ ] **Refactor and decouple injector logic:** split injection flows into smaller modules with clearer responsibilities.
- [ ] **Implement a single Vue instance injection mode:** reduce instance overhead in multi-task scenarios while allowing users to choose between multi-instance and single-instance modes.



## Development 🛠️

**Build:**

```bash
git clone https://github.com/FlowingInk/vue-implant.git
cd vue-implant
git switch -c feat/your-feature-name
npm install 
npm run build
```

**Test:**

```bash
npm run test
```

**Format:**

```bash
npm run lint:fix
```

## Contributing 🤝

Issues and PRs are welcome. Let’s improve `vue-implant` together.

## License 📄

This project is licensed under MIT. See [LICENSE](LICENSE) for details.
