import assert from 'node:assert/strict';
import { test } from 'node:test';

import { demoStorageKey } from '../src/lib/demo-storage';

void test('demo storage keys distinguish endpoints on the same network', () => {
    const defaultRpc = demoStorageKey('registry', 'solana:devnet', 'https://api.devnet.solana.com');
    const customRpc = demoStorageKey('registry', 'solana:devnet', 'https://rpc.example.test');

    assert.notEqual(defaultRpc, customRpc);
    assert.notEqual(defaultRpc, demoStorageKey('registry', 'solana:localnet', 'https://api.devnet.solana.com'));
    assert.notEqual(defaultRpc, demoStorageKey('multisig', 'solana:devnet', 'https://api.devnet.solana.com'));
    assert.equal(defaultRpc, demoStorageKey('registry', 'solana:devnet', 'https://api.devnet.solana.com'));
});
