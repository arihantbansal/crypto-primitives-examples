interface TransactionWithComputeUnits {
    meta?: { computeUnitsConsumed?: bigint | null } | null;
}

export async function optionalComputeUnits(
    transaction: PromiseLike<TransactionWithComputeUnits | null>,
): Promise<bigint | null> {
    try {
        return (await transaction)?.meta?.computeUnitsConsumed ?? null;
    } catch {
        return null;
    }
}
