<script setup lang="ts">
defineOptions({ name: 'DemoCard' })

const props = defineProps<{
    title: string
}>()
</script>

<template>
    <article class="card">
        <header class="head">
            <div class="window-controls">
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
            <h3>{{ props.title }}</h3>
        </header>
        <div class="content">
            <slot />
        </div>
    </article>
</template>

<style scoped>
.card {
    width: 460px;
    min-height: 170px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    overflow: hidden;

    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow:
        0 10px 15px -3px rgba(0, 0, 0, 0.05),
        0 4px 6px -2px rgba(0, 0, 0, 0.02),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);

    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.3s ease;

    display: flex;
    flex-direction: column;
}

.card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.head {
    background: rgba(255, 255, 255, 0.5);
    border-bottom: 1px solid #b2dfdb;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.window-controls {
    display: flex;
    gap: 6px;
}

.window-controls .dot {
    width: 8px;
    height: 8px;
    background: #b2dfdb;
    border-radius: 50%;
}

.head h3 {
    margin: 0;
    color: #234e52;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.3px;
}

.content {
    padding: 16px;
    color: #232629;
    flex: 1;
}
</style>
