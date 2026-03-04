<script lang="ts">
export default { name: 'App' }
</script>
<script setup lang="ts">
import { createPinia } from 'pinia'
import { onMounted, onUnmounted, provide, reactive, ref } from 'vue'
import { Injector } from '../src'
import { addLog, patchConsole } from './logger'
import InjectedBadge from './testComponent/InjectedBadge.vue'
import InjectedCounter from './testComponent/InjectedCounter.vue'
import InjectedTooltip from './testComponent/InjectedTooltip.vue'
import Target from './targets/Target.vue'
import DelayTarget from './targets/DelayTarget.vue'
import SecondaryBtnTarget from './targets/SecondaryBtnTarget.vue'
import SignalTarget from './targets/SignalTarget.vue'
import ListenerTarget from './targets/listenerTarget.vue'
import LogPanel from './panel/LogPanel.vue'
import AppHeader from './panel/AppHeader.vue'
import ReInjectTarget from './targets/ReInjectTarget.vue'


const pinia = createPinia()

let restoreConsole: () => void

let injector: Injector | null = null

const activitySignal = ref(true)       // activity signal toggle
const isRunning = ref(false)
type TargetResults = {
    injectorInstance: Injector | null
    target1: ReturnType<Injector['register']> | null
    target2: ReturnType<Injector['register']> | null
    target3: ReturnType<Injector['register']> | null
    target4: ReturnType<Injector['register']> | null
    target6: ReturnType<Injector['register']> | null
}

// 必须在 setup 顶层调用 provide，这里提供一个响应式对象，后续直接修改其属性
const componentInfo = reactive<TargetResults>({
    injectorInstance: null,
    target1: null,
    target2: null,
    target3: null,
    target4: null,
    target6: null,
})
provide('componentInfo', componentInfo)
provide('isRunning', isRunning)


function runInjector() {
    if (isRunning.value) {
        addLog('warn', '[Demo] Injector is already running, please reset first')
        return
    }

    injector = new Injector({
        alive: false,
        scope: "local"
    });
    injector.setPinia(pinia);

    const target1 = injector.register('#target-1', InjectedBadge);
    console.log('target1', target1)
    const target2 = injector.register('#target-2', InjectedBadge);

    const target3 = injector.register('#target-3', InjectedCounter, {
        on: {
            listenAt: '#target-3-btn',
            type: 'click',
            callback: () => {
                addLog('info', '[Demo] Target 3 button clicked (event listener triggered)')
            }
        },
    });

    const target4 = injector.register('#target-4', InjectedTooltip, {
        on: {
            listenAt: '#target-4-btn',
            type: 'click',
            callback: () => {
                addLog('info', '[Demo] Target 4 button clicked (under activitySignal control)')
            },
            activitySignal: () => activitySignal,
        }
    });

    const listenerId = injector.registerListener(
        '#target-5-btn',
        'click',
        () => {
            const msg = `[Demo] Target 5 pure listener triggered @ ${new Date().toLocaleTimeString()}`
            addLog('info', msg)
        }
    )

    const target6 = injector.register('#target-6', InjectedBadge, {
        alive: true,
        scope: 'local',
    });

    addLog('info', `[Demo] Pure listener registered, id: ${listenerId}`)

    // 更新顶层 provide 的响应式对象
    componentInfo.injectorInstance = injector
    componentInfo.target1 = target1
    componentInfo.target2 = target2
    componentInfo.target3 = target3
    componentInfo.target4 = target4
    componentInfo.target6 = target6

    injector.run()
    isRunning.value = true
    addLog('info', '[Demo] Injector.run() called')
}

function resetInjector() {
    injector?.destroyedAll()
    injector = null
    isRunning.value = false
    addLog('info', '[Demo] Injector destroyed, page has been reset')
}

onMounted(() => {
    restoreConsole = patchConsole()
    addLog('info', '[Demo] Page loaded, click "run Injector" to start debugging')
})
onUnmounted(() => {
    restoreConsole?.()
    injector?.destroyedAll()
})
</script>

<template>
    <div class="page">
        <AppHeader :isRunning="isRunning" @run="runInjector" @reset="resetInjector" />

        <div class="main">
            <div class="targets">
                <Target title="target 1" index=1 componentAt="#target-1" desc="common component injection"
                    targetLabel="Badge component injection point" />

                <DelayTarget title="target 2" index=2 componentAt="#target-2" desc="DOM delayed appearance"
                    targetLabel="Badge component injection point (delayed appearance)" :delayTime="1500" />
                <SecondaryBtnTarget title="target 3" index=3 componentAt="#target-3" listenerAt="#target-3-btn"
                    desc="component injection + event listener" targetLabel="Counter component injection point" />

                <SignalTarget title="target 4" index=4 componentAt="#target-4" listenerAt="#target-4-btn"
                    v-model:activitySignal="activitySignal" desc="Tooltip component injection point"
                    targetLabel="Tooltip component injection point" />

                <ListenerTarget title="target 5" index=5 listenerAt="#target-5-btn"
                    desc="Pure event listening, no need to inject components" targetLabel="listener injection point" />
                <ReInjectTarget title="target 6" index="6" componentAt="#target-6" desc="re-inject mechanism"
                    targetLabel="re-injection point" :disappearTime="1500" :appearTime="1500" :isAlive="true" />
            </div>
            <LogPanel />
        </div>
    </div>
</template>

<style scoped>
* {
    box-sizing: border-box;
}

.page {
    min-height: 100vh;
    background: #0f172a;
    color: #e2e8f0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
}

.main {
    display: flex;
    flex: 1;
    gap: 0;
    min-height: 0;
}

.targets {
    flex: 1;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
}
</style>