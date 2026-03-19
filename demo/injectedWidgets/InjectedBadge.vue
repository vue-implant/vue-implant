<script setup lang="ts">
defineOptions({ name: 'InjectedBadge' })

const props = defineProps<{ label?: string; color?: string }>()
</script>
<template>
    <span :style="{
        background: props.color ?? '#4ade80',
        color: '#fff',
        borderRadius: '999px',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 600,
        boxShadow: '0 1px 4px rgba(0,0,0,.18)',
        marginLeft: '6px',
        display: 'inline-block',
    }">
        {{ props.label ?? '✅ Injection successful' }}
    </span>
</template>
