import { useQuery } from '@tanstack/react-query';

const FEATURE_GATES_URL =
    'https://raw.githubusercontent.com/solana-foundation/explorer/master/app/entities/feature-gate/feature-gates.json';

export interface FeatureGateEntry {
    devnet_activation_epoch: number | null;
    key: string;
    mainnet_activation_epoch: number | null;
    testnet_activation_epoch: number | null;
}

function isEpoch(value: unknown): value is number | null {
    return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
}

export function parseFeatureGates(value: unknown): FeatureGateEntry[] {
    if (!Array.isArray(value)) throw new Error('Feature gate registry has an unexpected format');

    return value.map((item: unknown) => {
        if (
            typeof item !== 'object' ||
            item === null ||
            !('key' in item) ||
            typeof item.key !== 'string' ||
            !('devnet_activation_epoch' in item) ||
            !isEpoch(item.devnet_activation_epoch) ||
            !('mainnet_activation_epoch' in item) ||
            !isEpoch(item.mainnet_activation_epoch) ||
            !('testnet_activation_epoch' in item) ||
            !isEpoch(item.testnet_activation_epoch)
        ) {
            throw new Error('Feature gate registry has an unexpected format');
        }

        return {
            devnet_activation_epoch: item.devnet_activation_epoch,
            key: item.key,
            mainnet_activation_epoch: item.mainnet_activation_epoch,
            testnet_activation_epoch: item.testnet_activation_epoch,
        };
    });
}

export function featureGateStatus(entry: FeatureGateEntry | undefined): string {
    if (!entry) return 'Unknown';
    const activeOn = [
        entry.testnet_activation_epoch !== null && 'Testnet',
        entry.devnet_activation_epoch !== null && 'Devnet',
        entry.mainnet_activation_epoch !== null && 'Mainnet',
    ].filter(Boolean);
    if (activeOn.length > 0) return activeOn.join(', ');
    return 'Pending';
}

export function useFeatureGates() {
    return useQuery({
        queryFn: async (): Promise<FeatureGateEntry[]> => {
            const response = await fetch(FEATURE_GATES_URL);
            if (!response.ok) throw new Error(`Feature gate registry request failed: ${response.status}`);
            return parseFeatureGates(await response.json());
        },
        queryKey: ['feature-gates'],
        staleTime: 5 * 60 * 1000,
    });
}
