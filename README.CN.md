# vue-implant 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

`vue-implant` 是一个面向油猴脚本、浏览器扩展等非受控页面环境的 Vue 组件注入框架。

它提供了组件生命周期管理、DOM 等待与目标检测、重注入能力，帮助你在不频繁操作原生 DOM API 的前提下，稳定改造第三方网页。

适用于页面结构不稳定、异步渲染频繁、需要长期运行的注入场景。

## 目录 📚

- [演示](#演示)
- [安装](#安装)
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

暂未提供公开演示站点，可先运行仓库内 `demo/` 进行本地体验。

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
};
```

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `alive` | `boolean` | 是否启用全局重注入机制。 | `false` |
| `scope` | `'local' \| 'global'` | `local` 将监听器绑定在目标元素父节点；`global` 挂载到 `body`，在局部 DOM 重建时监听仍可持续。 | `'local'` |
| `timeout` | `number` | 初始注入与重注入的超时阈值（毫秒）。不建议显式设置为 `undefined`。 | `5000` |

### `Injector.run(): void`

启动注入流程，处理已注册任务。

> [!WARNING]
> 必须在 `run()` 前完成 `register` / `registerListener` 等注册操作；`run()` 之后新增注册会被忽略并给出警告。

### `Injector.register(injectAt: string, component: Component, option?: ComponentOptions): RegisterResult`

注册组件注入任务。

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
| `on.activitySignal` | no | `() => Ref<boolean>` | 外部控制监听开关的信号。 |

返回值：

| Property | Type | Description | Default |
| --- | --- | --- | --- |
| `taskId` | `string` | 任务唯一标识。 | `[组件名]@[CSS选择器]` |
| `isSuccess` | `boolean` | 注册是否成功。 | 成功 `true`，失败 `false` |
| `keepAlive` | `() => void` | 手动开启重注入；注册失败时为空函数。 | 回调函数 |
| `stopAlive` | `() => void` | 手动关闭重注入；注册失败时为空函数。 | 回调函数 |

> [!NOTE]
> 重复注册同一组件到同一位置时不会抛错，会报警告并返回第一次注册结果。

> [!WARNING]
> 在 `run()` 后调用时，`isSuccess` 为 `false`，且 `keepAlive` / `stopAlive` 为空函数。

### `Injector.registerListener(listenAt: string, event: string, callback: EventListener, activitySignal?: () => Ref<boolean>): ListenerRegisterResult`

注册纯监听任务（不注入组件）。

参数说明：

- `listenAt`：监听目标元素选择器。
- `event`：监听事件类型。
- `callback`：事件回调。
- `activitySignal`：可选，返回 `Ref<boolean>` 用于动态控制监听开关。

返回值：

| Property | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | 监听任务唯一标识。 |
| `isSuccess` | `boolean` | 注册是否成功（被忽略时为 `false`）。 |

> [!NOTE]
> 重复注册同一个 `listenAt + event` 不会抛错，会报警告并返回相同 `taskId`。

> [!WARNING]
> 在 `run()` 之后调用时，注册会被忽略，并返回 `isSuccess = false`。

### `Injector.keepAlive(taskId: string): void`

开启组件的重注入机制。

参数说明：

- `taskId`：要开启重注入机制的任务 ID。

**最小示例：**

```ts
import { Injector } from 'vue-implant';
import TestAppComponent from './TestAppComponent.vue';

const injector = new Injector();
const { taskId } = injector.register('#app', TestAppComponent);

injector.keepAlive(taskId);
injector.run();
```

> [!NOTE]
> 外部事件监听器注册的任务无法使用该 API，强行调用会报警告并直接返回。

### `Injector.stopAlive(taskId: string): void`

关闭组件任务的重注入机制。

参数说明：

- `taskId`：要关闭重注入机制的任务 ID。

**最小示例：**

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
> 若该任务当前未开启重注入，调用会报警告并直接返回。

### `Injector.destroyed(taskId: string): void`

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
injector.destroyed(taskId);
```

### `Injector.destroyedAll(): void`

销毁当前 `Injector` 已注册的全部任务。

**最小示例：**

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

将指定任务重置为可复用的初始运行时状态，同时保留任务注册信息。

参数说明：

- `taskId`：要重置的任务 ID。

行为说明：

- 若任务处于 alive 模式，会先停止 alive 观察器。
- 卸载已挂载的组件实例并移除注入根节点。
- 中止监听器并停止 watcher。
- 任务在上下文中仍保留，可用于后续复用。

### `Injector.resetedAll(): void`

将当前已注册的全部任务重置为可复用的初始运行时状态。

行为说明：

- 先停止所有 alive 任务的观察器。
- 统一调用一次上下文级别全量重置，清理每个任务的运行时字段。
- 保留任务注册与任务 ID，不做销毁。

### `Injector.bindActivitySignal(taskId: string, source: WatchSource<boolean>): void`

将外部响应式信号绑定到任务事件开关：`true` 时开启监听，`false` 时关闭监听。

参数说明：

- `taskId`：任务 ID（需是带 `on` 配置的任务）。
- `source`：`WatchSource<boolean>`，通常可直接传 `ref<boolean>`。

**最小示例：**

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

injector.listenerActivity(taskId, Action.OPEN);
injector.listenerActivity(taskId, Action.CLOSE);
```



## 限制 ⚠️

- 当前不支持 `iframe` 注入。在现有架构下，`iframe` 内样式和注入生命周期管理还不完善。
- 性能方面，每个注入组件都会创建一个独立 Vue 实例。在大量注入场景下，响应式系统与虚拟 DOM 可能带来额外开销。

## 常见问题（FAQ）❓

### 1) 为什么 `run()` 后再 `register` / `registerListener` 不生效？

这是设计行为：`run()` 会启动并锁定本轮任务调度。运行后新增注册会被忽略，并返回 `isSuccess = false`（或给出对应警告）。不过这问题会在后面的版本专门出一个API来在`run()`后进行注册，或者是会大改`run()`这个方法。

### 2) `registerListener` 重复注册会抛错吗？

不会。重复注册相同 `listenAt + event` 会报警告，并返回相同 `taskId`。

### 3) `scope` 该选 `local` 还是 `global`？

- `local`：监听范围更小，副作用更低，默认推荐。
- `global`：更稳妥覆盖局部 DOM 重建场景，但监听范围更大,对性能消耗也更大。

### 4) `keepAlive`/`stopAlive` 能用于纯监听任务吗？

不能。纯监听任务调用这两个 API 会直接返回并给出警告。

## 路线图 🛣️

- [ ] **重构解耦注入器逻辑：**将注入流程拆分为更小、职责更单一的模块。
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

