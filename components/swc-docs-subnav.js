import { escapeHtml } from '../main.js';

export class SwcDocsSubnav extends HTMLElement {
  static get observedAttributes() { return ['current']; }

  connectedCallback() { this.render(); }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'current' && this.isConnected && oldVal !== newVal) this.render();
  }

  render() {
    const current = this.getAttribute('current') || 'spec';
    const pages = [
      { id: 'spec', label: 'Spec', href: 'docs.html' },
      { id: 'trust', label: 'Trust & policy', href: 'trust.html' },
      { id: 'security', label: 'Security', href: 'security.html' },
      { id: 'wif', label: 'Workload identity', href: 'workload-identity.html' },
      { id: 'gateway', label: 'Gateway', href: 'gateway.html' },
    ];

    this.innerHTML = `
      <nav class="swc-docs-subnav" role="navigation" aria-label="Protocol documentation">
        <span class="swc-docs-subnav__label">Protocol</span>
        ${pages.map(p => `
          <a href="${escapeHtml(p.href)}"
             ${current === p.id ? 'aria-current="page"' : ''}
          >${escapeHtml(p.label)}</a>
        `).join('')}
      </nav>
    `;
  }
}

if (!customElements.get('swc-docs-subnav')) {
  customElements.define('swc-docs-subnav', SwcDocsSubnav);
}
