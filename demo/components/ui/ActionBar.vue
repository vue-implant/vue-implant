<script setup lang="ts">
defineOptions({ name: 'ActionBar' })

const props = defineProps<{
    activitySignal: boolean
}>()

const emit = defineEmits<{
    run: []
    reset: []
    'update:activitySignal': [value: boolean]
}>()
</script>

<template>
    <section class="actions">
        <div class="btn-group">
            <button class="btn btn-primary"  @click="emit('run')">
                Run Injector
            </button>
            <button class="btn btn-plain" @click="emit('reset')">
                Reset Demo
            </button>
        </div>

        <label class="switch">
            <input type="checkbox" :checked="props.activitySignal"
                @change="emit('update:activitySignal', ($event.target as HTMLInputElement).checked)">
            <span>activitySignal: {{ props.activitySignal ? 'On' : 'Off' }}</span>
        </label>
    </section>
</template>

<style scoped>
.actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding: 14px 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.45);
    box-shadow:
        0 10px 15px -3px rgba(0, 0, 0, 0.05),
        0 4px 6px -2px rgba(0, 0, 0, 0.02),
        inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.btn-group {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.btn {
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.btn-primary {
    border: 1px solid #229a55;
    background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
    color: #ffffff;
    box-shadow: 0 2px 0 #1e8449;
}

.btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 10px rgba(39, 174, 96, 0.28);
}

.btn-plain {
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(4px);
    border: 1px solid #b2dfdb;
    color: #1a4d44;
}

.btn-plain:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: #27ae60;
    color: #117a3b;
}

.switch {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #234e52;
    font-size: 13px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.45);
    border: 1px solid #d6f1e7;
    border-radius: 999px;
    padding: 6px 10px;
}

.switch input {
    accent-color: #27ae60;
    width: 14px;
    height: 14px;
}
</style>
