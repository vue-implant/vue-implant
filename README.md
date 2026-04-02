<p align="center">
  <img width="150" src="./demo/public/vue-implant-icon.png" alt="Addfox">
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

Public demo site: https://flowingink.github.io/vue-implant/

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
};
```

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `alive` | `boolean` | Whether to enable global re-injection. | `false` |
| `scope` | `'local' \| 'global'` | `local` binds listeners to the target element's parent; `global` mounts listeners to `body`, so listeners can remain active when local DOM is rebuilt. | `'local'` |
| `timeout` | `number` | Timeout threshold (ms) for initial injection and re-injection. Setting it explicitly to `undefined` is not recommended. | `5000` |
| `logger` | `ILogger` | Custom logger implementation. When omitted, the built-in logger is used. | built-in logger |

### `Injector.run(): void`

Starts the injection process and handles registered tasks.

> [!NOTE]
> `run()` is idempotent. Repeated calls are safe and only activate tasks that are not already active/pending.

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
| `enableAlive` | `() => void` | Manually enables re-injection; empty function when registration fails. | callback function |
| `disableAlive` | `() => void` | Manually disables re-injection; empty function when registration fails. | callback function |

> [!NOTE]
> Re-registering the same component at the same target will not throw; it warns and returns the first registration result.

> [!NOTE]
> You can call `register()` after `run()`. The new task will be activated on the next `run()` call.

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
| `isSuccess` | `boolean` | Whether registration succeeds. |

> [!NOTE]
> Re-registering the same `listenAt + event` will not throw; it warns and returns the same `taskId`.

> [!NOTE]
> You can call `registerListener()` after `run()`. The new listener task will be activated on the next `run()` call.

### `Injector.use(plugin: Plugin): this`

Registers a shared Vue plugin for every injected app created by the current `Injector`.

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

Returns the shared plugins currently registered on the injector.

### `Injector.setPinia(pinia: Plugin): void`

Legacy compatibility alias for Pinia-based setups. It still works and internally registers Pinia as a shared plugin.

> [!NOTE]
> New Version should prefer `use()` / `usePlugins()`. `setPinia()` and `getPinia()` remain available for backward compatibility in `1.x`.

### `Injector.getPinia(): Plugin | undefined`

Returns the Pinia instance previously set through `setPinia()`.

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

### `Injector.bindListenerSignal(taskId: string, source: WatchSource<boolean>): boolean`

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
