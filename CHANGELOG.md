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
