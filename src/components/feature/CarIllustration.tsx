import { cn } from '@/lib/utils';

interface CarIllustrationProps {
  bodyType?: 'Hatchback' | 'Sedan' | 'SUV' | 'MUV' | 'EV' | string;
  className?: string;
}

export function CarIllustration({ bodyType = 'SUV', className }: CarIllustrationProps) {
  return (
    <div
      className={cn(
        'relative w-full h-44 rounded-xl bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/70 border border-slate-200/60 flex items-center justify-center overflow-hidden p-6 select-none',
        className
      )}
    >
      {/* Background ambient geometry */}
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:16px_16px]" />
      
      {/* Dynamic vector car silhouette */}
      <svg
        className="w-4/5 h-auto max-h-28 text-slate-700 relative z-10 transition-transform duration-300 group-hover:scale-105"
        viewBox="0 0 240 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {bodyType === 'SUV' ? (
          // SUV silhouette
          <g>
            <path
              d="M30 65 L45 42 L80 32 L155 32 L195 48 L215 54 L225 65 L225 74 L15 74 L15 65 Z"
              fill="currentColor"
              className="text-slate-800"
            />
            {/* Windows */}
            <path
              d="M85 36 L145 36 L145 48 L80 48 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            <path
              d="M150 36 L185 49 L150 49 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            <path
              d="M55 45 L78 36 L75 48 L50 48 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            {/* Wheels */}
            <circle cx="60" cy="74" r="16" fill="#0F172A" />
            <circle cx="60" cy="74" r="8" fill="#94A3B8" />
            <circle cx="180" cy="74" r="16" fill="#0F172A" />
            <circle cx="180" cy="74" r="8" fill="#94A3B8" />
            {/* Headlight accent */}
            <polygon points="220,58 225,65 210,65" fill="#38BDF8" />
            {/* Roof rail */}
            <line x1="82" y1="28" x2="160" y2="28" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : bodyType === 'Sedan' ? (
          // Sedan silhouette
          <g>
            <path
              d="M20 68 L48 52 L85 35 L155 35 L190 52 L225 58 L230 68 L230 75 L10 75 L10 68 Z"
              fill="currentColor"
              className="text-slate-800"
            />
            {/* Windows */}
            <path
              d="M88 38 L152 38 L148 52 L82 52 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            <path
              d="M155 38 L182 52 L152 52 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            <path
              d="M58 52 L84 38 L78 52 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            {/* Wheels */}
            <circle cx="55" cy="75" r="15" fill="#0F172A" />
            <circle cx="55" cy="75" r="7" fill="#CBD5E1" />
            <circle cx="185" cy="75" r="15" fill="#0F172A" />
            <circle cx="185" cy="75" r="7" fill="#CBD5E1" />
            {/* Lights */}
            <polygon points="225,60 229,67 218,67" fill="#38BDF8" />
          </g>
        ) : (
          // Hatchback silhouette
          <g>
            <path
              d="M22 66 L30 46 L82 35 L145 35 L180 48 L218 55 L222 66 L222 74 L15 74 L15 66 Z"
              fill="currentColor"
              className="text-slate-800"
            />
            <path
              d="M84 38 L142 38 L140 48 L80 48 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            <path
              d="M144 38 L172 48 L142 48 Z"
              fill="#E2E8F0"
              opacity="0.9"
            />
            <circle cx="58" cy="74" r="15" fill="#0F172A" />
            <circle cx="58" cy="74" r="7" fill="#CBD5E1" />
            <circle cx="178" cy="74" r="15" fill="#0F172A" />
            <circle cx="178" cy="74" r="7" fill="#CBD5E1" />
            <polygon points="214,58 220,65 208,65" fill="#38BDF8" />
          </g>
        )}
      </svg>
      <div className="absolute bottom-2 right-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-white/80 px-2 py-0.5 rounded backdrop-blur-sm border border-slate-200/50">
        {bodyType}
      </div>
    </div>
  );
}
