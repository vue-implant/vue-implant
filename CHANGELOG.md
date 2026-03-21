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
