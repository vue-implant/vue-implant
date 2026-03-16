<script setup lang="ts">
defineOptions({ name: 'AppHeader' })

defineProps<{
    isRunning: boolean
}>()

const emit = defineEmits<{
    run: []
    reset: []
}>()
</script>

<template>
    <header class="header">
        <h1>🔬 Injector dubug preview</h1>
        <div class="header-actions">
            <button class="btn btn-run" :disabled="isRunning" @click="emit('run')">
                ▶ run Injector
            </button>
            <button class="btn btn-reset" @click="emit('reset')">
                ↺ reset
            </button>
        </div>
    </header>
</template>

<style scoped>
.header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 28px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    position: sticky;
    top: 0;
    z-index: 10;
}

.header h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
}

.header-actions {
    display: flex;
    gap: 10px;
}

.btn {
    border: none;
    border-radius: 7px;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity .15s;
}

.btn:disabled {
    opacity: .45;
    cursor: not-allowed;
}

.btn:not(:disabled):hover {
    opacity: .85;
}

.btn-run {
    background: #6366f1;
    color: #fff;
}

.btn-reset {
    background: #475569;
    color: #fff;
}
</style>
