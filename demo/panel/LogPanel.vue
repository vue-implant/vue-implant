<script setup lang="ts">
defineOptions({ name: 'LogPanel' })

import { useLogs } from '../logger'

const { logs, clearLogs } = useLogs()
</script>

<template>
    <div class="log-panel">
        <div class="log-header">
            <span>📋 Injector log</span>
            <button class="btn btn-ghost" @click="clearLogs">clear</button>
        </div>
        <div class="log-body">
            <div v-for="(log, i) in logs" :key="i" :class="['log-item', `log-${log.level}`]">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-msg">{{ log.msg }}</span>
            </div>
            <div v-if="!logs.length" class="log-empty">No logs available</div>
        </div>
    </div>
</template>

<style scoped>
.log-panel {
    width: 360px;
    flex-shrink: 0;
    background: #0f172a;
    border-left: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 57px);
    position: sticky;
    top: 57px;
}

.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #1e293b;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
}

.log-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.log-item {
    display: flex;
    gap: 8px;
    padding: 4px 14px;
    font-size: 11.5px;
    line-height: 1.5;
    border-bottom: 1px solid #1e293b22;
}

.log-time {
    color: #475569;
    flex-shrink: 0;
}

.log-msg {
    word-break: break-all;
}

.log-info .log-msg {
    color: #7dd3fc;
}

.log-warn .log-msg {
    color: #fbbf24;
}

.log-error .log-msg {
    color: #f87171;
}

.log-empty {
    text-align: center;
    color: #334155;
    font-size: 13px;
    margin-top: 40px;
}

.btn {
    border: none;
    border-radius: 7px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity .15s;
}

.btn:not(:disabled):hover {
    opacity: .85;
}

.btn-ghost {
    background: transparent;
    color: #64748b;
}
</style>
