import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useCluster, type SolanaClusterId } from '@solana/connector/react';
import { Button, TextInput } from '@solana/design-system';
import { ChevronDown, Menu, Plus, Settings2, Trash2 } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clearCustomRpc, detectNetwork, isValidRpcUrl, readCustomRpc, saveCustomRpc } from '@/lib/custom-rpc';
import { cn } from '@/lib/utils';

import { NAV_ITEMS, type NavItem } from './nav-items';
import { WalletButton } from './solana/solana-provider';

function ClusterButton() {
    const { cluster, clusters, setCluster } = useCluster();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [url, setUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [rpcError, setRpcError] = useState<string | null>(null);
    const rpcInputId = useId();
    const rpcErrorId = useId();
    const rpcInputRef = useRef<HTMLInputElement>(null);

    const hasCustom = readCustomRpc() !== null;

    useEffect(() => {
        if (rpcError) rpcInputRef.current?.focus();
    }, [rpcError]);

    async function selectCluster(id: SolanaClusterId) {
        localStorage.setItem('crypto-primitives-cluster', id);
        await setCluster(id);
    }

    function openDialog() {
        setUrl(readCustomRpc()?.url ?? '');
        setRpcError(null);
        setDialogOpen(true);
    }

    async function handleSave() {
        const trimmed = url.trim();
        if (!isValidRpcUrl(trimmed)) {
            setRpcError('Enter a valid http(s) RPC URL.');
            return;
        }
        setRpcError(null);
        setSaving(true);
        try {
            const network = await detectNetwork(trimmed);
            if (!network) {
                setRpcError('This URL responded with an unknown Solana network. Use a devnet endpoint.');
                return;
            }
            if (network !== 'devnet') {
                setRpcError('This demo runs on devnet only. Enter a devnet RPC URL.');
                return;
            }
            saveCustomRpc(trimmed, network);
            window.location.reload();
        } catch {
            setRpcError('Could not reach this RPC URL. Check the address and try again.');
        } finally {
            setSaving(false);
        }
    }

    function handleRemove() {
        clearCustomRpc();
        window.location.reload();
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        iconLeft={<Settings2 />}
                        iconRight={<ChevronDown className="opacity-60" />}
                        size="sm"
                        variant="secondary"
                    >
                        {cluster?.label ?? 'Network'}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Network</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {clusters.map(c => (
                        <DropdownMenuItem key={c.id} onClick={() => void selectCluster(c.id)}>
                            {c.label}
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={openDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {hasCustom ? 'Edit custom RPC' : 'Add custom RPC'}
                    </DropdownMenuItem>
                    {hasCustom && (
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleRemove}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove custom RPC
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Custom RPC endpoint</DialogTitle>
                        <DialogDescription>
                            Point the app at your own Solana RPC URL. Devnet only — the network is detected from the
                            endpoint; saving reloads the page and selects it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label htmlFor={rpcInputId} className="text-sm font-medium">
                            RPC URL
                        </label>
                        <TextInput
                            ref={rpcInputRef}
                            id={rpcInputId}
                            name="rpc-url"
                            type="url"
                            autoComplete="url"
                            value={url}
                            onChange={e => {
                                setUrl(e.currentTarget.value);
                                setRpcError(null);
                            }}
                            placeholder="https://my-rpc.example.com"
                            inputClassName="font-mono"
                            aria-invalid={rpcError ? true : undefined}
                            aria-describedby={rpcError ? rpcErrorId : undefined}
                        />
                        {rpcError && (
                            <p id={rpcErrorId} className="text-sm text-destructive">
                                {rpcError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" disabled={saving} onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button loading={saving} onClick={() => void handleSave()}>
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function isActive(pathname: string, path: string): boolean {
    return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
    return (
        <>
            {items.map(item => {
                const active = isActive(pathname, item.path);
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            'flex max-w-[8.5rem] items-center rounded-xl px-3 py-2 text-center text-sm font-medium leading-tight transition-colors',
                            active
                                ? 'bg-sand-200 text-foreground'
                                : 'text-sand-1100 hover:bg-sand-100 hover:text-foreground',
                        )}
                        aria-current={active ? 'page' : undefined}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </>
    );
}

export function AppHeader() {
    const { pathname } = useLocation();
    const [hasScrolled, setHasScrolled] = useState(false);

    useEffect(() => {
        function handleScroll() {
            const next = window.scrollY > 0;
            setHasScrolled(prev => (prev === next ? prev : next));
        }
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={cn(
                'fixed inset-x-0 top-0 z-40 border-b transition-colors duration-200',
                hasScrolled
                    ? 'border-border-low/70 bg-background/70 backdrop-blur-sm'
                    : 'border-transparent bg-transparent',
            )}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <Link to="/" className="group flex items-center gap-2">
                    <img src="/solana-logo.svg" alt="Solana" className="h-6 w-6 shrink-0" />
                    <span className="text-lg font-semibold tracking-tight text-foreground">Crypto Primitives</span>
                </Link>

                <nav className="hidden items-stretch gap-1 md:flex">
                    <NavLinks items={NAV_ITEMS} pathname={pathname} />
                </nav>

                <div className="hidden items-center gap-2 md:flex">
                    <WalletButton />
                    <ClusterButton />
                </div>

                <div className="flex items-center gap-2 md:hidden">
                    <ClusterButton />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                aria-label="Open navigation menu"
                                iconLeft={<Menu />}
                                iconOnly
                                size="sm"
                                variant="secondary"
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {NAV_ITEMS.map(item => (
                                <DropdownMenuItem key={item.path} asChild>
                                    <Link
                                        to={item.path}
                                        aria-current={isActive(pathname, item.path) ? 'page' : undefined}
                                        className="flex items-center gap-2"
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <div className="flex flex-col gap-2 p-2">
                                <WalletButton />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
