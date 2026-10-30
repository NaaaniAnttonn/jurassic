type P = { size?: number }
const base = (size = 24) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconAgenda = ({ size }: P) => (
  <svg {...base(size)}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
)
export const IconListes = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2" /></svg>
)
export const IconTaches = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-5" /></svg>
)
export const IconReglages = ({ size }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const IconShare = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" /></svg>
)
export const IconPlus = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconChevronLeft = ({ size }: P) => (
  <svg {...base(size)}><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconChevronRight = ({ size }: P) => (
  <svg {...base(size)}><path d="M9 5l7 7-7 7" /></svg>
)
export const IconRepeat = ({ size }: P) => (
  <svg {...base(size)}><path d="M17 2.5l3 3-3 3" /><path d="M4 11.5v-1a5 5 0 0 1 5-5h11" /><path d="M7 21.5l-3-3 3-3" /><path d="M20 12.5v1a5 5 0 0 1-5 5H4" /></svg>
)
export const IconLock = ({ size }: P) => (
  <svg {...base(size)}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
)
export const IconBell = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 21h4" /></svg>
)
export const IconClose = ({ size }: P) => (
  <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>
)
export const IconCheck = ({ size }: P) => (
  <svg {...base(size)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
/** Poignée de glisser-déposer (six points) */
export const IconGrip = ({ size }: P) => (
  <svg {...base(size)} fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
)
export const IconTrash = ({ size }: P) => (
  <svg {...base(size)}><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-13M10 10.5v6.5M14 10.5v6.5" /></svg>
)
export const IconHeart = ({ size }: P) => (
  <svg {...base(size)}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" /></svg>
)
