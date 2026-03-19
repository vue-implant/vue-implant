<script setup lang="ts">
defineOptions({ name: 'HeroBlock' })

const props = defineProps<{
    title: string
    description: string
}>()
</script>

<template>
    <header class="hero">
        <span class="hero-tag">vue-implant · demo_</span>
        <h1 class="hero-title">{{ props.title }}</h1>
        <span class="hero-desc">{{ props.description }}</span>
    </header>
</template>

<style scoped>
.hero {
    display: flex;
    flex-direction: column;
    gap: 20px;
    align-items: center;
    justify-content: center;
    width: 40%;
    border-radius: 20px;
    padding: 28px;
    background: linear-gradient(135deg, #d2f4ea 0%, #e0f2f1 50%, #f1f8e9 100%);
    border: 1px solid #b2dfdb;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.hero-tag {
    color: #2b7db3;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
}

.hero-title {
    margin: 0px;
    color: #0f2f4a;
    font-size: clamp(28px, 4vw, 38px);
}

.hero-desc {
    color: #2f546e;
    line-height: 1.7;
    max-width: 860px;
    text-align: center;
}
</style>
