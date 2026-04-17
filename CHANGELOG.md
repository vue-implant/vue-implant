## [1.0.0] - 2026-03-21

### 🚀 Key Features

- **Lifecycle Management**: Automated mounting and unmounting of Vue instances, ensuring zero memory leaks in third-party environments.
- **Smart DOM Detection**: Built-in waiting mechanism to ensure target elements are fully ready before injection, solving race conditions on dynamic pages.
- **Robust Re-injection (Alive Mode)**: Automatically detects when the host page's DOM is rebuilt (e.g., SPA navigation or partial refreshes) and restores your components instantly.
- **Event Listener Integration**: Seamlessly bind reactive listeners to target elements with optional `signal` control for granular event management.
- **Idempotent Execution**: Enhanced `.run()` method that can be called multiple times safely; it only activates pending tasks without side effects.

### 📦 Ecosystem & Deliverables

- **NPM Distribution**: Fully available on Registry for `npm`, `pnpm`, or `yarn`.
- **Live Demo**: Explore the framework's stability and real-world injection scenarios at [flowingink.github.io/vue-implant/](https://flowingink.github.io/vue-implant/).
- **Full API Documentation**: Comprehensive documentation provided in both English and Chinese, covering everything from quick start to advanced patterns.

## [1.0.1] - 2026-03-21

- Relax the versions of vue and pinia

## [1.1.0] - 2026-04-02

- **refactor/modularize:** Injector core and decompose into specialized task modules by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/15
- **feat(injector):** support shared Vue plugins and unified plugin management by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/16
- **Feat/inject enhancement:** add some config to enhancement the dev and support custom Logger DI by ILogger interface @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/17
- **refactor/Split global types:** Split global types into file of different module @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/18
- **fix/lifecycle-routing-leak:** Fix the vulnerability where Injector bypasses TaskLifeCycle and directly calls the internal lifecycle, ensuring state is controlled.  @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/19
- **chore/docs:** Refine README and add best practices by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/20


## [1.2.0] - 2026-04-09

### ✨ Features

- **feat(core):** integrate `ObserverHub` and observability hooks across task lifecycle, and expose observer-related APIs by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/21
- **feat(logger):** add log level control and expose `Injector.getLogger()` by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/22

### 🛠 Fixes

- **fix(logger):** switch to threshold-based level filtering (`debug < info < warn < error`) instead of exact-level matching
- **fix(injector):** ensure default `ObserverHub` reuses the injector logger instance for consistent logger DI behavior

### 📚 Tests & Docs

- add `ObserverHub` unit tests and extend task/injector/watcher tests around observability events
- update README and README.CN with observability hooks and logger usage examples

## [1.2.1] - 2026-04-09

- Fix the return issue in TaskRegister

## [1.3.0] - 2026-04-18

### ✨ Features

- **feat(hooks):** add lifecycle hooks support at injector-level (`new Injector({ hooks })`) and component-level (`register(..., { hooks })`), with unified subscribe/unsubscribe APIs (`on`, `onTask`, `onAny`, `off`, `offTask`, `offAny`) by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/25
- **feat(observe):** expose normalized lifecycle event model and payload matrix for register/run/inject/listener/alive/task/resource/dom events by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/25

### 🛠 Fixes

- **fix(alive):** remove `nextTick` async setup window for alive observers and simplify to synchronous setup; remove `aliveEpoch` from runtime and event payloads by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/26
- **fix(task):** split task runtime into `ComponentTask` / `ListenerTask` and tighten lifecycle routing and cleanup consistency across `TaskContext`, `TaskRunner`, and `TaskLifeCycle` by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/25
- **fix(observe):** normalize and stabilize observe payload builders (`register`, `run`, `inject`, `listener`, `alive`, `task`, `resource`, `dom`) and emit DOM watcher events with named event contracts by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/25

### 📚 Tests & Docs

- add/refresh unit tests for hooks, payload normalization, task context/lifecycle/runner behaviors, and alive semantics
- update `README.md` and `README.CN.md` with lifecycle hook usage, event groups, and detailed payload field tables

### 🧰 Tooling & CI

- add auth tester workflow for NPM/GitHub token validation by @FlowingInk in https://github.com/FlowingInk/vue-implant/pull/24
- migrate dependency management to `pnpm`, remove `package-lock.json`, and add `pnpm-lock.yaml`
- update CI/Pages/patch-release workflows to use `pnpm` install/cache/publish pipeline
