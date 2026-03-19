<script setup lang="ts">
defineOptions({ name: 'PureListenerCase' })
</script>

<template>
    <div class="zone">
        <p>Pure Native Listeners: Framework-level registration (No Vue Injection)</p>
        <button id="case-listener-button" class="btn">📍Trigger Listener</button>
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
