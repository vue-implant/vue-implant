<script setup lang="ts">
import { onUnmounted } from 'vue';

import Target from './Target.vue';

const props = defineProps<{
    title: string
    index: string | number
    componentAt?: string
    desc: string
    targetLabel: string
    delayTime: number
}>()

const isShowDelayModel = defineModel<boolean>('isShowDelay', { default: true });

let timer: ReturnType<typeof setTimeout> | null = null
function delayShowTarget2() {
    isShowDelayModel.value = true;
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(() => {
        isShowDelayModel.value = false;
    }, props.delayTime);
}

onUnmounted(() => {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
});

</script>
<template>
    <Target v-bind="props" v-model:isShowDelay="isShowDelayModel">
        <template #conditionalBtn>
            <button class="btn btn-secondary" @click="delayShowTarget2">
                Target appears after {{ props.delayTime / 1000 }} seconds
            </button>
        </template>
    </Target>
</template>
<style scoped>
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

.btn-secondary {
    background: #1e3a5f;
    color: #7dd3fc;
    border: 1px solid #2563eb44;
}
</style>