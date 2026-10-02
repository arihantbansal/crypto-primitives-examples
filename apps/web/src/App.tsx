import { Navigate, Route, Routes, useLocation } from 'react-router';

import { AppLayout } from '@/components/app-layout';
import { AppProviders } from '@/components/app-providers';
import { useClusterConfig } from '@/hooks/use-cluster-config';
import { DemoSessionProvider } from '@/lib/demo-session';
import { AltBn128 } from '@/routes/altbn128';
import { Bls12381 } from '@/routes/bls12381';
import { ElGamal } from '@/routes/elgamal';
import { Overview } from '@/routes/overview';
import { Sha512 } from '@/routes/sha512';

function DemoRoutes() {
    const { id, url } = useClusterConfig();
    const { pathname } = useLocation();

    return (
        <DemoSessionProvider key={JSON.stringify([id, url, pathname])}>
            <Routes>
                <Route
                    path="/"
                    element={
                        <AppLayout>
                            <Overview />
                        </AppLayout>
                    }
                />
                <Route
                    path="/altbn128"
                    element={
                        <AppLayout>
                            <AltBn128 />
                        </AppLayout>
                    }
                />
                <Route
                    path="/bls12381"
                    element={
                        <AppLayout>
                            <Bls12381 />
                        </AppLayout>
                    }
                />
                <Route
                    path="/elgamal"
                    element={
                        <AppLayout>
                            <ElGamal />
                        </AppLayout>
                    }
                />
                <Route
                    path="/sha512"
                    element={
                        <AppLayout>
                            <Sha512 />
                        </AppLayout>
                    }
                />
                <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
        </DemoSessionProvider>
    );
}

export function App() {
    return (
        <AppProviders>
            <DemoRoutes />
        </AppProviders>
    );
}
