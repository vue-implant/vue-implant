import { ref } from 'vue'

const logs = ref<string[]>([])
const LOGGER_PREFIX = '[Vue Implant]'

export function addLog(msg: string) {
    logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`)
    if (logs.value.length > 12) logs.value.pop()
}

export function patchConsoleForInjector(onLog: (msg: string) => void = addLog) {
    const original = {
        info: console.info,
        log: console.log,
        warn: console.warn,
        error: console.error,
    }

    console.info = (...args) => {
        original.info(...args)
        if (String(args[0]).startsWith(LOGGER_PREFIX)) onLog(args.join(' '))
    }
    console.log = (...args) => {
        original.log(...args)
        if (String(args[0]).startsWith(LOGGER_PREFIX)) onLog(args.join(' '))
    }
    console.warn = (...args) => {
        original.warn(...args)
        if (String(args[0]).startsWith(LOGGER_PREFIX)) onLog(args.join(' '))
    }
    console.error = (...args) => {
        original.error(...args)
        if (String(args[0]).startsWith(LOGGER_PREFIX)) onLog(args.join(' '))
    }

    return () => {
        console.info = original.info
        console.log = original.log
        console.warn = original.warn
        console.error = original.error
    }
}

export function useDemoLogger() {
    return {
        logs,
        addLog,
        patchConsoleForInjector,
    }
}
