<script setup lang="ts">
import { ref, computed } from 'vue';
import Target from './Target.vue';
const props = defineProps<{
    title: string
    index: string
    componentAt?: string
    desc: string
    targetLabel: string
    disappearTime: number
    appearTime: number
}>();
let timer: ReturnType<typeof setTimeout> | null = null;
const isShowDelay = ref(true);

type Phase = 'idle-visible' | 'pending-hide' | 'idle-hidden' | 'pending-show';
const phase = ref<Phase>('idle-visible');

const disappearDisabled = computed(() => phase.value !== 'idle-visible');
const appearDisabled = computed(() => phase.value !== 'idle-hidden');

const disappearTarget = () => {
    if (disappearDisabled.value) return;
    phase.value = 'pending-hide';
    timer = setTimeout(() => {
        isShowDelay.value = false;
        phase.value = 'idle-hidden';
    }, props.disappearTime);
}

const appearTarget = () => {
    if (appearDisabled.value) return;
    phase.value = 'pending-show';
    timer = setTimeout(() => {
        isShowDelay.value = true;
        phase.value = 'idle-visible';
    }, props.appearTime);
}


</script>
<template>
    <Target v-bind="props" v-model:is-show-delay="isShowDelay">
        <template #secondaryBtn>
            <div class="btn-group">
                <button class="btn btn-secondary" @click="disappearTarget" :disabled="disappearDisabled">
                    Disappears in {{ disappearTime / 1000 }}s
                </button>
                <button class="btn btn-secondary" @click="appearTarget" :disabled="appearDisabled">
                    Appears in {{ appearTime / 1000 }}s
                </button>
            </div>
        </template>
    </Target>
</template>
<style scoped>
.btn-group {
    display: inline-flex;
    gap: 12px;
}

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