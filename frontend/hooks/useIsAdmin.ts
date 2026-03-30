import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { ADMIN_WALLET_ADDRESS } from '../utils/constants';

export function useIsAdmin() {
    const { publicKey } = useWallet();

    const isAdmin = useMemo(() => {
        if (!publicKey) return false;
        return publicKey.toString() === ADMIN_WALLET_ADDRESS.toString();
    }, [publicKey]);

    return { isAdmin };
}
