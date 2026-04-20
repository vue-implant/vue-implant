<p align="center">
	<img width="150" src="./demo/assets/vue-implant-icon.png">
</p>

<h1 align="center">Vue-implant</h1>
<p align="center">A lightweight Vue component injection framework</p>

<div align="center">
  <a href="https://github.com/FlowingInk/vue-implant/"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/FlowingInk/vue-implant?style=flat-square">
</a>
  <a href="https://www.npmjs.com/package/vue-implant"><img alt="NPM Version" src="https://img.shields.io/npm/v/vue-implant">
</a>
  <a href="https://www.npmjs.com/package/vue-implant"><img alt="NPM Downloads" src="https://img.shields.io/npm/dw/vue-implant">
</a>
<a href="./LICENSE"><img alt="NPM Downloads" src="https://img.shields.io/badge/License-MIT-yellow.svg">
</a>
</div>
<div align="center">
   English | <a href="./README.CN.md">中文</a>
</div>

---



`vue-implant` is a Vue component injection framework primarily designed for Greasemonkey script development scenarios.

It streamlines component injection in Userscript development, eliminating tedious low-level DOM manipulations. By providing a declarative injection mechanism, it empowers developers to build high-performance, maintainable script applications with ease.

We highly recommend using  [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) in tandem. By bridging `vue-implant`'s component injection with Vite's modern build pipeline, you can enjoy a seamless, high-performance Userscript development workflow.
## Table of Contents 📚

- [Demo](#demo)
- [Installation](#installation)
- [Best Practice](#best-practice)
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

Public demo site: https://vue-implant.github.io/vue-implant/

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

## Best Practice ✅

For Greasemonkey/TemperMonkey projects, the recommended stack is: `vite-plugin-monkey + vue-implant`.

- `vite-plugin-monkey`: handles userscript build pipeline, metadata, local development, and release flow.
- `vue-implant`: handles component mounting, DOM target waiting, re-injection, and task lifecycle on dynamic pages.

This pairing keeps responsibilities clear: one tool focuses on userscript engineering, the other focuses on reliable page enhancement.

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
	logger?: ILogger;
	observer?: ObserverHub;
	hooks?: LifecycleHookMap;
};
```

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `alive` | `boolean` | Whether to enable global re-injection. | `false` |
| `scope` | `'local' \| 'global'` | `local` binds listeners to the target element's parent; `global` mounts listeners to `body`, so listeners can remain active when local DOM is rebuilt. | `'local'` |
| `timeout` | `number` | Timeout threshold (ms) for initial injection and re-injection. Setting it explicitly to `undefined` is not recommended. | `5000` |
| `logger` | `ILogger` | Custom logger implementation. When omitted, the built-in logger is used. | built-in logger |
| `observer` | `ObserverHub` | Optional observability hub for subscribing runtime events. | `new ObserverHub()` |
| `hooks` | `LifecycleHookMap` | Optional global lifecycle hooks registered once at injector creation. | `undefined` |

### `Injector.run(): void`

Starts the injection process and handles registered tasks.

> [!NOTE]
> `run()` is idempotent. Repeated calls are safe and only activate tasks that are not already active/pending.

### `Injector.register(injectAt: string, component: Component, option?: ComponentOptions): RegisterResult`

Registers a component injection task. Internally, `vue-implant` resolves the matching mount adapter for the registered component.

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
| `on.activitySignal` | no | `() => ActivitySignalSource<boolean>` | External signal controlling listener activation. Passing Vue `ref`-like sources still works in `1.x`, but is deprecated. |
| `hooks` | no | `LifecycleHookMap` | Component-level lifecycle hooks for the current task (only supported in `register`). |

Return value:

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `taskId` | `string` | Unique task identifier. | `[ArtifactName]@[CSSSelector]` or `artifact-[CSSSelector]` |
| `isSuccess` | `boolean` | Whether registration succeeds. | success `true`, failure `false` |
| `enableAlive` | `() => void` | Manually enables re-injection; empty function when registration fails. | callback function |
| `disableAlive` | `() => void` | Manually disables re-injection; empty function when registration fails. | callback function |

> [!NOTE]
> Re-registering the same component at the same target will not throw; it warns and returns the first registration result.

> [!NOTE]
> You can call `register()` after `run()`. The new task will be activated on the next `run()` call.

### `Injector.registerListener(listenAt: string, event: string, callback: EventListener, activitySignal?: () => ActivitySignalSource<boolean>): ListenerRegisterResult`

Registers a pure listener task (without component injection).

Parameter description:

- `listenAt`: selector of the listener target element.
- `event`: listener event type.
- `callback`: event callback.
- `activitySignal`: optional, returns `ActivitySignalSource<boolean>` to dynamically control listener activation.

Return value:

| Property | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | Unique listener task identifier. |
| `isSuccess` | `boolean` | Whether registration succeeds. |

> [!NOTE]
> Re-registering the same `listenAt + event` will not throw; it warns and returns the same `taskId`.

> [!NOTE]
> You can call `registerListener()` after `run()`. The new listener task will be activated on the next `run()` call.

### `Injector.use(plugin: Plugin): this`

Registers a shared Vue plugin in the singleton plugin registry used by injector-created Vue apps in the current runtime.

**Minimal example:**

```ts
import { createPinia } from 'pinia';
import { Injector } from 'vue-implant';

const injector = new Injector();

injector.use(createPinia());
```

### `Injector.usePlugins(...plugins: Plugin[]): this`

Registers multiple shared Vue plugins in install order.

**Minimal example:**

```ts
import { createPinia } from 'pinia';
import { Injector } from 'vue-implant';

const injector = new Injector();
const pinia = createPinia();
const analyticsPlugin = {
	install() {
		// custom plugin setup
	}
};

injector.usePlugins(pinia, analyticsPlugin);
```

### `Injector.getPlugins(): Plugin[]`

Returns the shared plugins currently registered in the singleton Vue plugin registry.

### `Injector.setPinia(pinia: Plugin): void`

Legacy compatibility alias for Pinia-based setups. It still works and internally registers Pinia as a shared plugin.

> [!NOTE]
> New Version should prefer `use()` / `usePlugins()`. `setPinia()` and `getPinia()` remain available for backward compatibility in `1.x`.

### `Injector.getPinia(): Plugin | undefined`

Returns the Pinia instance previously set through `setPinia()`.

### `VuePlugin`

Singleton shared plugin registry exposed for advanced orchestration. It powers `Injector.use()`, `Injector.usePlugins()`, `Injector.setPinia()`, and related getters.

Available methods: `use`, `usePlugins`, `getPlugins`, `setPinia`, `getPinia`, `clear`.

> [!NOTE]
> `VuePlugin` is global within the current runtime. Plugins registered through one `Injector` are visible to other `Injector` instances on the same page.

### `Injector.getObserver(): ObserverHub`

Returns the `ObserverHub` instance held by the current injector, so you can subscribe/unsubscribe observability events directly.

### `Injector.on(event: ObserveEventName, hook: ObserveHook): () => void`

Registers a global observer hook for one event.

### `Injector.onTask(taskId: string, event: ObserveEventName, hook: ObserveHook): () => void`

Registers a task-scoped observer hook that only fires when `event.taskId === taskId`.

### `Injector.onAny(hook: ObserveHook): () => void`

Registers a global observer hook for all events.

### `Injector.off(event: ObserveEventName, hook?: ObserveHook): void`

Removes one global event hook or all hooks for an event.

### `Injector.offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void`

Removes task-scoped hooks by task, by task+event, or by task+event+hook.

### `Injector.offAny(hook: ObserveHook): void`

Removes a previously registered `onAny` hook.

### `Injector.getLogger(): ILogger`

Returns the logger instance currently used by the injector and its default observer pipeline.

### Logging

`vue-implant` writes internal runtime logs through a unified logger instead of directly use `console` inside each module.

- Default log format: `[Vue Implant][LEVEL][ISO_TIMESTAMP] message`

**Minimal example:**

```ts
import { Injector, type ILogger } from 'vue-implant';

const logger: ILogger = {
	info: (message, ...args) => console.info(`[My App] ${message}`, ...args),
	warn: (message, ...args) => console.warn(`[My App] ${message}`, ...args),
	error: (message, ...args) => console.error(`[My App] ${message}`, ...args),
	debug: (message, ...args) => console.debug(`[My App] ${message}`, ...args)
};

const injector = new Injector({ logger });
```

### Lifecycle Hooks (`ObserverHub`)

`vue-implant` supports subscribing to lifecycle hooks through `ObserverHub`, which is useful for monitoring, analytics, and debug logging.

**Minimal example:**

```ts
import { Injector, ObserverHub } from 'vue-implant';

const observer = new ObserverHub();
const injector = new Injector({ observer });

const offAny = observer.onAny((event) => {
	console.log('[observe]', event.name, event.taskId, event.injectAt, event.status);
});

const offFail = observer.on('inject:fail', (event) => {
	console.error('inject failed:', event.taskId, event.error);
});

const offTask = observer.onTask('MyComp@#app', 'task:afterReset', (event) => {
	console.log('task reset completed:', event.taskId, event.preStatus, event.status);
});

injector.run();

offFail();
offAny();
offTask();
```

You can also register hooks declaratively:

```ts
const injector = new Injector({
	hooks: {
		'run:start': (event) => console.log('run start stats:', event.meta)
	}
});

injector.register('#app', App, {
	hooks: {
		'task:afterDestroy': (event) => console.log('destroyed:', event.taskId)
	}
});
```

Hook scopes:

- Global hooks: pass `hooks` in `new Injector({ hooks })`, or use `injector.on(...)` / `injector.onAny(...)`.
- Task-scoped hooks: use `injector.onTask(taskId, event, hook)`.
- Component-level hooks: pass `hooks` in `injector.register(injectAt, component, { hooks })`.
- Current component-level hooks are only available for component tasks created by `register` (not `registerListener`).

Lifecycle event payloads:

| Event | Payload fields |
| --- | --- |
| `register:start` | `taskId`, `kind`, `injectAt`, `status`, `meta.artifactName?`, `meta.listenerEvent?`, `meta.listenAt?`, `meta.alive?`, `meta.scope?`, `meta.timeout?`, `meta.withEvent?` |
| `register:success` | `taskId`, `kind`, `injectAt`, `status`, `meta.artifactName?`, `meta.listenerEvent?`, `meta.listenAt?`, `meta.alive?`, `meta.scope?`, `meta.timeout?`, `meta.withEvent?` |
| `register:duplicate` | `taskId`, `kind`, `injectAt`, `status`, `meta.artifactName?`, `meta.listenerEvent?` |
| `register:error` | `taskId`, `kind`, `injectAt`, `status`, `error`, `meta.artifactName?`, `meta.listenerEvent?` |
| `run:start` | `meta.totalTasks`, `meta.idleTasks`, `meta.pendingTasks`, `meta.activeTasks` |
| `run:taskScheduled` | `taskId`, `kind`, `injectAt`, `status`, `preStatus`, `meta.timeout` |
| `run:taskSkipped` | `taskId`, `kind`, `injectAt`, `status`, `meta.skipReason` |
| `target:ready` | `taskId`, `kind`, `injectAt`, `status` |
| `inject:start` | `taskId`, `kind`, `injectAt`, `status`, `meta.artifactName`, `meta.alive`, `meta.scope`, `meta.withEvent` |
| `inject:success` | `taskId`, `kind`, `injectAt`, `status`, `meta.artifactName`, `meta.alive`, `meta.scope` |
| `inject:fail` | `taskId`, `kind`, `injectAt`, `status`, `error`, `meta.artifactName` |
| `listener:open` | `taskId`, `kind`, `injectAt`, `status`, `meta.listenerEvent`, `meta.listenAt` |
| `listener:close` | `taskId`, `kind`, `injectAt`, `status`, `meta.listenerEvent`, `meta.listenAt` |
| `listener:attachFail` | `taskId`, `kind`, `injectAt`, `status`, `error`, `meta.listenerEvent`, `meta.listenAt` |
| `alive:enable` | `taskId`, `kind`, `injectAt`, `status`, `meta.scope` |
| `alive:disable` | `taskId`, `kind`, `injectAt`, `status`, `meta.scope` |
| `alive:observeStart` | `taskId`, `kind`, `injectAt`, `status`, `meta.scope`, `meta.observerMode` |
| `alive:observeStop` | `taskId`, `kind`, `injectAt`, `status`, `meta.scope`, `meta.observerMode` |
| `task:statusChange` | `taskId`, `kind`, `injectAt`, `status`, `preStatus` |
| `task:active` | `taskId`, `kind`, `injectAt`, `status`, `preStatus` |
| `task:beforeReset` | `taskId`, `kind`, `injectAt`, `status` |
| `task:reset` | `taskId`, `kind`, `injectAt`, `status` |
| `task:afterReset` | `taskId`, `kind`, `injectAt`, `status`, `preStatus` |
| `task:beforeDestroy` | `taskId`, `kind`, `injectAt`, `status` |
| `task:destroy` | `taskId`, `kind`, `injectAt`, `status` |
| `task:afterDestroy` | `taskId`, `kind`, `injectAt`, `preStatus` |
| `resource:watcherReleased` | `taskId`, `kind`, `injectAt`, `status`, `meta.resource` |
| `resource:listenerReleased` | `taskId`, `kind`, `injectAt`, `status`, `meta.resource`, `meta.listenerEvent?`, `meta.listenAt?` |
| `resource:componentUnmounted` | `taskId`, `kind`, `injectAt`, `status`, `meta.resource`, `meta.artifactName` |
| `dom:readyFound` | `injectAt`, `taskId`, `kind`, `durationMs`, `meta.root` |
| `dom:readyTimeout` | `injectAt`, `taskId`, `kind`, `durationMs`, `meta.root` |
| `dom:removed` | `injectAt`, `taskId`, `kind`, `meta.phase` |
| `dom:restored` | `injectAt`, `taskId`, `kind`, `durationMs` |

Common event groups:

- register: `register:start` / `register:success` / `register:duplicate` / `register:error`
- run: `run:start` / `run:taskScheduled` / `run:taskSkipped` / `target:ready`
- injection: `inject:start` / `inject:success` / `inject:fail`
- listener: `listener:open` / `listener:close` / `listener:attachFail`
- alive: `alive:enable` / `alive:disable` / `alive:observeStart` / `alive:observeStop`
- task: `task:statusChange` / `task:active` / `task:beforeReset` / `task:reset` / `task:afterReset` / `task:beforeDestroy` / `task:destroy` / `task:afterDestroy`
- resources: `resource:watcherReleased` / `resource:listenerReleased` / `resource:componentUnmounted`
- DOM watcher: `dom:readyFound` / `dom:readyTimeout` / `dom:removed` / `dom:restored`

Payload conventions:

- Most task-related events carry normalized base fields: `taskId`, `kind`, `injectAt`, `status`.
- Transition events include `preStatus` (for example: `task:statusChange`, `task:active`, `task:afterReset`, `task:afterDestroy`).
- Time-based events include `durationMs` (for example: `dom:readyFound`, `dom:readyTimeout`, `dom:restored`).
- Event-specific details are provided in `meta` (for example: `run:start` stats, `listener:*` binding info, `alive:*` scope/mode).
- DOM watcher events are emitted with task context from runtime factories, while `DOMWatcher` itself remains business-agnostic.

### `Injector.enableAlive(taskId: string): void`

Enables re-injection for a component task.

Parameter description:

- `taskId`: task ID for enabling re-injection.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.enableAlive(taskId);
injector.run();
```

> [!NOTE]
> Tasks registered via pure event listeners cannot use this API. Forced calls will warn and return immediately.

### `Injector.disableAlive(taskId: string): void`

Disables re-injection for a component task.

Parameter description:

- `taskId`: task ID for disabling re-injection.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.enableAlive(taskId);
injector.disableAlive(taskId);
injector.run();
```

> [!NOTE]
> If re-injection is not currently enabled for this task, it will warn and return immediately.

### `Injector.destroy(taskId: string): void`

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
injector.destroy(taskId);
```

### `Injector.destroyAll(): void`

Destroys all tasks registered in the current `Injector`.

**Minimal example:**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
injector.register('#app', TestAppComponent);
injector.registerListener('#btn', 'click', () => console.log('clicked'));

injector.run();
injector.destroyAll();
```

### `Injector.reset(taskId: string): void`

Resets a specific task to reusable initial runtime state while keeping registration metadata.

Parameter description:

- `taskId`: task ID to reset.

Behavior summary:

- Stops alive observer first when the task is in alive mode.
- Unmounts mounted component instance and removes injected root element.
- Aborts listener and stops watcher.
- Keeps the task entry in context, so the task can be reused.

### `Injector.resetAll(): void`

Resets all registered tasks to reusable initial runtime state.

Behavior summary:

- Stops alive observers for all alive tasks first.
- Calls context-level full reset once to clean runtime fields of every task.
- Keeps task registrations and task IDs in context.

### `createActivityStore<T>(initialValue: T)`

Creates a lightweight activity store compatible with listener activity APIs.

Returned store contract:

| Member | Type | Description |
| --- | --- | --- |
| `get` | `() => T` | Reads the current value. |
| `subscribe` | `(listener: (value: T) => void) => SignalUnsubscribe` | Subscribes to changes. |
| `set` | `(value: T) => void` | Replaces the current value. |
| `update` | `(updater: (value: T) => T) => void` | Computes the next value from the current value. |

**Minimal example:**

```ts
import { createActivityStore, Injector } from 'vue-implant';

const injector = new Injector();
const activity = createActivityStore(true);

injector.registerListener('#btn', 'click', () => console.log('clicked'), () => activity);

activity.set(false);
```

> [!NOTE]
> Passing Vue `ref`-like sources is still supported in `1.x`, but deprecated and planned for removal in `2.0`. New code should prefer `createActivityStore()`.

### `Injector.bindListenerSignal(taskId: string, source: ActivitySignalSource<boolean>): boolean`

Binds an external reactive signal to listener activation: listener opens when `true`, closes when `false`.

Parameter description:

- `taskId`: task ID (must be a task configured with `on`).
- `source`: `ActivitySignalSource<boolean>`, usually a store created by `createActivityStore()`.

**Minimal example:**

```ts
import { createActivityStore, Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const enabled = createActivityStore(true);

const { taskId } = injector.register('#app', TestAppComponent, {
	on: {
		listenAt: '#btn',
		type: 'click',
		callback: () => console.log('clicked')
	}
});

injector.bindListenerSignal(taskId, enabled);
injector.run();
```

### `Injector.controlListener(taskId: string, event: ActionEvent): boolean`

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

injector.controlListener(taskId, Action.OPEN);
injector.controlListener(taskId, Action.CLOSE);
```

### Additional exported types

The package also exposes advanced TypeScript types for integration and tooling:

- Adapter-related: `MountAdapter`, `ResolvableMountAdapter`, `AdapterMountInput`, `AdapterMountResult`, `AdapterUnmountInput`, `AdapterUnmountReason`, `AdapterResolver`
- Vue mount-related: `VueMountArtifact`, `VueMountHandle`, `VueMountInstance`
- Signal-related: `ActivitySignalSource`, `ActivitySignalSubscribable`, `SignalUnsubscribe`

## Limitations ⚠️

- `iframe` injection is currently not supported. In the current architecture, style injection and lifecycle management inside `iframe` are not fully handled.
- From a performance perspective, each injected component creates an independent Vue instance. In high-volume injection scenarios, the reactivity system and virtual DOM may introduce additional overhead.

## FAQ ❓

### 1) Can I call `register` / `registerListener` after `run()`?

Yes. New registrations are allowed after `run()`. Call `run()` again to activate newly registered tasks. Existing active/pending tasks are skipped.

### 2) Does duplicate `registerListener` throw an error?

No. Re-registering the same `listenAt + event` emits a warning and returns the same `taskId`.

### 3) Should I use `local` or `global` for `scope`?

- `local`: smaller observation scope, lower side effects, recommended by default.
- `global`: more robust for local DOM rebuild scenarios, but with a larger observation scope and higher performance cost.

### 4) Can `enableAlive`/`disableAlive` be used for pure listener tasks?

No. Calling these APIs on pure listener tasks returns immediately with warnings.

### 5) Should I use `use()` or `setPinia()` for Pinia?

Prefer `use(createPinia())` for new code. `setPinia()` is still supported in `1.x` as a compatibility alias, so existing integrations do not need an immediate migration.

### 6) Can I pass Vue `ref<boolean>` to `activitySignal` or `bindListenerSignal`?

Yes in `1.x`, but this compatibility path is deprecated and planned for removal in `2.0`. Prefer `createActivityStore(true)` for new code.

### 7) Are plugins registered by `use()` scoped per injector?

No. They are stored in the singleton `VuePlugin` registry and are therefore shared by injector instances in the same runtime.

## Roadmap 🛣️

- [x] **Refactor and decouple injector logic:** split injection flows into smaller modules with clearer responsibilities.
- [x] **Implement a simple logging system:** Replace multiple `console` calls within the module, and uniformly output logs through built-in or externally integrated logging modules
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

**Run demo app:**

```bash
npm run demo:dev
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
