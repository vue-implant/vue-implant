<p align="center">
  <img width="150" src="./demo/assets/vue-implant-icon.png">
</p>


<h1 align="center">Vue-implant</h1>
<p align="center">基于vue组件的轻量级注入框架</p>

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
  <a href="./README.md">English</a> | 中文
</div>

---



`vue-implant` 是一个主要面向油猴脚本开发场景的 Vue 组件注入框架。

它能够在琐碎的油猴开发当中把**注入**这一操作统合起来，告别繁琐的底层**DOM**操作。同时还提供了一套声明式的注入机制，助力开发者构建高性能、易维护的脚本应用。

推荐配合 [vite-plugin-monkey](https://github.com/lisonge/vite-plugin-monkey) 使用。将 `vue-implant` 的组件注入能力与 Vite 的现代构建优势相结合，带给你前所未有的**油猴开发全家桶**体验。

## 目录 📚

- [演示](#演示)
- [安装](#安装)
- [最佳实践](#最佳实践)
- [快速开始](#快速开始)
- [兼容性](#兼容性)
- [API](#api)
- [限制](#限制)
- [常见问题（FAQ）](#常见问题faq)
- [路线图](#路线图)
- [开发](#开发)
- [贡献](#贡献)
- [License](#license)

## 演示 🎬

公开演示站点：https://vue-implant.github.io/vue-implant/

## 安装 📦

支持 `npm`、`pnpm`、`yarn`：

```bash
npm install vue-implant
```

```bash
pnpm add vue-implant
```

```bash
yarn add vue-implant
```

## 最佳实践 ✅

在油猴项目中，推荐组合：`vite-plugin-monkey + vue-implant`。

- `vite-plugin-monkey`：处理脚本构建、元信息、开发调试与发布流程。
- `vue-implant`：处理复杂页面中的组件挂载、目标等待、重注入与任务生命周期。

这个组合可以让你把工程化能力和页面注入能力解耦：前者专注“如何构建油猴脚本”，后者专注“如何稳定改造目标网页”。

## 快速开始 ⚡

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

## 兼容性 ✅

- Vue：`3.x`
- 运行环境：现代浏览器页面环境（如油猴脚本、浏览器扩展 content script）
- iframe：当前不支持

## API 🧩

### `new Injector(config?: Partial<InjectionConfig>)` 🏗️

创建 `Injector` 实例。

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
| `alive` | `boolean` | 是否启用全局重注入机制。 | `false` |
| `scope` | `'local' \| 'global'` | `local` 将监听器绑定在目标元素父节点；`global` 挂载到 `body`，在局部 DOM 重建时监听仍可持续。 | `'local'` |
| `timeout` | `number` | 初始注入与重注入的超时阈值（毫秒）。不建议显式设置为 `undefined`。 | `5000` |
| `logger` | `ILogger` | 自定义日志实现；未传入时使用内置 logger。 | 内置 logger |
| `observer` | `ObserverHub` | 可选可观测中心，用于订阅运行时事件。 | `new ObserverHub()` |
| `hooks` | `LifecycleHookMap` | 可选全局生命周期钩子，在 Injector 创建时统一注册。 | `undefined` |

### `Injector.run(): void`

启动注入流程，处理已注册任务。

> [!NOTE]
> `run()` 具备幂等性，可重复调用。重复调用只会激活未处于 active/pending 的任务。

### `Injector.register(injectAt: string, component: Component, option?: ComponentOptions): RegisterResult`

注册组件注入任务。运行时会在内部解析匹配的挂载适配器，默认内置 Vue 组件支持。

参数说明：

- `injectAt`：组件注入目标选择器。
- `component`：要注入的 Vue 组件。
- `option`：可选配置。

`option` 结构：

| Property | Required | Type | Description |
| --- | --- | --- | --- |
| `alive` | no | `boolean` | 是否开启重注入（未设置时使用全局配置）。 |
| `scope` | no | `'local' \| 'global'` | 重注入监听范围（未设置时使用全局配置）。 |
| `on` | no | `object` | 外部事件绑定配置。 |
| `on.listenAt` | yes | `string` | 监听目标元素选择器。 |
| `on.type` | yes | `string` | 事件类型。 |
| `on.callback` | yes | `EventListener` | 事件回调。 |
| `on.activitySignal` | no | `() => ActivitySignalSource<boolean>` | 外部控制监听开关的信号。`1.x` 仍兼容 Vue `ref` 类对象，但已标记废弃。 |
| `hooks` | no | `LifecycleHookMap` | 组件级生命周期钩子（仅 `register` 组件任务支持）。 |

返回值：

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `taskId` | `string` | 任务唯一标识。 | `[ArtifactName]@[CSS选择器]` 或 `artifact-[CSS选择器]` |
| `isSuccess` | `boolean` | 注册是否成功。 | 成功 `true`，失败 `false` |
| `enableAlive` | `() => void` | 手动开启重注入；注册失败时为空函数。 | 回调函数 |
| `disableAlive` | `() => void` | 手动关闭重注入；注册失败时为空函数。 | 回调函数 |

> [!NOTE]
> 重复注册同一组件到同一位置时不会抛错，会报警告并返回第一次注册结果。

> [!NOTE]
> 支持在 `run()` 后继续 `register()`，新增任务会在下一次 `run()` 时激活。

### `Injector.registerListener(listenAt: string, event: string, callback: EventListener, activitySignal?: () => ActivitySignalSource<boolean>): ListenerRegisterResult`

注册纯监听任务（不注入组件）。

参数说明：

- `listenAt`：监听目标元素选择器。
- `event`：监听事件类型。
- `callback`：事件回调。
- `activitySignal`：可选，返回 `ActivitySignalSource<boolean>` 用于动态控制监听开关。

返回值：

| Property | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | 监听任务唯一标识。 |
| `isSuccess` | `boolean` | 注册是否成功。 |

> [!NOTE]
> 重复注册同一个 `listenAt + event` 不会抛错，会报警告并返回相同 `taskId`。

> [!NOTE]
> 支持在 `run()` 后继续 `registerListener()`，新增监听任务会在下一次 `run()` 时激活。

### `Injector.use(plugin: Plugin): this`

在当前运行时的单例 Vue 插件注册表中注册共享插件，供 `Injector` 创建的 Vue 子应用复用。

**最小示例：**

```ts
import { createPinia } from 'pinia';
import { Injector } from 'vue-implant';

const injector = new Injector();

injector.use(createPinia());
```

### `Injector.usePlugins(...plugins: Plugin[]): this`

按注册顺序为当前 `Injector` 批量注册共享 Vue 插件。

**最小示例：**

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

返回当前单例 Vue 插件注册表中的共享插件列表。

### `Injector.setPinia(pinia: Plugin): void`

面向 Pinia 场景保留的兼容别名。它仍然可用，内部会把 Pinia 作为共享插件注册。

> [!NOTE]
> 新版本建议优先使用 `use()` / `usePlugins()`。`setPinia()` 与 `getPinia()` 在 `1.x` 中仍保留兼容。

### `Injector.getPinia(): Plugin | undefined`

返回此前通过 `setPinia()` 设置的 Pinia 实例。

### `VuePlugin`

单例共享插件注册表，提供高级编排能力。`Injector.use()`、`Injector.usePlugins()`、`Injector.setPinia()` 及相关 getter 都基于它实现。

可用方法：`use`、`usePlugins`、`getPlugins`、`setPinia`、`getPinia`、`clear`。

> [!NOTE]
> `VuePlugin` 在当前运行时内是全局共享的。一个 `Injector` 注册的插件，对同页上的其他 `Injector` 也可见。

### `Injector.getObserver(): ObserverHub`

返回当前注入器持有的 `ObserverHub` 实例，可用于注册/移除可观测事件监听。

### `Injector.on(event: ObserveEventName, hook: ObserveHook): () => void`

注册某一个事件的全局观察钩子。

### `Injector.onTask(taskId: string, event: ObserveEventName, hook: ObserveHook): () => void`

注册任务级观察钩子，仅当 `event.taskId === taskId` 时触发。

### `Injector.onAny(hook: ObserveHook): () => void`

注册任意事件的全局观察钩子。

### `Injector.off(event: ObserveEventName, hook?: ObserveHook): void`

移除某个事件下的一个全局钩子，或移除该事件全部全局钩子。

### `Injector.offTask(taskId: string, event?: ObserveEventName, hook?: ObserveHook): void`

按任务、任务+事件、任务+事件+钩子维度移除任务级钩子。

### `Injector.offAny(hook: ObserveHook): void`

移除此前通过 `onAny` 注册的钩子。

### `Injector.getLogger(): ILogger`

返回当前注入器及其默认观察链路所使用的 logger 实例。

### 日志

`vue-implant` 现在会通过统一的 logger 输出内部运行日志，不再在各个模块里直接调用`console`。

- 默认日志格式：`[Vue Implant][LEVEL][ISO_TIMESTAMP] message`

**最小示例：**

```ts
import { Injector, type ILogger } from 'vue-implant';

const logger: ILogger = {
	info: (message, ...args) => console.info(`[我的项目] ${message}`, ...args),
	warn: (message, ...args) => console.warn(`[我的项目] ${message}`, ...args),
	error: (message, ...args) => console.error(`[我的项目] ${message}`, ...args),
	debug: (message, ...args) => console.debug(`[我的项目] ${message}`, ...args)
};

const injector = new Injector({ logger });
```

### 生命周期钩子（ObserverHub）

`vue-implant` 支持通过 `ObserverHub` 订阅生命周期钩子，便于接入监控、埋点、调试日志。

**最小示例：**

```ts
import { Injector, ObserverHub } from 'vue-implant';

const observer = new ObserverHub();
const injector = new Injector({ observer });

const offAny = observer.onAny((event, ctrl) => {
	console.log('[observe]', event.name, event.taskId, event.injectAt, event.status);
});

const offFail = observer.on('inject:fail', (event, ctrl) => {
	console.error('inject failed:', event.taskId, event.error);
});

const offTask = observer.onTask('MyComp@#app', 'task:afterReset', (event, ctrl) => {
	console.log('task reset completed:', event.taskId, event.preStatus, event.status);
});

injector.run();

offFail();
offAny();
offTask();
```

也可以通过配置声明式注册：

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

钩子作用域：

- 全局钩子：在 `new Injector({ hooks })` 中配置，或通过 `injector.on(...)` / `injector.onAny(...)` 注册。
- 组件级钩子：在 `injector.register(injectAt, component, { hooks })` 或`injector.onTask(taskId, event, hook)`中配置。
- 当前组件级钩子仅支持 `register` 创建的组件任务，不支持 `registerListener`。

### 传播控制

每个钩子的第二个参数 `ctrl: PropagationCtrl` 可用于在单次 emit 周期中控制后续分发行为。

| 方法 | 效果 |
| --- | --- |
| `ctrl.stopPropagation()` | 当前作用域内剩余钩子继续执行，但跳过后续作用域。 |
| `ctrl.stopImmediatePropagation()` | 立即中断当前作用域内剩余钩子，并跳过所有后续作用域。 |

单次 emit 的分发顺序：**任务作用域 → 事件作用域 → 全局（any）**

```ts
observer.onTask('MyComp@#app', 'inject:success', (event, ctrl) => {
	console.log('任务层处理完成');
	ctrl.stopPropagation(); // 事件层与全局层不再触发
});

observer.on('inject:success', (event) => {
	// 上方任务层调用了 stopPropagation()，此处被跳过
});

observer.onAny((event) => {
	// 同样被跳过
});
```

> [!NOTE]
> 只写一个参数的旧写法无需修改，`ctrl` 可直接忽略，运行时完全兼容。

生命周期事件载荷：

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

常用事件分组：

- 注册：`register:start` / `register:success` / `register:duplicate` / `register:error`
- 运行：`run:start` / `run:taskScheduled` / `run:taskSkipped` / `target:ready`
- 注入：`inject:start` / `inject:success` / `inject:fail`
- 监听器：`listener:open` / `listener:close` / `listener:attachFail`
- alive：`alive:enable` / `alive:disable` / `alive:observeStart` / `alive:observeStop`
- task：`task:statusChange` / `task:active` / `task:beforeReset` / `task:reset` / `task:afterReset` / `task:beforeDestroy` / `task:destroy` / `task:afterDestroy`
- 资源释放：`resource:watcherReleased` / `resource:listenerReleased` / `resource:componentUnmounted`
- DOM 观察：`dom:readyFound` / `dom:readyTimeout` / `dom:removed` / `dom:restored`

事件载荷约定：

- 大多数任务相关事件都提供规范化基础字段：`taskId`、`kind`、`injectAt`、`status`。
- 状态迁移事件提供 `preStatus`（例如：`task:statusChange`、`task:active`、`task:afterReset`、`task:afterDestroy`）。
- 耗时类事件提供 `durationMs`（例如：`dom:readyFound`、`dom:readyTimeout`、`dom:restored`）。
- 事件专属信息放入 `meta`（例如：`run:start` 统计、`listener:*` 绑定信息、`alive:*` scope/mode）。
- DOM watcher 事件由运行时工厂注入任务上下文，`DOMWatcher` 本身保持业务无关。

### `Injector.enableAlive(taskId: string): void`

开启组件的重注入机制。

参数说明：

- `taskId`：要开启重注入机制的任务 ID。

**最小示例：**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.enableAlive(taskId);
injector.run();
```

> [!NOTE]
> 外部事件监听器注册的任务无法使用该 API，强行调用会报警告并直接返回。

### `Injector.disableAlive(taskId: string): void`

关闭组件任务的重注入机制。

参数说明：

- `taskId`：要关闭重注入机制的任务 ID。

**最小示例：**

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
> 若该任务当前未开启重注入，调用会报警告并直接返回。

### `Injector.destroy(taskId: string): void`

销毁指定任务，并释放关联的监听器、组件实例与状态。

参数说明：

- `taskId`：要销毁的任务 ID。

**最小示例：**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.run();
injector.destroy(taskId);
```

### `Injector.destroyAll(): void`

销毁当前 `Injector` 已注册的全部任务。

**最小示例：**

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

将指定任务重置为可复用的初始运行时状态，同时保留任务注册信息。

参数说明：

- `taskId`：要重置的任务 ID。

行为说明：

- 若任务处于 alive 模式，会先停止 alive 观察器。
- 卸载已挂载的组件实例并移除注入根节点。
- 中止监听器并停止 watcher。
- 任务在上下文中仍保留，可用于后续复用。

### `Injector.resetAll(): void`

将当前已注册的全部任务重置为可复用的初始运行时状态。

行为说明：

- 先停止所有 alive 任务的观察器。
- 统一调用一次上下文级别全量重置，清理每个任务的运行时字段。
- 保留任务注册与任务 ID，不做销毁。

### `createActivityStore<T>(initialValue: T)`

创建一个轻量级 activity store，可直接用于监听开关相关 API。

返回对象约定：

| 成员 | 类型 | 说明 |
| --- | --- | --- |
| `get` | `() => T` | 读取当前值。 |
| `subscribe` | `(listener: (value: T) => void) => SignalUnsubscribe` | 订阅值变化。 |
| `set` | `(value: T) => void` | 直接设置当前值。 |
| `update` | `(updater: (value: T) => T) => void` | 基于当前值计算下一个值。 |

**最小示例：**

```ts
import { createActivityStore, Injector } from 'vue-implant';

const injector = new Injector();
const activity = createActivityStore(true);

injector.registerListener('#btn', 'click', () => console.log('clicked'), () => activity);

activity.set(false);
```

> [!NOTE]
> `1.x` 仍兼容传入 Vue `ref` 类对象，但该路径已废弃并计划在 `2.0` 移除。新代码建议优先使用 `createActivityStore()`。

### `Injector.bindListenerSignal(taskId: string, source: ActivitySignalSource<boolean>): boolean`

将外部响应式信号绑定到任务事件开关：`true` 时开启监听，`false` 时关闭监听。

参数说明：

- `taskId`：任务 ID（需是带 `on` 配置的任务）。
- `source`：`ActivitySignalSource<boolean>`，通常可直接传 `createActivityStore()` 创建的 store。

**最小示例：**

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

手动控制注册的外部事件监听器开关：`Action.OPEN` 开启，`Action.CLOSE` 关闭。

参数说明：

- `taskId`：任务 ID（需是带监听配置的任务）。
- `event`：动作类型，`Action.OPEN` 或 `Action.CLOSE`。

**最小示例：**

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

### 额外导出的类型

包同时导出了一些面向集成和工具链场景的 TypeScript 类型：

- 适配器相关：`MountAdapter`、`ResolvableMountAdapter`、`AdapterMountInput`、`AdapterMountResult`、`AdapterUnmountInput`、`AdapterUnmountReason`、`AdapterResolver`
- Vue 挂载相关：`VueMountArtifact`、`VueMountHandle`、`VueMountInstance`
- Signal 相关：`ActivitySignalSource`、`ActivitySignalSubscribable`、`SignalUnsubscribe`
- Observer 相关：`PropagationCtrl`、`ObserveHook`、`ObserveEvent`、`ObserveEventName`



## 限制 ⚠️

- 当前不支持 `iframe` 注入。在现有架构下，`iframe` 内样式和注入生命周期管理还不完善。
- 性能方面，每个注入组件都会创建一个独立 Vue 实例。在大量注入场景下，响应式系统与虚拟 DOM 可能带来额外开销。

## 常见问题（FAQ）❓

### 1) `run()` 之后还能继续 `register` / `registerListener` 吗？

可以。`run()` 之后依然可以继续注册，新增任务会在下一次 `run()` 时激活；已处于 active/pending 的任务会被跳过。

### 2) `registerListener` 重复注册会抛错吗？

不会。重复注册相同 `listenAt + event` 会报警告，并返回相同 `taskId`。

### 3) `scope` 该选 `local` 还是 `global`？

- `local`：监听范围更小，副作用更低，默认推荐。
- `global`：更稳妥覆盖局部 DOM 重建场景，但监听范围更大,对性能消耗也更大。

### 4) `enableAlive`/`disableAlive` 能用于纯监听任务吗？

不能。纯监听任务调用这两个 API 会直接返回并给出警告。

### 5) Pinia 应该用 `use()` 还是 `setPinia()`？

新代码优先使用 `use(createPinia())`。`setPinia()` 在 `1.x` 里仍然保留，作为兼容别名，现有接入不需要立刻迁移。

### 6) `activitySignal` 或 `bindListenerSignal` 还能传 Vue `ref<boolean>` 吗？

可以，`1.x` 里仍兼容，但这条兼容路径已经废弃，并计划在 `2.0` 移除。新代码建议优先使用 `createActivityStore(true)`。

### 7) `use()` 注册的插件是每个 `Injector` 独立的吗？

不是。它们存放在单例 `VuePlugin` 注册表中，因此同一运行时里的多个 `Injector` 会共享这些插件。

## 路线图 🛣️

- [x] **重构解耦注入器逻辑：**将注入流程拆分为更小、职责更单一的模块。
- [x] **实现简单的日志系统:**   替代模块内部的多次`console`调用,统一由内置或接入外部日志模块进行日志输出
- [ ] **实现单 Vue 实例注入模式：**降低多任务场景下的实例开销，并支持与多实例模式按需选择。



## 开发 🛠️

**构建：**

```bash
git clone https://github.com/FlowingInk/vue-implant.git
cd vue-implant
git switch -c feat/your-feature-name
npm install 
npm run build
```

**运行 demo：**

```bash
npm run demo:dev
```

**测试：**

```bash
npm run test
```

**格式化：**

```bash
npm run lint:fix
```

## 贡献 🤝

欢迎提交 Issue 和 PR，一起完善 `vue-implant`。

## License 📄

本项目基于 MIT License，详见 [LICENSE](LICENSE)。
