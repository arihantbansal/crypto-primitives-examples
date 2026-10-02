import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { featureGateStatus, parseFeatureGates } from '../src/hooks/use-feature-gates';

void describe('feature gate registry data', () => {
    void it('validates entries and keeps the activation epochs used by the UI', () => {
        assert.deepEqual(
            parseFeatureGates([
                {
                    devnet_activation_epoch: 1092,
                    key: 'sha512',
                    mainnet_activation_epoch: null,
                    testnet_activation_epoch: 977,
                },
            ]),
            [
                {
                    devnet_activation_epoch: 1092,
                    key: 'sha512',
                    mainnet_activation_epoch: null,
                    testnet_activation_epoch: 977,
                },
            ],
        );
    });

    void it('rejects malformed registry data', () => {
        assert.throws(() => parseFeatureGates({}), /unexpected format/);
        assert.throws(
            () =>
                parseFeatureGates([
                    {
                        devnet_activation_epoch: null,
                        key: 'sha512',
                        mainnet_activation_epoch: null,
                        testnet_activation_epoch: '977',
                    },
                ]),
            /unexpected format/,
        );
    });

    void it('distinguishes missing, pending, and activated gates', () => {
        assert.equal(featureGateStatus(undefined), 'Unknown');
        assert.equal(
            featureGateStatus({
                devnet_activation_epoch: null,
                key: 'sha512',
                mainnet_activation_epoch: null,
                testnet_activation_epoch: null,
            }),
            'Pending',
        );
        assert.equal(
            featureGateStatus({
                devnet_activation_epoch: 1092,
                key: 'sha512',
                mainnet_activation_epoch: null,
                testnet_activation_epoch: 977,
            }),
            'Testnet, Devnet',
        );
    });
});
