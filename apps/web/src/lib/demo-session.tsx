import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';

interface DemoSession {
    getSignal: () => AbortSignal;
}

const DemoSessionContext = createContext<DemoSession | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
    const controller = useRef(new AbortController());
    const session = useRef<DemoSession>({ getSignal: () => controller.current.signal });

    useLayoutEffect(() => {
        if (controller.current.signal.aborted) controller.current = new AbortController();
        const activeController = controller.current;
        return () => activeController.abort();
    }, []);

    return <DemoSessionContext.Provider value={session.current}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession(): DemoSession {
    const session = useContext(DemoSessionContext);
    if (!session) throw new Error('Demo session is missing');
    return session;
}
