<script setup lang="ts">
import Target from './Target.vue';

const props = defineProps<{
    title: string
    index: string | number
    componentAt?: string
    listenerAt?: string
    desc: string
    targetLabel: string
}>()

const activitySignal = defineModel<boolean>('activitySignal');
const updateState = () => {
    activitySignal.value = !Boolean(activitySignal.value);
}

</script>
<template>
    <Target v-bind="props" :activitySignal="activitySignal">
        <template #secondaryBtn>
            <div class="btn-group">
                <button class="btn btn-secondary" :id="`target-${index}-btn`">
                    Click to trigger event listening
                </button>
                <button :class="activitySignal ? 'btn btn-danger' : 'btn btn-run'" @click="updateState">
                    {{ activitySignal ? 'Pause Listening' : 'Resume Listening' }}
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

.btn-danger {
    background: #7f1d1d;
    color: #fca5a5;
}

.btn-run {
    background: #6366f1;
    color: #fff;
}
</style>