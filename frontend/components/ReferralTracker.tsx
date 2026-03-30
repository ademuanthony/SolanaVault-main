'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicKey } from '@solana/web3.js';

function ReferralTrackerInner() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const ref = searchParams.get('ref');

        if (ref) {
            try {
                // Validate that it's a valid Solana PublicKey
                new PublicKey(ref);

                // Store in localStorage
                localStorage.setItem('solana_vault_referrer', ref);
                console.log('Referral code captured and saved:', ref);
            } catch (e) {
                console.warn('Invalid referral code in URL:', ref);
            }
        }
    }, [searchParams]);

    return null;
}

export function ReferralTracker() {
    return (
        <Suspense fallback={null}>
            <ReferralTrackerInner />
        </Suspense>
    );
}
