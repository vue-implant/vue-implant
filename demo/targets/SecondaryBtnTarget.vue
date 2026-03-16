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

</script>
<template>
    <Target v-bind="props">
        <template #secondaryBtn>
            <button class="btn btn-secondary" :id="`target-${index}-btn`">
                Click to trigger event listening
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