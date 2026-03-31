export function CaifuLogo({ size = 40, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="caifuGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
                <linearGradient id="caifuAccent" x1="40" y1="30" x2="90" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <filter id="caifuGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Background rounded square */}
            <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#caifuGrad)" />

            {/* Inner subtle border */}
            <rect x="8" y="8" width="104" height="104" rx="24" fill="none" stroke="white" strokeOpacity="0.15" strokeWidth="1" />

            {/* Stylized "C" as a vault arc */}
            <path
                d="M72 32C52 32 36 48 36 68C36 88 52 104 72 104"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                opacity="0.95"
            />

            {/* Rising bars — wealth/growth motif */}
            <g filter="url(#caifuGlow)">
                <rect x="58" y="62" width="10" height="28" rx="3" fill="url(#caifuAccent)" />
                <rect x="72" y="50" width="10" height="40" rx="3" fill="url(#caifuAccent)" />
                <rect x="86" y="38" width="10" height="52" rx="3" fill="url(#caifuAccent)" />
            </g>

            {/* Small diamond accent at top */}
            <rect x="56" y="20" width="8" height="8" rx="1.5" transform="rotate(45 60 24)" fill="white" opacity="0.6" />
        </svg>
    );
}

export function CaifuLogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="caifuMarkGrad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
                <linearGradient id="caifuMarkAccent" x1="40" y1="30" x2="90" y2="100" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
            </defs>

            <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#caifuMarkGrad)" />

            <path
                d="M72 32C52 32 36 48 36 68C36 88 52 104 72 104"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                opacity="0.95"
            />

            <rect x="58" y="62" width="10" height="28" rx="3" fill="url(#caifuMarkAccent)" />
            <rect x="72" y="50" width="10" height="40" rx="3" fill="url(#caifuMarkAccent)" />
            <rect x="86" y="38" width="10" height="52" rx="3" fill="url(#caifuMarkAccent)" />
        </svg>
    );
}
