export function demoStorageKey(demo: string, clusterId: string, endpoint: string): string {
    return `crypto-primitives-${demo}-demo:${encodeURIComponent(clusterId)}:${encodeURIComponent(endpoint)}`;
}

export function loadDemoState<T>(key: string): T | null {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

export function saveDemoState(key: string, state: unknown): void {
    sessionStorage.setItem(key, JSON.stringify(state));
}

export function clearDemoState(key: string): void {
    sessionStorage.removeItem(key);
}
