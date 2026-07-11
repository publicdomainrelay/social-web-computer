import { escapeHtml } from '../main.js';

export class SwcNav extends HTMLElement {
  static get observedAttributes() { return ['current']; }

  connectedCallback() { this.render(); }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'current' && this.isConnected && oldVal !== newVal) this.render();
  }

  render() {
    const current = this.getAttribute('current') || 'home';
    const links = [
      { id: 'how-it-works', label: 'How it works', href: 'how-it-works.html' },
      { id: 'marketplace', label: 'Marketplace', href: 'marketplace.html' },
      { id: 'docs', label: 'Docs', href: 'docs.html' },
      { id: 'about', label: 'About', href: 'about.html' },
    ];

    this.innerHTML = `
      <nav class="swc-nav" role="navigation" aria-label="Main navigation">
        <a href="index.html" class="swc-nav__logo">
          <span class="swc-nav__logo-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
          </span>
          <span class="swc-nav__brand">Compute Contracts</span>
        </a>
        <div class="swc-nav__links">
          ${links.map(l => `
            <a href="${escapeHtml(l.href)}"
               class="swc-nav__mobile-hidden"
               ${current === l.id ? 'aria-current="page"' : ''}
            >${escapeHtml(l.label)}</a>
          `).join('')}
          <a href="https://github.com/publicdomainrelay/org-root-dispatcher-typescript"
             target="_blank" rel="noopener"
             class="swc-nav__mobile-hidden"
             style="display:flex;align-items:center;gap:5px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            GitHub
          </a>
          <a href="get-started.html" class="btn btn-primary">Get started</a>
        </div>
      </nav>
    `;
  }
}

if (!customElements.get('swc-nav')) {
  customElements.define('swc-nav', SwcNav);
}
