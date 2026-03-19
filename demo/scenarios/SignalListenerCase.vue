<script setup lang="ts">
defineOptions({ name: 'SignalListenerCase' })
</script>

<template>
    <div class="zone">
        <div id="case-signal-target" class="target">#case-signal-target</div>
        <button id="case-signal-button" class="btn">🛰️Trigger Signal Watcher</button>
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

.target {
    min-height: 42px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    border: 1px solid #b2dfdb;
    background: linear-gradient(135deg, rgba(209, 247, 234, 0.4) 0%, rgba(255, 255, 255, 0.8) 100%);
    backdrop-filter: blur(4px);
    padding: 8px 12px;
    color: #2f855a;
    font-family: 'Monaco', 'JetBrains Mono', monospace;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.02);
    transition: all 0.3s ease;
}

.target:hover {
    border-color: #27ae60;
    background: rgba(209, 247, 234, 0.6);
    box-shadow: 0 4px 12px rgba(39, 174, 96, 0.1);
}

.btn {
    width: fit-content;
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(4px);
    border: 1px solid #b2dfdb;
    color: #1a4d44;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: #27ae60;
    color: #117a3b;
}
</style>
