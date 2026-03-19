<script setup lang="ts">
defineOptions({ name: 'DemoPage' })

import { onMounted, onUnmounted, ref } from 'vue'
import { Injector } from '../src'
import { InjectedBadge, InjectedCounter, InjectedTooltip } from '../demo/testComponent'
import HeroBlock from './components/layout/HeroBlock.vue'
import ActionBar from './components/ui/ActionBar.vue'
import DemoCard from './components/ui/DemoCard.vue'
import EventLog from './components/ui/EventLog.vue'
import { useDemoLogger } from './logger'
import BasicInjectionCase from './scenarios/BasicInjectionCase.vue'
import DelayedInjectionCase from './scenarios/DelayedInjectionCase.vue'
import EventBindingCase from './scenarios/EventBindingCase.vue'
import PureListenerCase from './scenarios/PureListenerCase.vue'
import SignalListenerCase from './scenarios/SignalListenerCase.vue'

const isRunning = ref(false)
const activitySignal = ref(true)
const reinjectActive = ref(false)
const { logs, addLog, patchConsoleForInjector } = useDemoLogger()

const injector = new Injector({ alive: false, scope: 'local' })
let restoreConsole: (() => void) | null = null

injector.register('#case-basic-target', InjectedBadge, {
    alive: false,
})

injector.register('#case-delay-target', InjectedBadge, {
    alive: true,
})

injector.register('#case-event-target', InjectedCounter, {
    on: {
        listenAt: '#case-event-button',
        type: 'click',
        callback: () => addLog('Case 3: on.listenAt callback fired.'),
    },
})

injector.register('#case-signal-target', InjectedTooltip, {
    on: {
        listenAt: '#case-signal-button',
        type: 'click',
        callback: () => addLog('Case 4: callback fired with activitySignal.'),
        activitySignal: () => activitySignal,
    },
})

injector.registerListener('#case-listener-button', 'click', () => {
    addLog('Case 5: pure listener fired (no component injection).')
})

injector.register('#case-reinject-target', InjectedBadge, {
    alive: true,
    scope: 'local',
})

function run() {
    if (isRunning.value) {
        addLog('Injector is already running. Reset first.')
        return
    }
    injector.run()
    isRunning.value = true
    reinjectActive.value = true
    addLog('Injector started: 6 demo cases are running.')
}


function reset() {
    injector.resetedAll()
    isRunning.value = false
    reinjectActive.value = false
    activitySignal.value = true
    addLog('Reset complete: all task states reset.')
}

onMounted(() => {
    restoreConsole = patchConsoleForInjector()
    addLog('Page loaded. Click "Run Injector" to start.')
})

onUnmounted(() => {
    restoreConsole?.()
    injector.destroyedAll()
})
</script>

<template>
    <main class="page">
        <HeroBlock class="hero-card" title="Vue Implant"
            description="A breath of fresh air for legacy DOM — seamless Vue 3 integration for any website." />

        <section class="content-row">
            <section class="demo-container">
                <DemoCard title="🔩Basic">
                    <BasicInjectionCase />
                </DemoCard>

                <DemoCard title="⏱️Delay node">
                    <DelayedInjectionCase />
                </DemoCard>

                <DemoCard title="🧩component && outside Listener">
                    <EventBindingCase />
                </DemoCard>

                <DemoCard title="📡Signal listener">
                    <SignalListenerCase />
                </DemoCard>

                <DemoCard title="📜Pure listener">
                    <PureListenerCase />
                </DemoCard>

                <!-- <DemoCard title="Case 6: Reinject" subtitle="alive: true + node repeatedly unmounts/remounts">
                    <ReinjectCase :active="reinjectActive" />
                </DemoCard> -->
            </section>

            <div class="status-panel">
                <ActionBar :isRunning="isRunning" v-model:activitySignal="activitySignal" @run="run" @reset="reset" />
                <EventLog :logs="logs" />
            </div>
        </section>

    </main>
</template>

<style scoped>
* {
    box-sizing: border-box;
}

.status-panel {
    display: flex;
    flex-direction: column;
    width: 350px;
    gap: 2px
}

.content-row {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 20px;
}

.page {
    min-height: 100vh;
    padding: 26px;
    display: grid;
    gap: 16px;
    background: linear-gradient(135deg,
            #d1f7ea 0%,
            #e8fbf5 35%,
            #e1f5fe 70%,
            #f3faff 100%);
    font-family: 'Segoe UI', system-ui, sans-serif;
}

.hero-card {
    justify-self: center;
}

.demo-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
}

@media (max-width: 768px) {
    .content-row {
        flex-direction: column;
        align-items: center;
    }

    .status-panel {
        width: 100%;
        max-width: 460px;
    }

    .page {
        padding: 16px;
    }
}
</style>
