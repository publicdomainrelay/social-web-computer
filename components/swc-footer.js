export class SwcFooter extends HTMLElement {
  connectedCallback() { this.render(); }

  render() {
    this.innerHTML = `
      <footer class="swc-footer">
        <div class="swc-footer__grid">
          <div style="display:flex;flex-direction:column;gap:12px;max-width:340px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:24px;height:24px;border-radius:999px;background:var(--color-accent);display:inline-flex;align-items:center;justify-content:center;flex:none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
              </span>
              <span style="font-family:var(--font-heading);font-size:16px;">Compute Contracts</span>
            </div>
            <p style="font-size:14px;line-height:24px;color:color-mix(in srgb, var(--color-text) 70%, transparent);margin:0;">
              A decentralized compute marketplace built on the AT Protocol. Requests, bids and receipts live as signed records on the machines that make them — alpha software, open for building.
            </p>
          </div>
          <div class="swc-footer__links">
            <span class="swc-footer__heading">Protocol</span>
            <a href="docs.html">Record types</a>
            <a href="docs.html#state-machine">State machine</a>
            <a href="docs.html#settlement">Settlement &amp; events</a>
            <a href="trust.html">Trust &amp; policy</a>
            <a href="security.html">Security &amp; verification</a>
            <a href="workload-identity.html">Workload Identity Federation</a>
            <a href="gateway.html">Gateway service</a>
          </div>
          <div class="swc-footer__links">
            <span class="swc-footer__heading">Product</span>
            <a href="how-it-works.html">How it works</a>
            <a href="marketplace.html">Marketplace</a>
            <a href="get-started.html">Get started</a>
          </div>
          <div class="swc-footer__links">
            <span class="swc-footer__heading">Community</span>
            <a href="about.html">About</a>
            <a href="https://github.com/publicdomainrelay/org-root-dispatcher-typescript" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:5px;">
              Repository
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            </a>
            <a href="docs.html">NSID reference</a>
          </div>
        </div>
        <div class="swc-footer__bottom">
          <span>Compute Contracts Protocol — alpha. Interfaces may change without notice.</span>
          <span class="tag tag-accent-2">Built on AT Protocol</span>
        </div>
      </footer>
    `;
  }
}

if (!customElements.get('swc-footer')) {
  customElements.define('swc-footer', SwcFooter);
}
