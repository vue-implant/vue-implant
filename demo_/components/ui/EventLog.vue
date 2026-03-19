<script setup lang="ts">
defineOptions({ name: 'EventLog' })

const props = defineProps<{
    logs: string[]
}>()
</script>

<template>
    <section class="log-panel">
        <header class="log-header">
            <h3>Runtime Logs</h3>
            <span class="log-count">{{ props.logs.length }} Events</span>
        </header>
        <ul class="log-list">
            <li v-for="(line, index) in props.logs" :key="index" class="log-item">
                <span class="log-indicator"></span>
                <code class="log-text">{{ line }}</code>
            </li>
        </ul>
    </section>
</template>

<style scoped>
.log-panel {
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid #b2dfdb;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding: 0 4px;
}

.log-header h3 {
    margin: 0;
    color: #234e52;
    font-size: 14px;
    font-weight: 600;
}

.log-count {
    font-size: 11px;
    background: rgba(39, 174, 96, 0.1);
    color: #27ae60;
    padding: 2px 8px;
    border-radius: 10px;
    font-family: 'JetBrains Mono', monospace;
}

.log-list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 220px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    scrollbar-width: thin;
    scrollbar-color: #b2dfdb transparent;
}

.log-list::-webkit-scrollbar {
    width: 4px;
}

.log-list::-webkit-scrollbar-thumb {
    background: #b2dfdb;
    border-radius: 10px;
}

.log-item {
    margin: 0 3px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(178, 223, 219, 0.3);
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    transition: all 0.2s ease;
}

.log-item:hover {
    background: white;
    transform: translateX(2px);
    border-color: #27ae60;
}

.log-indicator {
    width: 3px;
    height: 14px;
    background: #27ae60;
    border-radius: 2px;
    margin-top: 2px;
    flex-shrink: 0;
}

.log-text {
    color: #2f5c76;
    font-size: 12.5px;
    line-height: 1.4;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    word-break: break-all;
}

.log-text :deep(.highlight) {
    color: #1abc9c;
    font-weight: bold;
}
</style>
