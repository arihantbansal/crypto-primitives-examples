import assert from 'node:assert/strict';
import { test } from 'node:test';

import { optionalComputeUnits } from '../src/lib/transaction-metadata';

void test('confirmed transaction metadata is optional', async () => {
    assert.equal(await optionalComputeUnits(Promise.resolve({ meta: { computeUnitsConsumed: 42n } })), 42n);
    assert.equal(await optionalComputeUnits(Promise.resolve(null)), null);
    assert.equal(await optionalComputeUnits(Promise.reject(new Error('RPC unavailable'))), null);
});
