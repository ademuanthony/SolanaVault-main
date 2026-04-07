'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layers, RefreshCw, Loader2, Play, Plus, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { clsx } from "clsx";
import { toast } from "sonner";
import { PublicKey, Connection } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { useVault } from '@/hooks/useVault';
import { InputField } from '@/components/admin/InputField';
import { RebalanceModal } from '@/components/admin/RebalanceModal';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface PositionLiveData {
    activeBinId: number;
    activeBinPrice: number;
    lowerPrice: number;
    upperPrice: number;
    tokenXSymbol: string;
    tokenYSymbol: string;
    xDecimals: number;
    yDecimals: number;
    feeX: number;
    feeY: number;
    feeXUsd: number;
    feeYUsd: number;
    totalFeeUsd: number;
    positionValueX: number;
    positionValueY: number;
    totalValueUsd: number;
    pnl: number;
    pnlPercent: number;
    inRange: boolean;
    loading: boolean;
    error: string | null;
}

function binIdToPrice(binId: number, binStep: number): number {
    return Math.pow(1 + binStep / 10000, binId);
}

/** Known token mint → symbol mapping. Falls back to truncated address. */
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
    'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
    'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': { symbol: 'mSOL', decimals: 9 },
    'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': { symbol: 'JitoSOL', decimals: 9 },
    'jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v': { symbol: 'JupSOL', decimals: 9 },
    'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': { symbol: 'bSOL', decimals: 9 },
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': { symbol: 'WETH', decimals: 8 },
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': { symbol: 'WBTC', decimals: 8 },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', decimals: 5 },
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': { symbol: 'JUP', decimals: 6 },
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', decimals: 6 },
    'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': { symbol: 'RENDER', decimals: 8 },
};

function getTokenInfo(mint: string): { symbol: string; decimals: number } {
    return KNOWN_TOKENS[mint] || { symbol: mint.slice(0, 4) + '..' + mint.slice(-2), decimals: 6 };
}

export function PositionsTab() {
    const { vaultState, openDlmmPosition, activePositions, loading } = useVault();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<any>(null);
    const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);

    // Form State
    const [poolAddress, setPoolAddress] = useState('');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [amountX, setAmountX] = useState('');
    const [amountY, setAmountY] = useState('');
    const [strategy, setStrategy] = useState('0');

    // Pool info fetched when pool address changes
    const [poolInfo, setPoolInfo] = useState<{
        binStep: number;
        activeBinId: number;
        activeBinPrice: number;
        tokenXSymbol: string;
        tokenYSymbol: string;
        xDecimals: number;
        yDecimals: number;
        decimalMultiplier: number;
    } | null>(null);
    const [poolLoading, setPoolLoading] = useState(false);

    // Fetch pool info when address changes
    useEffect(() => {
        if (!poolAddress || poolAddress.length < 32) {
            setPoolInfo(null);
            return;
        }
        let cancelled = false;
        const fetchPool = async () => {
            setPoolLoading(true);
            try {
                const conn = new Connection(RPC_URL, 'confirmed');
                const pool = await DLMM.create(conn, new PublicKey(poolAddress));
                const activeBin = await pool.getActiveBin();
                const mintX = pool.lbPair.tokenXMint;
                const mintY = pool.lbPair.tokenYMint;
                const xInfo = getTokenInfo(mintX.toBase58());
                const yInfo = getTokenInfo(mintY.toBase58());
                const tokenXSymbol = xInfo.symbol;
                const tokenYSymbol = yInfo.symbol;
                const xDecimals = xInfo.decimals;
                const yDecimals = yInfo.decimals;
                const decimalMultiplier = Math.pow(10, xDecimals - yDecimals);
                const activeBinPrice = parseFloat(activeBin.price) * decimalMultiplier;

                if (!cancelled) {
                    setPoolInfo({
                        binStep: pool.lbPair.binStep,
                        activeBinId: activeBin.binId,
                        activeBinPrice,
                        tokenXSymbol,
                        tokenYSymbol,
                        xDecimals,
                        yDecimals,
                        decimalMultiplier,
                    });
                }
            } catch (e) {
                if (!cancelled) setPoolInfo(null);
            } finally {
                if (!cancelled) setPoolLoading(false);
            }
        };
        fetchPool();
        return () => { cancelled = true; };
    }, [poolAddress]);

    // Convert price inputs to bin IDs
    const priceToBinId = useCallback((price: number): number => {
        if (!poolInfo || price <= 0) return 0;
        const rawPrice = price / poolInfo.decimalMultiplier;
        return Math.round(Math.log(rawPrice) / Math.log(1 + poolInfo.binStep / 10000));
    }, [poolInfo]);

    const minBinId = priceToBinId(Number(minPrice) || 0);
    const maxBinId = priceToBinId(Number(maxPrice) || 0);
    const binCount = maxBinId > minBinId ? maxBinId - minBinId + 1 : 0;

    // Estimated rent: ~112 bytes per bin + ~300 base, at 6960 lamports/byte
    const estimatedRentSol = binCount > 0 ? ((300 + binCount * 112 + 128) * 6960) / 1e9 : 0;

    const handleOpenPosition = async () => {
        if (binCount > 69) {
            toast.error(`Max 69 bins per position (current: ${binCount}). Use a narrower price range.`);
            return;
        }
        if (binCount <= 0) {
            toast.error('Max price must be greater than min price.');
            return;
        }
        try {
            toast.loading('Opening position (2 transactions)...', { id: 'open-pos' });
            await openDlmmPosition(
                poolAddress,
                minBinId,
                maxBinId,
                Number(amountX),
                Number(amountY),
                Number(strategy)
            );
            toast.success('Position opened with liquidity!', { id: 'open-pos' });
            setIsFormOpen(false);
        } catch (e: any) {
            console.error(e);
            toast.error('Failed: ' + e.message, { id: 'open-pos' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        DLMM Positions
                    </h2>
                    <p className="text-sm text-muted-foreground">Manage active liquidity provider positions on Meteora.</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg"
                >
                    {isFormOpen ? <RefreshCw className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isFormOpen ? 'Cancel' : 'New Position'}
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xl animate-in slide-in-from-top-4 duration-300">
                    <h3 className="text-lg font-bold mb-6">Open New DLMM Position</h3>
                    <div className="space-y-6 mb-6">
                        {/* Pool Address */}
                        <div>
                            <InputField label="Pool Address" name="poolAddress" value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="Meteora DLMM Pool Address" />
                            {poolLoading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading pool...</p>}
                            {poolInfo && (
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span>Pair: <span className="text-foreground font-semibold">{poolInfo.tokenXSymbol}/{poolInfo.tokenYSymbol}</span></span>
                                    <span>Bin Step: <span className="text-foreground font-semibold">{poolInfo.binStep}</span></span>
                                    <span>Current Price: <span className="text-foreground font-semibold">${formatPrice(poolInfo.activeBinPrice)}</span></span>
                                </div>
                            )}
                        </div>

                        {/* Price Range */}
                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                label={`Min Price (${poolInfo ? poolInfo.tokenYSymbol + '/' + poolInfo.tokenXSymbol : 'Quote/Base'})`}
                                name="minPrice"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                placeholder={poolInfo ? formatPrice(poolInfo.activeBinPrice * 0.9) : '0.0'}
                            />
                            <InputField
                                label={`Max Price (${poolInfo ? poolInfo.tokenYSymbol + '/' + poolInfo.tokenXSymbol : 'Quote/Base'})`}
                                name="maxPrice"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                placeholder={poolInfo ? formatPrice(poolInfo.activeBinPrice * 1.1) : '0.0'}
                            />
                        </div>

                        {/* Bin count and rent info */}
                        {poolInfo && binCount > 0 && (
                            <div className="flex items-center gap-4 text-xs bg-secondary/30 rounded-xl px-4 py-2.5">
                                <span>Bins: <span className={clsx("font-bold", binCount > 69 ? "text-red-400" : "text-foreground")}>{binCount}</span>
                                    <span className="text-muted-foreground"> / 69 max</span>
                                </span>
                                <span className="text-muted-foreground">|</span>
                                <span>Bin IDs: <span className="font-mono text-foreground">{minBinId} → {maxBinId}</span></span>
                                <span className="text-muted-foreground">|</span>
                                <span>Est. Rent: <span className="text-foreground font-semibold">{estimatedRentSol.toFixed(4)} SOL</span></span>
                                {binCount > 69 && <span className="text-red-400 font-bold ml-auto">Reduce range</span>}
                            </div>
                        )}

                        {/* Amounts */}
                        <div className="grid grid-cols-2 gap-4">
                            <InputField
                                label={`Amount ${poolInfo?.tokenXSymbol || 'Base'}`}
                                name="amountX"
                                value={amountX}
                                onChange={(e) => setAmountX(e.target.value)}
                                placeholder="0.0"
                            />
                            <InputField
                                label={`Amount ${poolInfo?.tokenYSymbol || 'Quote'}`}
                                name="amountY"
                                value={amountY}
                                onChange={(e) => setAmountY(e.target.value)}
                                placeholder="0.0"
                            />
                        </div>

                        {/* Strategy */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Strategy Type</label>
                            <select
                                value={strategy}
                                onChange={(e) => setStrategy(e.target.value)}
                                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                            >
                                <option value="0">Spot (Standard)</option>
                                <option value="1">Curve (Balanced)</option>
                                <option value="2">Bid-Ask (High Volatility)</option>
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleOpenPosition}
                        disabled={loading || !poolInfo || binCount <= 0 || binCount > 69}
                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                        {loading ? 'Opening Position...' : `Open Position (${binCount} bins)`}
                    </button>
                </div>
            )}

            {!activePositions || activePositions.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-4 shadow-sm">
                    <div className="bg-secondary/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                        <Layers className="text-muted-foreground w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-muted-foreground">No active DLMM positions found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {activePositions.map((pos: any, idx: number) => (
                        <PositionCard
                            key={pos.publicKey.toBase58()}
                            position={pos}
                            index={idx}
                            onRebalance={() => {
                                setSelectedPosition(pos);
                                setIsRebalanceModalOpen(true);
                            }}
                        />
                    ))}
                </div>
            )}

            <RebalanceModal
                isOpen={isRebalanceModalOpen}
                onClose={() => setIsRebalanceModalOpen(false)}
                position={selectedPosition}
            />
        </div>
    );
}

function formatPrice(price: number): string {
    if (price >= 1000) return price.toFixed(0);
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
}

/** Visual bar showing the position price range vs. current price */
function BinRangeVisual({ lowerPrice, upperPrice, currentPrice, inRange, tokenYSymbol }: {
    lowerPrice: number;
    upperPrice: number;
    currentPrice: number;
    inRange: boolean;
    tokenYSymbol: string;
}) {
    const rangePadding = 0.3;
    const rangeWidth = upperPrice - lowerPrice;
    const viewLower = lowerPrice - rangeWidth * rangePadding;
    const viewUpper = upperPrice + rangeWidth * rangePadding;
    const viewWidth = viewUpper - viewLower;

    const rangeLeft = ((lowerPrice - viewLower) / viewWidth) * 100;
    const rangeRight = ((upperPrice - viewLower) / viewWidth) * 100;
    const rangeBarWidth = rangeRight - rangeLeft;

    const pricePos = Math.max(0, Math.min(100, ((currentPrice - viewLower) / viewWidth) * 100));

    return (
        <div className="relative w-full h-12">
            {/* Track */}
            <div className="absolute top-5 left-0 right-0 h-2 bg-secondary/60 rounded-full" />
            {/* Position range bar */}
            <div
                className={clsx(
                    "absolute top-5 h-2 rounded-full transition-all",
                    inRange
                        ? "bg-gradient-to-r from-emerald-500/80 to-emerald-400/80"
                        : "bg-gradient-to-r from-amber-500/60 to-amber-400/60"
                )}
                style={{ left: `${rangeLeft}%`, width: `${rangeBarWidth}%` }}
            />
            {/* Range edge labels — prices */}
            <div className="absolute top-9 text-[9px] font-mono text-muted-foreground" style={{ left: `${rangeLeft}%`, transform: 'translateX(-50%)' }}>
                ${formatPrice(lowerPrice)}
            </div>
            <div className="absolute top-9 text-[9px] font-mono text-muted-foreground" style={{ left: `${rangeRight}%`, transform: 'translateX(-50%)' }}>
                ${formatPrice(upperPrice)}
            </div>
            {/* Current price marker */}
            <div className="absolute top-3" style={{ left: `${pricePos}%`, transform: 'translateX(-50%)' }}>
                <div className={clsx(
                    "w-2.5 h-2.5 rounded-full border-2 border-background shadow-lg",
                    inRange ? "bg-emerald-400" : "bg-amber-400"
                )} />
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-foreground bg-secondary/90 px-1.5 py-0.5 rounded">
                    ${formatPrice(currentPrice)}
                </div>
            </div>
        </div>
    );
}

function PositionCard({ position, index, onRebalance }: { position: any, index: number, onRebalance: () => void }) {
    const { closeDlmmPosition, closeDlmmPositionAccount, claimDlmmFees, loading } = useVault();
    const [closing, setClosing] = useState(false);
    const [liveData, setLiveData] = useState<PositionLiveData>({
        activeBinId: 0,
        activeBinPrice: 0,
        lowerPrice: 0,
        upperPrice: 0,
        tokenXSymbol: 'SOL',
        tokenYSymbol: 'USDC',
        xDecimals: 9,
        yDecimals: 6,
        feeX: 0, feeY: 0,
        feeXUsd: 0, feeYUsd: 0, totalFeeUsd: 0,
        positionValueX: 0, positionValueY: 0, totalValueUsd: 0,
        pnl: 0, pnlPercent: 0,
        inRange: false,
        loading: true,
        error: null,
    });

    const acct = position.account;
    const poolKey = acct.dlmmPool.toBase58();
    const positionNft = acct.positionNft;

    const fetchLiveData = useCallback(async () => {
        try {
            setLiveData(prev => ({ ...prev, loading: true, error: null }));
            const connection = new Connection(RPC_URL, 'confirmed');
            const dlmmPool = await DLMM.create(connection, acct.dlmmPool);

            const activeBin = await dlmmPool.getActiveBin();
            const activeBinId = activeBin.binId;

            const mintX = dlmmPool.lbPair.tokenXMint;
            const mintY = dlmmPool.lbPair.tokenYMint;
            const xInfo = getTokenInfo(mintX.toBase58());
            const yInfo = getTokenInfo(mintY.toBase58());
            const tokenXSymbol = xInfo.symbol;
            const tokenYSymbol = yInfo.symbol;
            const xDecimals = xInfo.decimals;
            const yDecimals = yInfo.decimals;

            // Meteora raw price = (1 + binStep/10000)^binId (no decimal adjustment)
            // To get human-readable "Y per X" (e.g. USDC per SOL):
            // price = rawPrice * 10^(xDecimals - yDecimals)
            const decimalMultiplier = Math.pow(10, xDecimals - yDecimals);
            const rawActivePrice = parseFloat(activeBin.price);
            const activeBinPrice = rawActivePrice * decimalMultiplier;

            const binStep = dlmmPool.lbPair.binStep;
            const lowerPrice = binIdToPrice(acct.binIdLower, binStep) * decimalMultiplier;
            const upperPrice = binIdToPrice(acct.binIdUpper, binStep) * decimalMultiplier;
            const inRange = activeBinId >= acct.binIdLower && activeBinId <= acct.binIdUpper;

            // Fetch position data directly from Meteora using the position NFT key
            let feeX = 0, feeY = 0, posValueX = 0, posValueY = 0;
            try {
                const pos = await dlmmPool.getPosition(positionNft);

                if (pos?.positionData) {
                    const pd = pos.positionData;
                    // feeX/feeY are BN objects; totalXAmount/totalYAmount are strings
                    feeX = pd.feeX ? Number(pd.feeX.toString()) / Math.pow(10, xDecimals) : 0;
                    feeY = pd.feeY ? Number(pd.feeY.toString()) / Math.pow(10, yDecimals) : 0;
                    posValueX = pd.totalXAmount ? Number(pd.totalXAmount.toString()) / Math.pow(10, xDecimals) : 0;
                    posValueY = pd.totalYAmount ? Number(pd.totalYAmount.toString()) / Math.pow(10, yDecimals) : 0;
                }
            } catch (e) {
                console.warn('Could not fetch position details from Meteora:', e);
            }

            // activeBinPrice is now in Y/X terms (e.g. USDC per SOL)
            const priceXinY = activeBinPrice;
            const feeXUsd = feeX * priceXinY;
            const feeYUsd = feeY;
            const totalFeeUsd = feeXUsd + feeYUsd;

            const totalValueUsd = posValueX * priceXinY + posValueY;

            // PnL: compare current position value + unclaimed fees vs initial deposit
            // Use Meteora position value as the source of truth for current holdings.
            // The on-chain DlmmPosition stores what was requested, not what Meteora actually holds.
            const initialX = Number(acct.tokenXAmount) / Math.pow(10, xDecimals);
            const initialY = Number(acct.tokenYAmount) / Math.pow(10, yDecimals);
            const initialValueUsd = initialX * priceXinY + initialY;

            // Only compute PnL when the position actually has liquidity deposited
            const hasLiquidity = posValueX > 0 || posValueY > 0 || feeX > 0 || feeY > 0;
            const pnl = hasLiquidity ? (totalValueUsd + totalFeeUsd) - initialValueUsd : 0;
            const pnlPercent = hasLiquidity && initialValueUsd > 0 ? (pnl / initialValueUsd) * 100 : 0;

            setLiveData({
                activeBinId,
                activeBinPrice,
                lowerPrice,
                upperPrice,
                tokenXSymbol,
                tokenYSymbol,
                xDecimals,
                yDecimals,
                feeX, feeY,
                feeXUsd, feeYUsd, totalFeeUsd,
                positionValueX: posValueX,
                positionValueY: posValueY,
                totalValueUsd,
                pnl, pnlPercent,
                inRange,
                loading: false,
                error: null,
            });
        } catch (err: any) {
            console.error('Error fetching live position data:', err);
            setLiveData(prev => ({ ...prev, loading: false, error: err.message || 'Failed to load' }));
        }
    }, [acct.dlmmPool, acct.binIdLower, acct.binIdUpper, positionNft, acct.tokenXAmount, acct.tokenYAmount]);

    useEffect(() => {
        fetchLiveData();
        const interval = setInterval(fetchLiveData, 30_000);
        return () => clearInterval(interval);
    }, [fetchLiveData]);

    const handleClose = async () => {
        if (!confirm('Close this position? Funds will return to the vault.')) return;
        setClosing(true);
        toast.loading('Closing Position...', { id: 'close-pos' });
        try {
            await closeDlmmPosition(position.publicKey.toBase58());
            toast.success('Position closed successfully!', { id: 'close-pos' });
        } catch (e: any) {
            toast.error('Failed to close position: ' + e.message, { id: 'close-pos' });
        } finally {
            setClosing(false);
        }
    };

    const strategyLabel = acct.mode.spot ? 'Spot' : acct.mode.bidAsk ? 'Bid-Ask' : acct.mode.curve ? 'Curve' : 'Unknown';
    const poolTrunc = poolKey.slice(0, 4) + '...' + poolKey.slice(-4);
    const d = liveData;

    return (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary text-xs font-black px-2.5 py-1 rounded-lg">#{index + 1}</span>
                    <span className={clsx(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        strategyLabel === 'Spot' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            strategyLabel === 'Curve' ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                                "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    )}>
                        {strategyLabel}
                    </span>
                    <button
                        onClick={() => navigator.clipboard.writeText(poolKey)}
                        className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy pool address"
                    >
                        {poolTrunc}
                    </button>
                    {d.inRange && !d.loading && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <Activity className="w-3 h-3" /> In Range
                        </span>
                    )}
                    {!d.inRange && !d.loading && !d.error && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                            <Activity className="w-3 h-3" /> Out of Range
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchLiveData} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all" title="Refresh">
                        <RefreshCw className={clsx("w-3.5 h-3.5", d.loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {d.loading && !d.activeBinId ? (
                <div className="px-5 py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading position data...
                </div>
            ) : d.error ? (
                <div className="px-5 py-6 text-center text-sm text-red-400">{d.error}</div>
            ) : (
                <>
                    {/* Price Range Visual */}
                    <div className="px-5 pt-4 pb-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Price Range ({d.tokenXSymbol} in {d.tokenYSymbol})</span>
                            <span>Current: <span className="text-foreground font-semibold">${formatPrice(d.activeBinPrice)}</span></span>
                        </div>
                        <BinRangeVisual
                            lowerPrice={d.lowerPrice}
                            upperPrice={d.upperPrice}
                            currentPrice={d.activeBinPrice}
                            inRange={d.inRange}
                            tokenYSymbol={d.tokenYSymbol}
                        />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30 mx-5 mb-4 rounded-xl overflow-hidden">
                        {/* Position Value */}
                        <div className="bg-card p-3.5">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Position Value</div>
                            {d.totalValueUsd > 0 ? (
                                <>
                                    <div className="text-lg font-bold text-foreground">${d.totalValueUsd.toFixed(2)}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {d.positionValueX > 0 && <span>{d.positionValueX.toFixed(4)} {d.tokenXSymbol}</span>}
                                        {d.positionValueX > 0 && d.positionValueY > 0 && <span> + </span>}
                                        {d.positionValueY > 0 && <span>{d.positionValueY.toFixed(2)} {d.tokenYSymbol}</span>}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-lg font-bold text-muted-foreground">$0.00</div>
                                    <div className="text-[10px] text-amber-400/80 mt-0.5">Liquidity not yet added</div>
                                </>
                            )}
                        </div>

                        {/* Unclaimed Fees */}
                        <div className="bg-card p-3.5">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Unclaimed Fees
                            </div>
                            <div className={clsx("text-lg font-bold", d.totalFeeUsd > 0 ? "text-amber-400" : "text-foreground")}>
                                ${d.totalFeeUsd.toFixed(4)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                {d.feeX > 0 && <span>{d.feeX.toFixed(6)} {d.tokenXSymbol}</span>}
                                {d.feeX > 0 && d.feeY > 0 && <span> + </span>}
                                {d.feeY > 0 && <span>{d.feeY.toFixed(4)} {d.tokenYSymbol}</span>}
                                {d.feeX === 0 && d.feeY === 0 && <span>No fees yet</span>}
                            </div>
                        </div>

                        {/* PnL */}
                        <div className="bg-card p-3.5">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                {d.pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />} PnL
                            </div>
                            {d.totalValueUsd === 0 && d.totalFeeUsd === 0 ? (
                                <>
                                    <div className="text-lg font-bold text-muted-foreground">--</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">No liquidity deposited</div>
                                </>
                            ) : (
                                <>
                                    <div className={clsx("text-lg font-bold", d.pnl > 0 ? "text-emerald-400" : d.pnl < 0 ? "text-red-400" : "text-foreground")}>
                                        {d.pnl >= 0 ? '+' : ''}${Math.abs(d.pnl).toFixed(2)}
                                    </div>
                                    <div className={clsx("text-[10px] font-semibold mt-0.5", d.pnlPercent > 0 ? "text-emerald-400/80" : d.pnlPercent < 0 ? "text-red-400/80" : "text-muted-foreground")}>
                                        {d.pnlPercent >= 0 ? '+' : ''}{d.pnlPercent.toFixed(2)}%
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Deposit Info */}
                        <div className="bg-card p-3.5">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Initial Deposit</div>
                            <div className="text-[10px] text-muted-foreground space-y-0.5 mt-2">
                                <div>{(Number(acct.tokenXAmount) / Math.pow(10, d.xDecimals)).toFixed(4)} {d.tokenXSymbol}</div>
                                <div>{(Number(acct.tokenYAmount) / Math.pow(10, d.yDecimals)).toFixed(2)} {d.tokenYSymbol}</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                                {acct.oneSided && <span className="text-primary/80">One-sided</span>}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 px-5 pb-4">
                        <button
                            onClick={onRebalance}
                            className="bg-primary/10 hover:bg-primary/20 text-primary px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-primary/20"
                        >
                            Rebalance
                        </button>
                        <button
                            onClick={async () => {
                                toast.loading('Harvesting Fees...', { id: 'harvest' });
                                try {
                                    await claimDlmmFees(position.publicKey.toBase58());
                                    toast.success('Fees harvested to vault!', { id: 'harvest' });
                                    fetchLiveData();
                                } catch (e: any) {
                                    toast.error('Harvest failed: ' + e.message, { id: 'harvest' });
                                }
                            }}
                            disabled={loading || closing}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-amber-500/20 disabled:opacity-50"
                        >
                            Harvest Fees
                        </button>
                        <button
                            onClick={handleClose}
                            disabled={loading || closing}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-500/20 disabled:opacity-50"
                        >
                            {closing ? 'Closing...' : 'Close'}
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    await closeDlmmPositionAccount(position.publicKey.toBase58());
                                    toast.success("Position cleaned up!");
                                } catch (e: any) {
                                    toast.error(e.message);
                                }
                            }}
                            className="bg-secondary p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors border border-border"
                            title="Reclaim Rent"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
