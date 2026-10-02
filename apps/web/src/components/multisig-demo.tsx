import { useEffect, useRef, useState } from 'react';
import { getCreateAccountInstruction } from '@solana-program/system';
import { Badge, Button } from '@solana/design-system';
import {
    AccountRole,
    type Address,
    generateKeyPairSigner,
    type Instruction,
    type KeyPairSigner,
    type Signature,
} from '@solana/kit';

import { useDemoWalletFunding } from '@/components/demo-funding';
import { Connector, FlowDiagram, Stage, type StageState } from '@/components/flow-diagram';
import { BlsTerm } from '@/components/glossary-term';
import {
    OnChainTransactionError,
    useWalletTransactionSignAndSend,
} from '@/components/solana/use-wallet-transaction-sign-and-send';
import { useClusterConfig } from '@/hooks/use-cluster-config';
import { useRpc } from '@/hooks/useRpc';
import {
    addSignersInstructionData,
    aggregatePubkeysHex,
    generateMembers,
    type MemberSet,
    MAX_KEYS_PER_TX,
    G2_POINT_BYTES,
    memberSecrets,
    parseStoredPubkeys,
    restoreMembers,
    signMessage,
    verifyInstructionData,
} from '@/lib/bn254-bls';
import { clearDemoState, demoStorageKey, loadDemoState, saveDemoState } from '@/lib/demo-storage';
import { useDemoSession } from '@/lib/demo-session';
import { ensureFunded, getDemoWallet, InsufficientDemoFundsError } from '@/lib/demo-wallet';
import { getClusterFromClusterId, getSolanaExplorerUrl } from '@/lib/explorer';
import { base64ToBytes } from '@/lib/hex';
import { getProgramAddress } from '@/lib/program';
import { formatTransactionError } from '@/lib/transactionErrors';
import { optionalComputeUnits } from '@/lib/transaction-metadata';
import { ellipsify } from '@/lib/utils';

type Phase = 'creating' | 'generating' | 'idle' | 'keys' | 'ready' | 'verifying';

const MESSAGE = 'approve proposal #42';

interface VerifyResult {
    computeUnits: bigint | null;
    ok: boolean;
    signature: string | null;
    signerAggregateKey: string;
    signerCount: number;
    storedAggregateKey: string;
}

interface StoredMultisig {
    multisig: string;
    secrets: string[];
}

export function MultisigDemo() {
    const rpc = useRpc();
    const signAndSend = useWalletTransactionSignAndSend();
    const { id: clusterId, url: endpoint } = useClusterConfig();
    const { getSignal } = useDemoSession();
    const { dialog: fundingDialog, requestFunding } = useDemoWalletFunding();

    const [wallet, setWallet] = useState<KeyPairSigner | null>(null);
    const [memberCount, setMemberCount] = useState(50);
    const [createdCount, setCreatedCount] = useState<number | null>(null);
    const [signers, setSigners] = useState<Set<number>>(new Set());
    const [phase, setPhase] = useState<Phase>('idle');
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [members, setMembers] = useState<string[]>([]);
    const [multisig, setMultisig] = useState<Address | null>(null);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const memberSet = useRef<MemberSet | null>(null);
    const storageKey = demoStorageKey('multisig', clusterId, endpoint);

    useEffect(() => {
        const signal = getSignal();
        getDemoWallet()
            .then(value => {
                if (!signal.aborted) setWallet(value);
            })
            .catch(() => undefined);
    }, [getSignal]);

    useEffect(() => {
        const stored = loadDemoState<StoredMultisig>(storageKey);
        if (!stored || memberSet.current) return;
        const signal = getSignal();
        (async () => {
            const info = await rpc.getAccountInfo(stored.multisig as Address, { encoding: 'base64' }).send();
            if (signal.aborted) return;
            if (!info.value) {
                clearDemoState(storageKey);
                return;
            }
            const set = await restoreMembers(stored.secrets);
            if (signal.aborted) return;
            memberSet.current = set;
            setMembers(set.pubkeys);
            setMemberCount(set.pubkeys.length);
            setSigners(new Set(set.pubkeys.map((_, i) => i)));
            setCreatedCount(set.pubkeys.length);
            setMultisig(stored.multisig as Address);
            setPhase('ready');
        })().catch(() => undefined);
    }, [getSignal, rpc, storageKey]);

    useEffect(() => {
        if (!multisig || !memberSet.current) return;
        saveDemoState(storageKey, {
            multisig,
            secrets: memberSecrets(memberSet.current),
        } satisfies StoredMultisig);
    }, [multisig, storageKey]);

    async function createKeys() {
        if (!wallet) return;
        const signal = getSignal();
        setPhase('generating');
        setError(null);
        setResult(null);
        try {
            await ensureFunded(rpc, wallet, getClusterFromClusterId(clusterId) === 'localnet');
            if (signal.aborted) return;

            const set = await generateMembers(memberCount);
            if (signal.aborted) return;
            memberSet.current = set;
            setMembers(set.pubkeys);
            setSigners(new Set(set.pubkeys.map((_, i) => i)));
            setCreatedCount(memberCount);
            setMultisig(null);
            setPhase('keys');
        } catch (caught) {
            if (signal.aborted) return;
            if (caught instanceof InsufficientDemoFundsError) {
                requestFunding({ address: caught.address, onFunded: () => void createKeys() });
                setPhase('idle');
                return;
            }
            setError(formatTransactionError(caught));
            setPhase('idle');
        }
    }

    async function register() {
        if (!wallet || !memberSet.current) return;
        const signal = getSignal();
        setPhase('creating');
        setError(null);
        setResult(null);
        setMultisig(null);
        try {
            await ensureFunded(rpc, wallet, getClusterFromClusterId(clusterId) === 'localnet');
            if (signal.aborted) return;

            const set = memberSet.current;
            const count = set.pubkeys.length;
            const space = BigInt(2 + count * G2_POINT_BYTES);
            const lamports = await rpc.getMinimumBalanceForRentExemption(space).send();
            if (signal.aborted) return;
            const account = await generateKeyPairSigner();
            if (signal.aborted) return;
            await signAndSend(
                [
                    getCreateAccountInstruction({
                        lamports,
                        newAccount: account,
                        payer: wallet,
                        programAddress: getProgramAddress(),
                        space,
                    }),
                ],
                wallet,
            );
            if (signal.aborted) return;

            const total = Math.ceil(count / MAX_KEYS_PER_TX);
            setProgress({ done: 0, total });
            for (let i = 0; i < count; i += MAX_KEYS_PER_TX) {
                if (signal.aborted) return;
                const chunk = set.pubkeys.slice(i, i + MAX_KEYS_PER_TX);
                const instruction: Instruction = {
                    accounts: [{ address: account.address, role: AccountRole.WRITABLE }],
                    data: addSignersInstructionData(chunk),
                    programAddress: getProgramAddress(),
                };
                await signAndSend([instruction], wallet);
                if (signal.aborted) return;
                setProgress({ done: Math.floor(i / MAX_KEYS_PER_TX) + 1, total });
            }

            setMultisig(account.address);
            setPhase('ready');
        } catch (caught) {
            if (signal.aborted) return;
            if (caught instanceof InsufficientDemoFundsError) {
                requestFunding({ address: caught.address, onFunded: () => void register() });
                setPhase('keys');
                return;
            }
            setError(formatTransactionError(caught));
            setPhase('keys');
        }
    }

    function toggleSigner(index: number) {
        setResult(null);
        setSigners(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    }

    async function verify() {
        if (!wallet || !multisig || !memberSet.current) return;
        const signal = getSignal();
        setPhase('verifying');
        setError(null);
        setResult(null);
        try {
            const signerIndices = Array.from(signers).sort((a, b) => a - b);
            const aggregate = await signMessage(memberSet.current, MESSAGE, signerIndices);
            if (signal.aborted) return;
            const instruction: Instruction = {
                accounts: [{ address: multisig, role: AccountRole.READONLY }],
                data: verifyInstructionData(aggregate),
                programAddress: getProgramAddress(),
            };
            let signature: string;
            let ok = true;
            try {
                signature = await signAndSend([instruction], wallet, { skipPreflight: true });
            } catch (caught) {
                if (signal.aborted) return;
                if (!(caught instanceof OnChainTransactionError)) throw caught;
                signature = caught.signature;
                ok = false;
            }
            if (signal.aborted) return;
            const computeUnits = await optionalComputeUnits(
                rpc
                    .getTransaction(signature as Signature, {
                        commitment: 'confirmed',
                        encoding: 'json',
                        maxSupportedTransactionVersion: 1,
                    })
                    .send(),
            );
            if (signal.aborted) return;
            const account = await rpc
                .getAccountInfo(multisig, { encoding: 'base64' })
                .send()
                .catch(() => null);
            if (signal.aborted) return;
            const storedKeys = account?.value ? parseStoredPubkeys(base64ToBytes(account.value.data[0])) : [];
            const signerAggregateKey = await aggregatePubkeysHex(signerIndices.map(i => memberSet.current!.pubkeys[i]));
            if (signal.aborted) return;
            const storedAggregateKey = await aggregatePubkeysHex(storedKeys);
            if (signal.aborted) return;
            setResult({
                computeUnits,
                ok,
                signature,
                signerAggregateKey,
                signerCount: signers.size,
                storedAggregateKey,
            });
        } catch (caught) {
            if (signal.aborted) return;
            setError(formatTransactionError(caught));
        } finally {
            if (!signal.aborted) setPhase('ready');
        }
    }

    const cluster = getClusterFromClusterId(clusterId);
    const busy = phase === 'generating' || phase === 'creating' || phase === 'verifying';
    const labelCount = members.length || memberCount;
    const registeredCount =
        phase === 'creating' ? Math.min(progress.done * MAX_KEYS_PER_TX, members.length) : members.length;

    const stage1: StageState = members.length > 0 ? 'done' : 'active';
    const stage2: StageState =
        phase === 'creating' ? 'active' : multisig ? 'done' : members.length > 0 ? 'active' : 'idle';
    const stage3: StageState =
        phase === 'verifying' ? 'active' : result ? (result.ok ? 'pass' : 'fail') : multisig ? 'active' : 'idle';

    const resultPanel = result && (
        <div className="space-y-2 rounded-lg border bg-background px-3 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
                {result.ok ? (
                    <>
                        <Badge variant="success">All {members.length} approved</Badge>
                        {result.computeUnits != null && (
                            <span className="text-sand-1100">
                                one pairing check ·{' '}
                                <span className="font-medium text-foreground">
                                    {result.computeUnits.toLocaleString()}
                                </span>{' '}
                                CU
                            </span>
                        )}
                        {result.signature && (
                            <Button asChild size="sm" variant="secondary">
                                <a
                                    href={getSolanaExplorerUrl(result.signature, cluster)}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    View on Explorer
                                </a>
                            </Button>
                        )}
                    </>
                ) : (
                    <>
                        <Badge variant="danger">Rejected on-chain</Badge>
                        <span className="text-sand-1100">
                            only {result.signerCount} of {members.length} signed — the aggregate doesn't match the
                            registered set
                        </span>
                        {result.computeUnits != null && (
                            <span className="text-sand-1100">
                                pairing still ran ·{' '}
                                <span className="font-medium text-foreground">
                                    {result.computeUnits.toLocaleString()}
                                </span>{' '}
                                CU
                            </span>
                        )}
                        {result.signature && (
                            <Button asChild size="sm" variant="secondary">
                                <a
                                    href={getSolanaExplorerUrl(result.signature, cluster)}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                >
                                    View on Explorer
                                </a>
                            </Button>
                        )}
                    </>
                )}
            </div>
            {result.storedAggregateKey && (
                <div>
                    <span className="text-xs font-medium text-sand-1100">
                        aggregate key the program folds from the {members.length} stored keys
                    </span>
                    <p className="mt-1 font-berkeley-mono text-xs break-all text-foreground">
                        {result.storedAggregateKey}
                    </p>
                </div>
            )}
            {result.signerAggregateKey && (
                <div>
                    <span className="text-xs font-medium text-sand-1100">
                        aggregate key represented by your {result.signerCount} signers
                    </span>
                    <p
                        className={
                            'mt-1 font-berkeley-mono text-xs break-all ' +
                            (result.signerAggregateKey === result.storedAggregateKey
                                ? 'text-foreground'
                                : 'text-destructive')
                        }
                    >
                        {result.signerAggregateKey}
                    </p>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-5">
            <FlowDiagram>
                <div>
                    <h3 className="text-base font-semibold text-foreground">On-chain multisig: everyone must sign</h3>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                        <li>Pick a member count, then register the members' public keys on-chain.</li>
                        <li>Click members to toggle who signs, and submit one aggregate signature to verify.</li>
                        <li>
                            The program sums every stored key with G2 addition and runs one pairing check — it only
                            passes if <em>every</em> member signed. Drop one and the math breaks.
                        </li>
                    </ol>
                </div>
                <Stage
                    actions={
                        <div className="flex flex-wrap items-end gap-4">
                            <label className="block">
                                <span className="text-xs font-medium text-sand-1100">Members: {memberCount}</span>
                                <span className="mt-1 flex h-9 w-56 items-center">
                                    <input
                                        className="w-full"
                                        disabled={busy}
                                        max={200}
                                        min={2}
                                        onChange={e => setMemberCount(Number(e.target.value))}
                                        step={1}
                                        type="range"
                                        value={memberCount}
                                    />
                                </span>
                            </label>
                            {memberCount !== createdCount && (
                                <Button
                                    disabled={!wallet || busy}
                                    loading={phase === 'generating'}
                                    onClick={() => void createKeys()}
                                >
                                    {createdCount === null ? 'Create keypairs' : 'Regenerate keypairs'}
                                </Button>
                            )}
                        </div>
                    }
                    location="off-chain"
                    n={1}
                    state={stage1}
                    title="Member keys"
                >
                    {labelCount} <BlsTerm>BLS</BlsTerm> keypairs, generated in your browser
                </Stage>

                <Connector>register · each key stored on-chain</Connector>

                <Stage
                    actions={
                        members.length > 0 ? (
                            <div className="space-y-3">
                                {!multisig && (
                                    <Button
                                        disabled={busy}
                                        loading={phase === 'creating'}
                                        onClick={() => void register()}
                                    >
                                        Register members
                                    </Button>
                                )}
                                {(multisig || phase === 'creating') && (
                                    <div>
                                        <div className="mb-2 text-xs font-medium text-sand-1100">
                                            {phase === 'creating'
                                                ? progress.total > 0
                                                    ? `Registering keys on-chain… ${progress.done}/${progress.total} batches`
                                                    : 'Creating the multisig account on-chain…'
                                                : `${members.length} members${multisig ? ` · ${ellipsify(multisig, 4)}` : ''} · click a member to toggle whether they sign`}
                                        </div>
                                        <div className="grid max-h-48 grid-cols-5 gap-1 overflow-y-auto rounded-lg border bg-background p-2">
                                            {members.map((pubkey, i) => {
                                                const signing = signers.has(i);
                                                const registered = i < registeredCount;
                                                return (
                                                    <button
                                                        className={
                                                            'rounded px-1.5 py-0.5 text-center font-berkeley-mono text-[10px] transition-all disabled:cursor-default ' +
                                                            (signing
                                                                ? 'bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]'
                                                                : 'bg-sand-200 text-sand-1000') +
                                                            (registered ? '' : ' opacity-40')
                                                        }
                                                        disabled={phase !== 'ready'}
                                                        key={i}
                                                        onClick={() => toggleSigner(i)}
                                                        title={pubkey}
                                                        type="button"
                                                    >
                                                        {signing ? '✓ ' : ''}#{i + 1} {ellipsify(pubkey, 4)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null
                    }
                    location="on-chain"
                    n={2}
                    state={stage2}
                    title="Member keys stored"
                >
                    all member keys kept on-chain — the full set, not yet combined
                </Stage>

                <Connector>chosen signers sign the message → one aggregate signature</Connector>

                <Stage
                    actions={
                        multisig && (phase === 'ready' || phase === 'verifying') ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-4">
                                    <span className="text-sm text-sand-1100">
                                        <span className="font-medium text-foreground">{signers.size}</span> of{' '}
                                        {members.length} will sign
                                    </span>
                                    <Button
                                        disabled={signers.size === 0}
                                        loading={phase === 'verifying'}
                                        onClick={() => void verify()}
                                    >
                                        Verify on-chain
                                    </Button>
                                </div>
                                {resultPanel}
                            </div>
                        ) : null
                    }
                    location="on-chain"
                    n={3}
                    state={stage3}
                    title="One pairing check"
                >
                    {result
                        ? result.ok
                            ? `✓ all ${members.length} signed`
                            : `✗ only ${result.signerCount} of ${members.length} signed — rejected`
                        : 'folds the stored keys with G2 addition, then one pairing check — passes only if every member signed'}
                </Stage>
            </FlowDiagram>

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 px-3 py-2 text-sm text-destructive">
                    <Badge variant="danger">Error</Badge>
                    <span className="break-words whitespace-pre-wrap">{error}</span>
                </div>
            )}

            {fundingDialog}
        </div>
    );
}
