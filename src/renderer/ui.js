// Shared Tailwind class strings. Light values are unprefixed; dark: variants
// apply when <html data-theme="dark"> (see tailwind.config.cjs darkMode).
// Full standalone strings (no risky utility-order overrides) keep results stable.

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border ' +
  'px-[11px] py-1.5 text-[12.5px] cursor-pointer transition-colors active:translate-y-px ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export const btn =
  `${BTN_BASE} border-l-bd dark:border-d-bd bg-l-bg3 dark:bg-d-bg3 text-l-tx dark:text-d-tx ` +
  'hover:bg-l-hv dark:hover:bg-d-hv';

export const btnGhost =
  `${BTN_BASE} bg-transparent border-l-bd dark:border-d-bd text-l-tx dark:text-d-tx ` +
  'hover:bg-l-hv dark:hover:bg-d-hv';

export const btnIcon =
  `${BTN_BASE} px-[9px] text-[14px] leading-none border-l-bd dark:border-d-bd ` +
  'bg-l-bg3 dark:bg-d-bg3 text-l-tx dark:text-d-tx hover:bg-l-hv dark:hover:bg-d-hv';

export const btnRun =
  `${BTN_BASE} bg-l-bg3 dark:bg-d-bg3 border-[#2c974b] text-[#116329] hover:bg-[#dafbe1] ` +
  'dark:border-[#2c5a34] dark:text-[#9be8a8] dark:hover:bg-[#1c2a20]';

export const btnRestart =
  `${BTN_BASE} bg-l-bg3 dark:bg-d-bg3 border-[#bf8700] text-[#7a5b00] hover:bg-[#fdf5c8] ` +
  'dark:border-[#5a4a1e] dark:text-[#f0d48a] dark:hover:bg-[#2a2517]';

export const btnStop =
  `${BTN_BASE} bg-l-bg3 dark:bg-d-bg3 border-[#e5534b] text-[#a40e26] hover:bg-[#ffe9e6] ` +
  'dark:border-[#5a2b28] dark:text-[#f5a29c] dark:hover:bg-[#2a1a19]';

export const btnAdd =
  `${BTN_BASE} bg-l-bg3 dark:bg-d-bg3 border-accentL text-[#0550ae] hover:bg-l-abg ` +
  'dark:border-accent dark:text-[#a9c2ff] dark:hover:bg-d-abg';

export const select =
  'bg-l-bg3 dark:bg-d-bg3 text-l-tx dark:text-d-tx border border-l-bd dark:border-d-bd ' +
  'rounded-md px-2 py-[5px] text-[12.5px] focus:outline-none focus:border-accentL dark:focus:border-accent';

// Sidebar per-server action button (append flex-1 or flex-none basis-7 per use).
export const mini =
  'inline-flex items-center justify-center gap-1 text-center border rounded-[5px] py-1 ' +
  'text-[11px] cursor-pointer border-l-bd dark:border-d-bd bg-l-bg2 dark:bg-d-bg2 ' +
  'text-l-tx dark:text-d-tx hover:bg-l-hv dark:hover:bg-d-hv';

export const input =
  'w-full bg-l-bg3 dark:bg-d-bg3 border border-l-bd dark:border-d-bd text-l-tx dark:text-d-tx ' +
  'rounded-md px-2.5 py-2 text-[13px] select-text focus:outline-none focus:border-accentL dark:focus:border-accent';

export const overlay =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/35 dark:bg-black/55';

export const modal =
  'bg-l-bg2 dark:bg-d-bg2 border border-l-bd dark:border-d-bd ' +
  'shadow-[0_20px_60px_rgba(31,35,40,0.25)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]';

export function dotClass(st) {
  if (st === 'running') return 'bg-okL dark:bg-ok shadow-[0_0_6px_#1a7f37] dark:shadow-[0_0_6px_#3fb950]';
  if (st === 'error') return 'bg-dangerL dark:bg-danger shadow-[0_0_6px_#cf222e] dark:shadow-[0_0_6px_#f85149]';
  return 'bg-grayL dark:bg-gray';
}

export const dotBase = 'w-[9px] h-[9px] rounded-full flex-none inline-block';
