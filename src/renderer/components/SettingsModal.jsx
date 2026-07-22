import { useEffect } from 'react';
import { FiX, FiMoon, FiSun, FiMinus, FiPlus } from 'react-icons/fi';
import { useApp } from '../store/AppStore.jsx';
import { FONT_MIN, FONT_MAX } from '../lib/terminalManager.js';

const REPO = 'https://github.com/iftekharweb/iv-server-manager';

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
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains('modal-overlay') && close()}>
      <div className="modal settings-modal">
        <div className="settings-head">
          <div className="settings-tabs" role="tablist">
            <button className={'tab' + (tab === 'appearance' ? ' active' : '')} role="tab" onClick={() => showTab('appearance')}>Appearance</button>
            <button className={'tab' + (tab === 'about' ? ' active' : '')} role="tab" onClick={() => showTab('about')}>About</button>
          </div>
          <button className="icon-close" title="Close" aria-label="Close" onClick={close}><FiX /></button>
        </div>

        <section className={'tab-panel' + (tab === 'appearance' ? '' : ' hidden')}>
          <div className="setting">
            <div className="setting-label">
              <span className="setting-name">Theme</span>
              <span className="setting-desc">Colors for the whole app, including terminals.</span>
            </div>
            <div className="segmented" role="group" aria-label="Theme">
              <button className={'seg-btn' + (theme === 'dark' ? ' active' : '')} onClick={() => actions.setTheme('dark')}><FiMoon /> Dark</button>
              <button className={'seg-btn' + (theme === 'light' ? ' active' : '')} onClick={() => actions.setTheme('light')}><FiSun /> Light</button>
            </div>
          </div>

          <div className="setting">
            <div className="setting-label">
              <span className="setting-name">Terminal font size</span>
              <span className="setting-desc">Applies to every log and the scratch terminal.</span>
            </div>
            <div className="stepper" role="group" aria-label="Font size">
              <button className="step-btn" aria-label="Smaller" disabled={fontSize <= FONT_MIN} onClick={() => bumpFont(-1)}><FiMinus /></button>
              <span className="step-value">{fontSize}px</span>
              <button className="step-btn" aria-label="Larger" disabled={fontSize >= FONT_MAX} onClick={() => bumpFont(1)}><FiPlus /></button>
            </div>
          </div>

          <div className="font-preview">
            <span style={{ fontSize: `${fontSize}px` }}>backend $ yarn dev — ready on :5000</span>
          </div>
        </section>

        <section className={'tab-panel' + (tab === 'about' ? '' : ' hidden')}>
          <div className="about-brand">
            <span className="about-logo">▚</span>
            <div>
              <div className="about-name">IV Server Manager</div>
              <div className="about-ver">version <span>{version || '—'}</span></div>
            </div>
          </div>
          <p className="about-tagline">
            Run, restart, and watch every dev server from one window — live logs, per-server
            shell &amp; git branch, port freeing, and a scratch terminal.
          </p>
          <dl className="about-grid">
            <dt>Developer</dt><dd>Iftekhar Md Shishir</dd>
            <dt>Role</dt><dd>Software Engineer at ImpleVista</dd>
            <dt>Education</dt><dd>University of Rajshahi</dd>
            <dt>Contact</dt><dd>iftekharweb@gmail.com</dd>
            <dt>Built with</dt><dd>Electron · xterm.js · node-pty</dd>
            <dt>License</dt><dd>MIT</dd>
            <dt>Source</dt>
            <dd>
              <a href="#" className="about-link" onClick={(e) => { e.preventDefault(); window.api.openExternal(REPO); }}>
                github.com/iftekharweb/iv-server-manager
              </a>
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
