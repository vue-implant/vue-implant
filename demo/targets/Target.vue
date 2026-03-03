<script setup lang="ts">

const props = withDefaults(defineProps<{
    title: string
    index: string
    componentAt?: string
    listenerAt?: string
    desc: string
    targetLabel: string
}>(), {
});

const isShowDelay = defineModel<boolean>('isShowDelay', { default: true });
const isShowTargetBox = defineModel<boolean>('isShowTargetBox', { default: true });
const activitySignal = defineModel<boolean>('activitySignal', { default: undefined });


</script>
<template>
    <section class="card">
        <div class="card-title">
            <span class="badge-num">{{ index }}</span>
            {{ title }}
        </div>
        <div class="card-desc-area">
            <p class="card-desc" v-if="componentAt">componentAt: <code>{{ componentAt }}</code></p>
            <p class="card-desc" v-if="listenerAt">listenerAt: <code>{{ listenerAt }}</code></p>
            <p class="card-desc" v-if="activitySignal !== undefined">
                <span :class="activitySignal ? 'tag-on' : 'tag-off'">
                    Activity Signal: {{ activitySignal ? '✅ Listening' : '🚫 Paused' }}
                </span>
            </p>
            <p class="card-desc" v-else>
                <span class="tag-on">
                    Activity Signal: Not provided
                </span>
            </p>
            <p class="card-desc">Desc: <code>{{ desc }}</code></p>
        </div>
        <slot name="conditionalBtn"></slot>
        <template v-if="isShowTargetBox">
            <div class="target-box" v-if="isShowDelay" :id="`target-${index}`">
                <span class="target-label">{{ targetLabel }}</span>
            </div>
            <div v-else class="target-placeholder">[ The target has not yet appeared ]</div>
        </template>
        <slot name="secondaryBtn"></slot>
    </section>
</template>
<style scoped>
.card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 18px 20px;
}

.card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 6px;
}

.badge-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: #6366f1;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
}

.card-desc {
    font-size: 13px;
    color: #94a3b8;
}

.card-desc-area {
    display: flex;
    gap: 20px
}

.card-desc code {
    background: #0f172a;
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 12px;
    color: #7dd3fc;
}

.target-box {
    display: flex;
    align-items: center;
    min-height: 24px;
    background: #0f172a;
    border: 2px dashed #475569;
    border-radius: 8px;
    padding: 8px 14px;
    margin: 8px 0;
}

.target-label {
    font-size: 12px;
    color: #64748b;
}

.target-placeholder {
    font-size: 13px;
    color: #475569;
    margin: 8px 0;
    padding: 8px;
    border: 1px dashed #334155;
    border-radius: 6px;
    text-align: left;
    ;
}

.tag-on {
    color: #4ade80;
    font-weight: 600;
}

.tag-off {
    color: #f87171;
    font-weight: 600;
}

.click-log {
    margin: 8px 0 0;
    padding: 0 0 0 16px;
    font-size: 12px;
    color: #7dd3fc;
    max-height: 80px;
    overflow-y: auto;
}
</style>