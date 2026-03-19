<script setup lang="ts">
defineOptions({ name: 'InjectedCounter' })

import { ref } from 'vue'
const count = ref(0)
</script>
<template>
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #6366f1;
      border-radius: 8px;
      padding: 4px 10px;
      margin-left: 8px;
      color: #fff;
      font-size: 13px;
    ">
        <button style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1"
            @click="count--">−</button>
        <span>{{ count }}</span>
        <button style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;line-height:1"
            @click="count++">+</button>
    </div>
</template>
