<script setup lang="ts">
defineOptions({ name: 'InjectedTooltip' })

import { ref } from 'vue'
const visible = ref(false)
</script>
<template>
    <span style="position:relative;display:inline-block;margin-left:8px">
        <button
            style="background:#f59e0b;border:none;color:#fff;border-radius:6px;padding:3px 12px;cursor:pointer;font-size:12px"
            @mouseenter="visible = true" @mouseleave="visible = false">悬停提示</button>
        <span v-if="visible" style="
        position:absolute;
        bottom:calc(100% + 6px);
        left:50%;
        transform:translateX(-50%);
        background:#1e293b;
        color:#fff;
        border-radius:6px;
        padding:4px 10px;
        font-size:12px;
        white-space:nowrap;
        pointer-events:none;
        z-index:9999;
      ">I am an injected Tooltip 🎉</span>
    </span>
</template>
