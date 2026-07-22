import { useEffect } from 'react';
import { FiX, FiMoon, FiSun, FiMinus, FiPlus } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import { FONT_MIN, FONT_MAX } from '../lib/terminalManager.js';
import { overlay, modal } from '../ui.js';

const REPO = 'https://github.com/iftekharweb/iv-server-manager';

const TAB = 'bg-transparent border-0 text-l-dim dark:text-d-dim px-2 py-[13px] text-[13px] cursor-pointer border-b-2 border-transparent -mb-px hover:text-l-tx dark:hover:text-d-tx';
const TAB_ACTIVE = '!text-l-tx dark:!text-d-tx !border-b-accentL dark:!border-b-accent font-semibold';
const SEG = 'inline-flex items-center justify-center gap-1.5 border-0 px-[15px] py-[7px] text-[12.5px] cursor-pointer bg-l-bg3 dark:bg-d-bg3 text-l-dim dark:text-d-dim hover:text-l-tx dark:hover:text-d-tx';
const SEG_ACTIVE = '!bg-accentL dark:!bg-accent !text-white font-semibold';
const STEP = 'inline-flex items-center justify-center bg-l-bg3 dark:bg-d-bg3 text-l-tx dark:text-d-tx border-0 w-[34px] h-8 text-base cursor-pointer hover:bg-l-hv dark:hover:bg-d-hv disabled:opacity-40 disabled:cursor-not-allowed';

export default function SettingsModal() {
  const { state, actions } = useApp();
  const tab = state.ui.settingsTab;
  const { theme, fontSize, version } = state;

  const close = () => actions.setUi({ settingsOpen: false });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showTab = (name) => actions.setUi({ settingsTab: name });
  const bumpFont = (delta) => {
    const next = fontSize + delta;
    if (next < FONT_MIN || next > FONT_MAX) return;
    actions.setFont(next);
  };

  return (
    <div className={`${overlay} modal-overlay`} onClick={(e) => e.target.classList.contains('modal-overlay') && close()}>
      <div className={`${modal} w-[470px] max-w-[92vw] rounded-xl overflow-hidden`}>
        <div className="flex items-center justify-between pl-3.5 pr-2 border-b border-l-bd dark:border-d-bd">
          <div className="flex gap-1" role="tablist">
            <button className={TAB + (tab === 'appearance' ? ' ' + TAB_ACTIVE : '')} role="tab" onClick={() => showTab('appearance')}>Appearance</button>
            <button className={TAB + (tab === 'about' ? ' ' + TAB_ACTIVE : '')} role="tab" onClick={() => showTab('about')}>About</button>
          </div>
          <button className="inline-flex items-center bg-transparent border-0 text-l-dim dark:text-d-dim text-[13px] cursor-pointer px-2 py-1.5 rounded-md hover:bg-l-hv dark:hover:bg-d-hv hover:text-l-tx dark:hover:text-d-tx" title="Close" aria-label="Close" onClick={close}><FiX /></button>
        </div>

        <section className={'px-[18px] pt-3.5 pb-5' + (tab === 'appearance' ? '' : ' hidden')}>
          <div className="flex items-center justify-between gap-4 py-[13px] border-b border-l-bd dark:border-d-bd">
            <div className="flex flex-col gap-[3px]">
              <span className="font-semibold text-[13px]">Theme</span>
              <span className="text-l-dim dark:text-d-dim text-[11.5px]">Colors for the whole app, including terminals.</span>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-l-bd dark:border-d-bd flex-none" role="group" aria-label="Theme">
              <button className={SEG + (theme === 'dark' ? ' ' + SEG_ACTIVE : '')} onClick={() => actions.setTheme('dark')}><FiMoon /> Dark</button>
              <button className={SEG + ' border-l border-l-bd dark:border-d-bd' + (theme === 'light' ? ' ' + SEG_ACTIVE : '')} onClick={() => actions.setTheme('light')}><FiSun /> Light</button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 py-[13px]">
            <div className="flex flex-col gap-[3px]">
              <span className="font-semibold text-[13px]">Terminal font size</span>
              <span className="text-l-dim dark:text-d-dim text-[11.5px]">Applies to every log and the scratch terminal.</span>
            </div>
            <div className="flex items-center rounded-lg overflow-hidden border border-l-bd dark:border-d-bd" role="group" aria-label="Font size">
              <button className={STEP} aria-label="Smaller" disabled={fontSize <= FONT_MIN} onClick={() => bumpFont(-1)}><FiMinus /></button>
              <span className="min-w-[54px] text-center tabular-nums text-[12.5px]">{fontSize}px</span>
              <button className={STEP} aria-label="Larger" disabled={fontSize >= FONT_MAX} onClick={() => bumpFont(1)}><FiPlus /></button>
            </div>
          </div>

          <div className="mt-3.5 rounded-lg px-3.5 py-3 overflow-hidden bg-l-term dark:bg-d-term border border-l-bd dark:border-d-bd">
            <span className="font-mono text-okL dark:text-ok whitespace-nowrap" style={{ fontSize: `${fontSize}px` }}>backend $ yarn dev — ready on :5000</span>
          </div>
        </section>

        <section className={'px-[18px] pt-3.5 pb-5' + (tab === 'about' ? '' : ' hidden')}>
          <div className="flex items-center gap-3 mb-2.5">
            <span className="text-accentL dark:text-accent text-[26px] leading-none">▚</span>
            <div>
              <div className="font-bold text-base">IV Server Manager</div>
              <div className="text-l-dim dark:text-d-dim text-[12px] mt-0.5">version <span>{version || '—'}</span></div>
            </div>
          </div>
          <p className="text-l-dim dark:text-d-dim text-[12.5px] leading-relaxed mb-4">
            Run, restart, and watch every dev server from one window — live logs, per-server
            shell &amp; git branch, port freeing, and a scratch terminal.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-[18px] gap-y-[9px] text-[12.5px]">
            <dt className="text-l-dim dark:text-d-dim">Developer</dt><dd className="m-0">Iftekhar Md Shishir</dd>
            <dt className="text-l-dim dark:text-d-dim">Role</dt><dd className="m-0">Software Engineer at ImpleVista</dd>
            <dt className="text-l-dim dark:text-d-dim">Education</dt><dd className="m-0">University of Rajshahi</dd>
            <dt className="text-l-dim dark:text-d-dim">Contact</dt><dd className="m-0">iftekharweb@gmail.com</dd>
            <dt className="text-l-dim dark:text-d-dim">Built with</dt><dd className="m-0">Electron · xterm.js · node-pty</dd>
            <dt className="text-l-dim dark:text-d-dim">License</dt><dd className="m-0">MIT</dd>
            <dt className="text-l-dim dark:text-d-dim">Source</dt>
            <dd className="m-0">
              <a href="#" className="text-accentL dark:text-accent cursor-pointer no-underline hover:underline" onClick={(e) => { e.preventDefault(); window.api.openExternal(REPO); }}>
                github.com/iftekharweb/iv-server-manager
              </a>
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
