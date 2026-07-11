import { escapeHtml, log } from '../main.js';

const REGION_LABEL = { us: 'USA-west', eu: 'DEU-central', ap: 'JPN-south' };

const TRUST_LABEL = {
  vouched: { label: 'tangled-vouch · vouched', cls: 'tag-accent-2' },
  mutual: { label: 'mutuals · mutual follow', cls: 'tag-accent-2' },
  none: { label: 'outside policy', cls: 'tag-neutral' },
};

const SEED_RFPS = [
  { id: 'r1', region: 'us', computeVm: { cpus: 4, mem: '16G', disk: '200G', network: '500G', location: { country: 'USA', region: 'west' } }, role: 'ml-inference-worker', policy: 'tangled-vouch',
    bids: [ { id: 'b1', provider: 'at://did:plc:ripple', payloadType: 'bids.free' }, { id: 'b2', provider: 'at://did:plc:kestrel', payloadType: 'bids.free' } ] },
  { id: 'r2', region: 'eu', computeVm: { cpus: 8, mem: '32G', disk: '250G', network: '500G', location: { country: 'DEU', region: 'central' } }, role: 'batch-render-node', policy: 'mutuals',
    bids: [ { id: 'b3', provider: 'at://did:plc:harborlight', payloadType: 'bids.free' } ] },
  { id: 'r3', region: 'ap', computeVm: { cpus: 2, mem: '4G', disk: '40G', network: '500G', location: { country: 'JPN', region: 'south' } }, role: 'ci-runner', policy: 'dynamic',
    bids: [ { id: 'b4', provider: 'at://did:plc:tinbird', payloadType: 'bids.free' }, { id: 'b5', provider: 'at://did:plc:mossgate', payloadType: 'bids.free' }, { id: 'b6', provider: 'at://did:plc:driftwood', payloadType: 'bids.free' } ] },
  { id: 'r4', region: 'us', computeVm: { cpus: 16, mem: '64G', disk: '1T', network: '1T', location: { country: 'USA', region: 'west' } }, role: 'training-cluster-node', policy: 'tangled-vouch',
    bids: [ { id: 'b7', provider: 'at://did:plc:kestrel', payloadType: 'bids.free' } ] },
  { id: 'r5', region: 'eu', computeVm: { cpus: 1, mem: '2G', disk: '20G', network: '500G', location: { country: 'DEU', region: 'central' } }, role: 'edge-relay', policy: 'only-me', bids: [] },
  { id: 'r6', region: 'ap', computeVm: { cpus: 4, mem: '8G', disk: '100G', network: '500G', location: { country: 'JPN', region: 'south' } }, role: 'game-server', policy: 'mutuals',
    bids: [ { id: 'b8', provider: 'at://did:plc:tinbird', payloadType: 'bids.free' } ] },
];

const LOG_POOL = [
  { tag: 'commit', text: 'com.publicdomainrelay.temp.market.rfp created by did:plc:alice — role: ml-inference-worker' },
  { tag: 'commit', text: 'com.publicdomainrelay.temp.market.bid created by did:plc:ripple' },
  { tag: 'policy', text: 'bidder policy mutuals: mutual follow — did:plc:kestrel allowed' },
  { tag: 'commit', text: 'com.publicdomainrelay.temp.market.bid created by did:plc:kestrel' },
  { tag: 'relay ', text: 'listReposByCollection: discovering offering records' },
  { tag: 'commit', text: 'com.publicdomainrelay.temp.market.accept created by did:plc:alice' },
  { tag: 'attest', text: 'network.attested.signature verified on com.publicdomainrelay.temp.market.accept' },
  { tag: 'commit', text: 'com.publicdomainrelay.temp.market.receipt created by did:plc:bob' },
  { tag: 'event ', text: 'com.publicdomainrelay.temp.compute.events.vm.started — container booted in us-west-2' },
  { tag: 'event ', text: 'com.publicdomainrelay.temp.compute.events.vm.onNetwork — address assigned' },
];

export class SwcMarketplace extends HTMLElement {
  connectedCallback() {
    this._state = { region: 'all', selectedId: 'r1', accepted: {}, logCount: 4 };
    this._t = setInterval(() => {
      this._state.logCount = Math.min(this._state.logCount + 1, LOG_POOL.length + 20);
      this._renderLog();
    }, 3200);
    this.render();
    this._wire();
  }

  disconnectedCallback() {
    clearInterval(this._t);
  }

  /* ── RFP Cards ── */
  get _filteredRfps() {
    const region = this._state.region;
    return SEED_RFPS.filter(r => region === 'all' || r.region === region);
  }

  _statusFor(r) {
    if (this._state.accepted[r.id]) return { label: 'Settled', cls: 'tag-accent-2' };
    if (r.bids.length === 0) return { label: 'Open · no bids', cls: 'tag-neutral' };
    return { label: r.bids.length + ' bid' + (r.bids.length > 1 ? 's' : ''), cls: 'tag-accent' };
  }

  _rfpCardsHtml() {
    return this._filteredRfps.map((r, i) => {
      const st = this._statusFor(r);
      const isSel = this._state.selectedId === r.id;
      return `
        <div class="rfp-card ${isSel ? 'rfp-card--selected' : ''}" data-rfp-id="${escapeHtml(r.id)}">
          <div class="rfp-card__header">
            <span class="rfp-card__region">${escapeHtml(REGION_LABEL[r.region])} · open ${(i + 1) * 2}m</span>
            <span class="tag ${escapeHtml(st.cls)}">${escapeHtml(st.label)}</span>
          </div>
          <div class="rfp-card__title">${escapeHtml(r.computeVm.cpus + ' cpu / ' + r.computeVm.mem + ' / ' + r.computeVm.disk)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="rfp-card__role">role: ${escapeHtml(r.role)}</span>
            <span class="tag tag-accent">${escapeHtml(r.computeVm.network)}</span>
          </div>
          <span class="tag tag-outline" style="font:10.5px var(--font-mono);margin-top:8px;">policy: ${escapeHtml(r.policy)}</span>
        </div>
      `;
    }).join('');
  }

  /* ── Detail panel ── */
  get _selectedRfp() {
    return SEED_RFPS.find(r => r.id === this._state.selectedId) || SEED_RFPS[0];
  }

  _bidRowsHtml() {
    const rfp = this._selectedRfp;
    const acceptedBidId = this._state.accepted[rfp.id];
    return rfp.bids.map(b => {
      const isAccepted = acceptedBidId === b.id;
      return `
        <div class="bid-card ${isAccepted ? 'bid-card--accepted' : ''}">
          <div class="bid-card__meta">
            <span class="bid-card__provider">${escapeHtml(b.provider)}</span>
            <span class="tag tag-accent" style="width:fit-content;font-size:10.5px;">${escapeHtml(b.payloadType)}</span>
          </div>
          ${!acceptedBidId ? `<button class="btn btn-primary btn-sm" data-accept-bid="${escapeHtml(b.id)}">Accept bid</button>` : ''}
          ${isAccepted ? '<span class="tag tag-accent-2">Accepted</span>' : ''}
        </div>
      `;
    }).join('');
  }

  _detailHtml() {
    const rfp = this._selectedRfp;
    const st = this._statusFor(rfp);
    const isSettled = !!this._state.accepted[rfp.id];
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <span style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;color:var(--color-accent-700);">${escapeHtml(REGION_LABEL[rfp.region])} · role: ${escapeHtml(rfp.role)}</span>
          <h2 style="font-family:var(--font-heading);font-weight:400;font-size:24px;margin:6px 0 0;">${escapeHtml(rfp.computeVm.cpus + ' cpu / ' + rfp.computeVm.mem + ' / ' + rfp.computeVm.disk)}</h2>
          <a href="trust.html" style="display:inline-block;margin-top:8px;font:11px var(--font-mono);color:var(--color-accent-700);text-decoration:none;border:1.5px solid var(--color-accent-300);border-radius:999px;padding:4px 12px;">requester policy: ${escapeHtml(rfp.policy)}</a>
        </div>
        <span class="tag ${escapeHtml(st.cls)}" style="font-size:13px;padding:7px 14px;">${escapeHtml(st.label)}</span>
      </div>
      <div style="margin-top:22px;">
        <span style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;color:var(--color-text-faint);">Bids (${rfp.bids.length})</span>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
          ${this._bidRowsHtml()}
        </div>
      </div>
      ${isSettled ? `
        <div style="margin-top:20px;padding:16px 18px;background:var(--color-accent-2-100);border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:12px;">
            <svg width="20" height="20" style="flex:none;" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-2-700)" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.35 8.95a1 1 0 0 1-.6-.01C8.5 20.5 5 18 5 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C15.51 3.81 18 5 20 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
            <span style="font-size:13.5px;line-height:20px;">Receipt published by provider — signed attestation proving contract fulfillment, referencing the accept record.</span>
          </div>
          <button class="btn btn-primary btn-sm" style="display:flex;align-items:center;gap:6px;" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
            Waiting for SSH…
          </button>
        </div>
      ` : ''}
    `;
  }

  /* ── Firehose log ── */
  _renderLog() {
    const logEl = this.querySelector('#firehose-log');
    if (!logEl) return;
    const n = this._state.logCount;
    const lines = Array.from({ length: Math.min(n, 8) }, (_, i) => LOG_POOL[(n - 1 - i + LOG_POOL.length * 3) % LOG_POOL.length]);
    logEl.innerHTML = lines.map(l => `
      <div class="firehose-log__line"><span class="firehose-log__tag">${escapeHtml(l.tag)}</span> ${escapeHtml(l.text)}</div>
    `).join('');
  }

  /* ── Main render ── */
  render() {
    this.innerHTML = `
      <div style="display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:24px;align-items:start;padding-bottom:32px;">
        <!-- RFP list -->
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${this._rfpCardsHtml()}
        </div>
        <!-- Detail panel -->
        <div class="card elev-md" style="padding:28px;min-height:360px;">
          ${this._detailHtml()}
        </div>
      </div>
      <!-- Firehose log -->
      <div style="padding-bottom:32px;">
        <span style="display:block;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;color:var(--color-text-faint);margin:0 0 10px;">Firehose</span>
        <div class="firehose-log" id="firehose-log"></div>
      </div>
    `;
    this._renderLog();
  }

  /* ── Event wire-up ── */
  _wire() {
    // RFP card selection
    this.addEventListener('click', (e) => {
      const card = e.target.closest('.rfp-card');
      if (card) {
        this._state.selectedId = card.dataset.rfpId;
        this.render();
      }
      // Bid acceptance
      const acceptBtn = e.target.closest('[data-accept-bid]');
      if (acceptBtn) {
        const bidId = acceptBtn.dataset.acceptBid;
        this._state.accepted = { ...this._state.accepted, [this._state.selectedId]: bidId };
        this.render();
      }
    });
  }
}

if (!customElements.get('swc-marketplace')) {
  customElements.define('swc-marketplace', SwcMarketplace);
}
