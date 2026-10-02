import { Toaster } from './ui/sonner';
import { AppHeader } from './app-header';

export function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-dvh">
            <a
                className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                href="#main-content"
            >
                Skip to content
            </a>
            <AppHeader />
            <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl scroll-mt-24 px-6 pt-24 pb-12">
                {children}
            </main>
            <Toaster />
        </div>
    );
}
