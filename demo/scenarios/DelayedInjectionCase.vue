<script setup lang="ts">
defineOptions({ name: 'DelayedInjectionCase' })

import { inject, onMounted, ref } from 'vue'
import { RegisterResult } from '../../src/type'

const hostVisible = ref(false);
const delayAliveEnabled = ref(true);
const result:RegisterResult = inject<RegisterResult>('delayCase:result') as RegisterResult;


const triggerAlive = () => {
    if (delayAliveEnabled.value) {
        result.stopAlive()
    } else {
        result.keepAlive()
    }
    delayAliveEnabled.value = !delayAliveEnabled.value
}

function triggerDelay() {
    hostVisible.value = false
    window.setTimeout(() => {
        hostVisible.value = true
    }, 1400)
}




onMounted(() => {
    triggerDelay()
})
</script>

<template>
    <div class="zone">
        <p class="description">Tests DOM-wait capability with a 1.4s node delay.</p>

        <div style="display: flex; gap: 8px;">
            <button class="btn-secondary" @click="triggerDelay">
                <span class="icon">⚡</span>Reactivate Delay
            </button>

            <button class="btn-secondary" @click="triggerAlive">
                <span class="icon">🧬</span>Alive: {{ delayAliveEnabled ? 'On' : 'Off' }}
            </button>
        </div>
        <Transition name="fade" mode="out-in">
            <div v-if="hostVisible" id="case-delay-target" class="target">
                <span class="status-dot"></span>
                #case-delay-target
            </div>
            <div v-else class="placeholder">
                <div class="loading-spinner"></div>
                📡 waiting for Targets rebuild
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.zone {
    display: grid;
    gap: 12px;
    color: #234e52;
}

.description {
    margin: 0;
    font-size: 13px;
    opacity: 0.8;
}

.btn-secondary {
    width: fit-content;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(4px);
    border: 1px solid #b2dfdb;
    color: #1a4d44;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: #27ae60;
    color: #117a3b;
}

.target {
    min-height: 42px;
    border-radius: 8px;
    border: 1px solid #27ae60;
    background: linear-gradient(135deg, rgba(209, 247, 234, 0.6) 0%, rgba(255, 255, 255, 0.9) 100%);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #117a3b;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.1);
}

.status-dot {
    width: 8px;
    height: 8px;
    background-color: #27ae60;
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(39, 174, 96, 0.6);
}

.placeholder {
    min-height: 42px;
    border-radius: 8px;
    border: 1px dashed #b2dfdb;
    background: rgba(0, 0, 0, 0.02);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #76797c;
    font-size: 13px;
}

.loading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #b2dfdb;
    border-top-color: #27ae60;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
}
</style>
