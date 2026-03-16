<script setup lang="ts">
import { ref, computed, inject, onUnmounted } from 'vue';
import Target from './Target.vue';
import { type Injector } from '../../src';
const props = defineProps<{
    title: string
    index: string | number
    componentAt?: string
    desc: string
    targetLabel: string
    disappearTime: number
    appearTime: number
    isAlive: boolean
}>();
let timer: ReturnType<typeof setTimeout> | null = null;
const isShowDelay = ref(true);
type TargetResults = {
    injectorInstance: Injector
    target1: ReturnType<Injector['register']>
    target2: ReturnType<Injector['register']>
    target3: ReturnType<Injector['register']>
    target4: ReturnType<Injector['register']>
    target6: ReturnType<Injector['register']>
}

type Phase = 'idle-visible' | 'pending-hide' | 'idle-hidden' | 'pending-show';
const phase = ref<Phase>('idle-visible');
const aliveActive = ref(props.isAlive); // tracks whether alive observer is active

const disappearDisabled = computed(() => phase.value !== 'idle-visible');
const appearDisabled = computed(() => phase.value !== 'idle-hidden');
const targetResults = (inject<TargetResults>('componentInfo') as TargetResults);

const disappearTarget = () => {
    if (disappearDisabled.value) return;
    phase.value = 'pending-hide';
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(() => {
        isShowDelay.value = false;
        phase.value = 'idle-hidden';
    }, props.disappearTime);
}

const appearTarget = () => {
    if (appearDisabled.value) return;
    phase.value = 'pending-show';
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(() => {
        isShowDelay.value = true;
        phase.value = 'idle-visible';
    }, props.appearTime);
}

const handleKeepAlive = () => {
    targetResults.target6.keepAlive();
    aliveActive.value = true;
}

const handleStopAlive = () => {
    targetResults.target6.stopAlive();
    aliveActive.value = false;
}

onUnmounted(() => {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
});


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
                <template v-if="props.isAlive">
                    <button class="btn btn-alive" @click="handleKeepAlive" :disabled="aliveActive">
                        keepAlive
                    </button>
                    <button class="btn btn-alive-stop" @click="handleStopAlive" :disabled="!aliveActive">
                        stopAlive
                    </button>
                </template>
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

.btn-alive {
    background: #14532d;
    color: #86efac;
    border: 1px solid #22c55e44;
}

.btn-alive-stop {
    background: #7f1d1d;
    color: #fca5a5;
    border: 1px solid #ef444444;
}
</style>