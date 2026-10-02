import { ExternalLink } from 'lucide-react';

import { HashTerm, SyscallTerm } from '@/components/glossary-term';
import { featureGateStatus, useFeatureGates } from '@/hooks/use-feature-gates';

const SHA512_FEATURE_KEY = 's512oDwgx8hjMnaQjXfqqrZroVj4HvC6TkN3iSSWXCh';

export function Sha512() {
    const { data: featureGates, isError, isPending } = useFeatureGates();
    const activation = isPending
        ? 'Loading…'
        : isError
          ? 'Unavailable'
          : featureGateStatus(featureGates?.find(gate => gate.key === SHA512_FEATURE_KEY));

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
                SHA-512 hash (SIMD-0512)
            </h1>
            <div className="grid gap-8 lg:grid-cols-3">
                <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
                    <p className="text-muted-foreground">
                        <HashTerm>Hashing</HashTerm> already has native SHA-256, Keccak, and Blake3 paths on Solana.
                        SIMD-0512 proposes the missing SHA-512 counterpart: a <SyscallTerm>syscall</SyscallTerm> with
                        the same interface as the existing{' '}
                        <code className="font-berkeley-mono text-xs text-foreground">sol_sha256</code>, producing a
                        64-byte output for a fraction of the compute a pure-BPF implementation costs.
                    </p>
                    <p className="text-muted-foreground">Here are some examples of what it would enable:</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        <li>
                            <span className="text-foreground">Cheap on-chain hashing</span> —{' '}
                            <code className="font-berkeley-mono text-xs text-foreground">sol_sha512</code> would follow{' '}
                            <code className="font-berkeley-mono text-xs text-foreground">sol_sha256</code>&apos;s cost
                            model, so a short hash lands under 100 CU via syscall versus thousands computed in BPF
                        </li>
                        <li>
                            <span className="text-foreground">Interop with SHA-512 systems</span> — verify hashes,
                            commitments, or Merkle proofs from external systems that use SHA-512 (rather than SHA-256 or
                            Keccak)
                        </li>
                        <li>
                            <span className="text-foreground">Ed25519-adjacent checks</span> — SHA-512 is the hash used
                            inside Ed25519, so programs that need that same hashing step would get it natively
                        </li>
                    </ul>
                    <a
                        className="inline-flex items-center gap-1 text-sm text-sand-1100 underline decoration-sand-700 underline-offset-2 hover:text-foreground"
                        href="https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0512-sha512-syscall.md"
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        Read SIMD-0512 <ExternalLink className="size-3.5" />
                    </a>
                </div>
                <div className="lg:col-span-2">
                    <div className="space-y-3 rounded-xl border border-dashed bg-card p-6">
                        <h2 className="text-lg font-semibold text-foreground">No demo in this repository</h2>
                        <p className="text-sm text-muted-foreground">
                            Feature-gate registry status: {activation}. The repository does not implement the syscall,
                            so this page explains the proposal instead of sending a transaction.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
