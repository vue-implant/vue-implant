<script setup lang="ts">
defineOptions({ name: 'ReinjectCase' })

import { onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
    active: boolean
}>()

const hostVisible = ref(true)
let sequence = 0

function wait(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
    })
}

async function startCycle() {
    const current = ++sequence
    hostVisible.value = true

    while (props.active && current === sequence) {
        await wait(1200)
        if (!props.active || current !== sequence) break
        hostVisible.value = false

        await wait(1200)
        if (!props.active || current !== sequence) break
        hostVisible.value = true
    }
}

watch(
    () => props.active,
    (isActive) => {
        sequence++
        if (isActive) {
            startCycle()
            return
        }
        hostVisible.value = true
    },
    { immediate: true },
)

onUnmounted(() => {
    sequence++
})
</script>

<template>
    <div class="zone">
        <p>After start, the node appears/disappears periodically to show `alive: true` reinjection.</p>
        <div v-if="hostVisible" id="case-reinject-target" class="target">#case-reinject-target</div>
        <div v-else class="placeholder">Target removed (waiting for auto reinjection)...</div>
    </div>
</template>

<style scoped>
.zone {
    display: grid;
    gap: 8px;
    color: #234e52;
    font-size: 13px;
    font-family: "Noto Sans", sans-serif;
}

.zone p {
    margin: 0;
    opacity: 0.8;
}

.target {
    min-height: 42px;
    border-radius: 8px;
    border: 1px solid #27ae60;
    background: linear-gradient(135deg, rgba(209, 247, 234, 0.6) 0%, rgba(255, 255, 255, 0.9) 100%);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    color: #117a3b;
    font-family: 'JetBrains Mono', monospace;
    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.1);
}

.placeholder {
    min-height: 42px;
    border-radius: 8px;
    border: 1px dashed #b2dfdb;
    background: rgba(0, 0, 0, 0.02);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    color: #76797c;
}
</style>
