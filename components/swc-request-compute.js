// swc-request-compute.js — "Request Compute" custom element for social-web-computer.
// Imports compute-spa's portable library modules via import map bare specifiers.
// Uses social-web-computer's styles.css design tokens exclusively.

import { escapeHtml, log } from '../main.js';
import {
  COMPUTE_VM_NSID, RFP_NSID, ACCEPT_NSID, OFFERING_NSID,
  VOUCH_NSID, BADGE_BLUE_KEYS_NSID, SUBMIT_RFP_NSID, SUBMIT_ACCEPT_NSID,
  FEDPROXY_HOST, XRPC_DISPATCHER_HOST, MARKET_RELAY_URL,
  didPlcKey, vmServiceName, terminalUrl, generatePassword,
} from 'compute-spa/constants';
import {
  loadOrGenerateKeypair, createRelayClient, createRelayKeypairAdapter, registerDidPlc,
} from 'compute-spa/relay';
import { createServiceAuthJWT } from 'compute-spa/service-auth';
import { CLOUD_INIT_PRESETS, buildDefaultUserData } from 'compute-spa/cloud-init';
import { createEphemeralPds } from 'compute-spa/ephemeral-pds';

const POLICY_MODES = [
  { value: 'only-me', label: 'Only Me', desc: 'Only your own DIDs — an internal pool.' },
  { value: 'tangled-vouch', label: 'Tangled Vouch', desc: 'Anyone you have vouched for on Tangled\'s graph.' },
  { value: 'mutuals', label: 'Mutuals', desc: 'Mutual follows — reuse your social graph.' },
  { value: 'dynamic', label: 'Dynamic', desc: 'Delegate to a remote policy engine URL.' },
];

const VM_NAME_PREFIX = 'test-';

export class SwcRequestCompute extends HTMLElement {
  constructor() {
    super();
    this._state = {
      phase: 'loading',
      relayStatus: 'disconnected',
      relaySubdomain: null,
      proxyRef: null,
      policyMode: 'only-me',
      policyEngineEndpoint: '',
      vmName: VM_NAME_PREFIX + Math.random().toString(36).slice(2, 6),
      vmSpec: { cpus: 2, mem: '4G', disk: '40G', network: '500G' },
      role: '',
      cloudInit: '',
      presetId: 'default',
      bidWindowSec: 30,
      bids: [],
      flowResult: null,
      step: 0,
      stepLabel: '',
      logLines: [],
      error: null,
    };
    this._kp = null;
    this._relay = null;
    this._epds = null;
    this._stepResolvers = [];
  }

  connectedCallback() {
    this._init();
  }

  disconnectedCallback() {
    if (this._relay) { this._relay.close(); this._relay = null; }
  }

  async _init() {
    try {
      this._kp = await loadOrGenerateKeypair();
      await this._startRelay();
    } catch (err) {
      log('error', 'swc-request-compute', 'initFailed', { error: String(err) });
      this._state.error = String(err);
    }
    this._state.phase = 'ready';
    if (this._state.presetId === 'default') {
      this._state.cloudInit = buildDefaultUserData({
        vmName: this._state.vmName,
        serviceName: vmServiceName(this._state.role || 'compute', this._state.vmName),
        relaySubdomain: this._state.relaySubdomain || '',
        didPlcKey: this._state.relaySubdomain || '',
      });
    }
    this.render();
  }

  async _startRelay() {
    const adapter = createRelayKeypairAdapter(this._kp);
    const serviceAuthMinter = (lxm) => {
      if (!this._kp) return Promise.resolve('');
      return Promise.resolve(createServiceAuthJWT({
        privateKeyHex: this._kp.privateKeyHex,
        iss: this._kp.did,
        aud: `did:web:${XRPC_DISPATCHER_HOST}`,
        lxm,
      }));
    };
    this._relay = createRelayClient({
      host: XRPC_DISPATCHER_HOST,
      keypair: this._kp,
      serviceAuthMinter,
      onBid: (bid) => {
        this._addLog('info', `Bid received: ${bid.did || 'unknown'}`);
        this._state.bids.push(bid);
      },
      onStateChange: (status) => {
        this._state.relayStatus = status;
        if (status === 'registered') {
          this._state.relaySubdomain = this._relay?.subdomain || null;
          this._state.proxyRef = this._relay?.proxyRef || null;
          this._addLog('info', `Relay registered: ${this._state.relaySubdomain}`);
        }
        if (this.isConnected) this.render();
      },
    });
    this._addLog('info', 'Connecting to relay...');
    await this._relay.start();
  }

  get isConnected() { return this._state.relayStatus === 'registered'; }

  _addLog(level, msg) {
    this._state.logLines.push({ ts: new Date().toISOString(), level, msg });
    if (this._state.logLines.length > 200) this._state.logLines.shift();
  }

  render() {
    if (this._state.phase === 'loading') this._renderLoading();
    else if (this._state.phase === 'submitting') this._renderSubmitting();
    else if (this._state.phase === 'result') this._renderResult();
    else this._renderReady();
    this._wire();
  }

  /* ── render: loading ── */
  _renderLoading() {
    this.innerHTML = `<div class="card elev-sm" style="padding:32px;text-align:center;">
      <p style="font-family:var(--font-mono);font-size:14px;color:var(--color-text-muted);">Generating keypair...</p>
    </div>`;
  }

  /* ── render: ready (form) ── */
  _renderReady() {
    const s = this._state;
    const connected = this.isConnected;
    const statusDot = s.relayStatus === 'registered' ? 'var(--color-accent-2-700)' :
      s.relayStatus === 'connecting' ? 'var(--color-accent-700)' : 'var(--color-neutral-500)';
    const statusLabel = s.relayStatus === 'registered' ? `connected · ${s.relaySubdomain || ''}` :
      s.relayStatus === 'connecting' ? 'connecting...' : 'disconnected';
    const policyOpts = POLICY_MODES.map(m => {
      const checked = s.policyMode === m.value ? 'checked' : '';
      return `<label class="seg-opt"><input type="radio" name="policy" value="${m.value}" ${checked}><span title="${escapeHtml(m.desc)}">${escapeHtml(m.label)}</span></label>`;
    }).join('');

    this.innerHTML = `<div style="display:flex;flex-direction:column;gap:24px;">

      <!-- Relay status -->
      <div class="card elev-sm" style="padding:14px 18px;display:flex;align-items:center;gap:10px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${statusDot};display:inline-block;flex:none;"></span>
        <span style="font-size:13px;font-family:var(--font-mono);">${escapeHtml(statusLabel)}</span>
        ${s.error ? `<span class="tag tag-neutral" style="font-size:11px;">${escapeHtml(s.error)}</span>` : ''}
      </div>

      <!-- Policy mode -->
      <div class="card elev-sm" style="padding:20px;">
        <h3 style="font-size:16px;margin:0 0 8px;">Policy Mode</h3>
        <p style="font-size:13px;color:color-mix(in srgb, var(--color-text) 70%, transparent);margin:0 0 12px;">Controls who can bid on your RFP.</p>
        <div class="seg" id="policy-selector">${policyOpts}</div>
        <div id="policy-url-group" class="${s.policyMode === 'dynamic' ? '' : 'hidden'}" style="margin-top:12px;">
          <label for="policy-url" style="display:block;font-size:13px;margin-bottom:4px;">Policy Engine URL</label>
          <input type="text" id="policy-url" value="${escapeHtml(s.policyEngineEndpoint)}" placeholder="https://your-policy-server.com" style="width:100%;max-width:420px;padding:8px 12px;border:1px solid var(--color-divider);border-radius:var(--radius-md);font:13px var(--font-mono);background:var(--color-bg);color:var(--color-text);">
        </div>
      </div>

      <!-- VM Spec -->
      <div class="card elev-sm" style="padding:20px;">
        <h3 style="font-size:16px;margin:0 0 12px;">VM Spec</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">
          <div class="form-group"><label>CPUs</label><input type="number" id="vm-cpus" value="${s.vmSpec.cpus}" min="1" max="64"></div>
          <div class="form-group"><label>Memory</label><select id="vm-mem">${['512M','1G','2G','4G','8G','16G','32G','64G'].map(v => `<option value="${v}" ${s.vmSpec.mem===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="form-group"><label>Disk</label><select id="vm-disk">${['10G','20G','40G','100G','200G','500G','1T'].map(v => `<option value="${v}" ${s.vmSpec.disk===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="form-group"><label>Network</label><select id="vm-net">${['500G','1T','5T','10T'].map(v => `<option value="${v}" ${s.vmSpec.network===v?'selected':''}>${v}</option>`).join('')}</select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div class="form-group"><label>Role</label><input type="text" id="vm-role" value="${escapeHtml(s.role)}" placeholder="ci-runner, ml-inference..."></div>
          <div class="form-group"><label>VM Name</label><input type="text" id="vm-name" value="${escapeHtml(s.vmName)}"></div>
        </div>
      </div>

      <!-- Cloud-Init -->
      <div class="card elev-sm" style="padding:20px;">
        <h3 style="font-size:16px;margin:0 0 8px;">Cloud-Init</h3>
        <div style="margin-bottom:10px;">
          <select id="preset-select">${CLOUD_INIT_PRESETS.map(p => `<option value="${p.id}" ${s.presetId===p.id?'selected':''}>${escapeHtml(p.label)}</option>`).join('')}</select>
        </div>
        <textarea id="cloud-init-text" rows="8" style="width:100%;padding:12px;border:1px solid var(--color-divider);border-radius:var(--radius-md);font:12px var(--font-mono);background:var(--color-bg);color:var(--color-text);resize:vertical;" ${s.presetId !== 'custom' ? 'readonly' : ''}>${escapeHtml(s.cloudInit)}</textarea>
      </div>

      <!-- Bid window -->
      <div class="card elev-sm" style="padding:20px;">
        <div class="form-group" style="max-width:200px;">
          <label>Bid Window (seconds)</label>
          <input type="number" id="bid-window" value="${s.bidWindowSec}" min="5" max="300">
        </div>
      </div>

      <!-- Submit -->
      <button id="submit-btn" class="btn btn-primary btn-block" ${connected ? '' : 'disabled'}>
        ${connected ? 'Request VM via Market' : 'Waiting for relay...'}
      </button>

    </div>`;
  }

  /* ── render: submitting ── */
  _renderSubmitting() {
    const s = this._state;
    const steps = [
      'Keypair', 'Relay connect', 'DID:PLC', 'Cloud-init', 'TTYD creds',
      'compute.vm record', 'market.rfp record', 'Discover bidders',
      'Submit RFP', 'Collect bids', 'Accept winner', 'Save VM',
    ];
    const stepHtml = steps.map((label, i) => {
      let cls = 'progress-step';
      if (i < s.step) cls += ' progress-step--done';
      else if (i === s.step) cls += ' progress-step--active';
      return `<span class="${cls}">${i < s.step ? '&#10003;' : i+1} ${escapeHtml(label)}</span>`;
    }).join('');

    this.innerHTML = `<div style="display:flex;flex-direction:column;gap:20px;">
      <div class="card elev-sm" style="padding:20px;">
        <h3 style="font-size:16px;margin:0 0 12px;">Progress</h3>
        <div class="progress-bar">${stepHtml}</div>
      </div>
      <div class="card elev-sm" style="padding:16px;">
        <div class="log-area" id="log-area">${s.logLines.slice(-30).map(l =>
          `<div class="log-entry log-${l.level}"><span class="log-ts">${escapeHtml(l.ts.slice(11,19))}</span> ${escapeHtml(l.msg)}</div>`
        ).join('')}</div>
      </div>
    </div>`;
  }

  /* ── render: result ── */
  _renderResult() {
    const r = this._state.flowResult || {};
    const serviceName = vmServiceName(this._state.role || 'compute', this._state.vmName);
    const token = r.ttydPassword || '';
    const url = terminalUrl(this._state.role || 'compute', this._state.vmName, token);

    this.innerHTML = `<div style="display:flex;flex-direction:column;gap:20px;">
      <div class="card elev-sm" style="padding:24px;">
        <span class="tag tag-accent-2" style="margin-bottom:8px;">VM Provisioned</span>
        <h3 style="font-size:18px;margin:8px 0 4px;">${escapeHtml(this._state.vmName)}</h3>
        <div style="font-size:13px;color:color-mix(in srgb, var(--color-text) 70%, transparent);display:flex;flex-direction:column;gap:4px;">
          <span>Spec: ${this._state.vmSpec.cpus} CPU / ${this._state.vmSpec.mem} / ${this._state.vmSpec.disk} / ${this._state.vmSpec.network}</span>
          ${r.winnerDid ? `<span>Winner: ${escapeHtml(r.winnerDid)}</span>` : ''}
          ${r.policyMode ? `<span>Policy: ${escapeHtml(r.policyMode)}</span>` : ''}
        </div>
      </div>
      <div class="card elev-sm" style="padding:20px;">
        <h3 style="font-size:16px;margin:0 0 8px;">Terminal Access</h3>
        <div class="key-code" style="margin-bottom:12px;">${escapeHtml(token)}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <a href="${escapeHtml(url)}" target="_blank" class="btn btn-primary">Open Terminal</a>
          <button id="copy-token-btn" class="btn btn-secondary">Copy Token</button>
          <a href="." class="btn btn-ghost">Request Another</a>
        </div>
      </div>
      ${r.vmUri ? `<div class="card elev-sm" style="padding:16px;"><span style="font-size:12px;font-family:var(--font-mono);color:var(--color-text-muted);">VM: ${escapeHtml(r.vmUri)}</span></div>` : ''}
      ${r.receiptUri ? `<div class="card elev-sm" style="padding:16px;"><span style="font-size:12px;font-family:var(--font-mono);color:var(--color-text-muted);">Receipt: ${escapeHtml(r.receiptUri)}</span></div>` : ''}
    </div>`;
  }

  /* ── event wiring ── */
  _wire() {
    // Policy selector
    const sel = this.querySelector('#policy-selector');
    if (sel) sel.addEventListener('change', (e) => {
      if (e.target.name === 'policy') {
        this._state.policyMode = e.target.value;
        this.render();
      }
    });
    // Policy URL
    const urlInput = this.querySelector('#policy-url');
    if (urlInput) urlInput.addEventListener('input', (e) => { this._state.policyEngineEndpoint = e.target.value; });
    // VM spec inputs
    ['vm-cpus','vm-mem','vm-disk','vm-net','vm-role','vm-name'].forEach(id => {
      const el = this.querySelector(`#${id}`);
      if (!el) return;
      el.addEventListener(el.tagName === 'INPUT' && el.type !== 'number' ? 'input' : 'change', () => {
        if (id === 'vm-cpus') this._state.vmSpec.cpus = parseInt(el.value) || 2;
        else if (id === 'vm-mem') this._state.vmSpec.mem = el.value;
        else if (id === 'vm-disk') this._state.vmSpec.disk = el.value;
        else if (id === 'vm-net') this._state.vmSpec.network = el.value;
        else if (id === 'vm-role') this._state.role = el.value;
        else if (id === 'vm-name') this._state.vmName = el.value;
      });
    });
    // Preset selector
    const presetEl = this.querySelector('#preset-select');
    if (presetEl) presetEl.addEventListener('change', (e) => {
      const preset = CLOUD_INIT_PRESETS.find(p => p.id === e.target.value);
      this._state.presetId = e.target.value;
      if (preset && preset.build) {
        this._state.cloudInit = preset.build({
          vmName: this._state.vmName,
          serviceName: vmServiceName(this._state.role || 'compute', this._state.vmName),
          relaySubdomain: this._state.relaySubdomain || '',
          didPlcKey: this._state.relaySubdomain || '',
        });
      } else if (preset) {
        this._state.cloudInit = preset.script || '';
      }
      this.render();
    });
    // Bid window
    const bwEl = this.querySelector('#bid-window');
    if (bwEl) bwEl.addEventListener('change', (e) => { this._state.bidWindowSec = parseInt(e.target.value) || 30; });
    // Submit
    const submitBtn = this.querySelector('#submit-btn');
    if (submitBtn) submitBtn.addEventListener('click', () => this._handleSubmit());
    // Copy token
    const copyBtn = this.querySelector('#copy-token-btn');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const token = this._state.flowResult?.ttydPassword || '';
      navigator.clipboard.writeText(token).catch(() => {});
    });
  }

  /* ── submit flow ── */
  async _handleSubmit() {
    const s = this._state;
    s.phase = 'submitting';
    s.step = 0;
    s.bids = [];
    s.logLines = [];
    s.error = null;
    this.render();

    const advance = (label) => {
      s.stepLabel = label;
      this._addLog('info', `[${s.step}] ${label}`);
      this.render();
    };

    try {
      // Step 0: Keypair
      advance('Loading keypair');
      if (!this._kp) this._kp = await loadOrGenerateKeypair();
      s.step = 1;

      // Step 1: Relay connect
      advance('Connecting to relay');
      if (!this._relay || this._relay.status !== 'registered') {
        await this._startRelay();
      }
      s.step = 2;

      // Step 2: Register did:plc
      advance('Registering did:plc identity');
      const didPlc = await registerDidPlc(this._kp, this._relay.proxyRef);
      const plcKey = didPlcKey(didPlc);
      s.step = 3;

      // Step 3: Cloud-init
      advance('Building cloud-init');
      let userData = s.cloudInit;
      if (!userData && s.presetId === 'default') {
        userData = buildDefaultUserData({
          vmName: s.vmName,
          serviceName: vmServiceName(s.role || 'compute', s.vmName),
          relaySubdomain: s.relaySubdomain || '',
          didPlcKey: plcKey,
        });
      }
      s.step = 4;

      // Step 4: Register TTYD credentials
      const ttydPassword = generatePassword();
      advance('Registering terminal credentials');
      this._relay.registerTtydRequest({
        vmName: s.vmName,
        serviceName: vmServiceName(s.role || 'compute', s.vmName),
        password: ttydPassword,
        didPlc,
      });
      s.step = 5;

      // Step 5: Create compute.vm record
      advance('Creating compute.vm record');
      this._epds = createEphemeralPds(this._kp.did);
      const vmRecord = {
        $type: COMPUTE_VM_NSID,
        name: s.vmName,
        serviceName: vmServiceName(s.role || 'compute', s.vmName),
        cpus: s.vmSpec.cpus,
        mem: s.vmSpec.mem,
        disk: s.vmSpec.disk,
        network: s.vmSpec.network,
        role: s.role || 'compute',
        user_data: userData,
        relaySubdomain: s.relaySubdomain,
        relayProxyRef: this._relay.proxyRef,
        ttydPassword,
      };
      const vmRec = this._epds.createRecord(COMPUTE_VM_NSID, vmRecord);
      const vmUri = vmRec.uri;
      const vmCid = vmRec.cid;
      s.step = 6;

      // Step 6: Create market.rfp record
      advance('Creating market.rfp record');
      const attestEntry = await this._signAttestation(vmRecord, this._kp.did);
      const rfpPayload = {
        $type: RFP_NSID,
        payload: { $type: 'com.atproto.repo.strongRef', uri: vmUri, cid: vmCid },
        submitBid: `https://${s.relaySubdomain}.xrpc.fedproxy.com`,
        policyEngine: s.policyMode,
        ...(s.policyMode === 'dynamic' && s.policyEngineEndpoint ? { policyEngineEndpoint: s.policyEngineEndpoint } : {}),
        signatures: [attestEntry],
      };
      const rfpRec = this._epds.createRecord(RFP_NSID, rfpPayload);
      const rfpUri = rfpRec.uri;
      const rfpCid = rfpRec.cid;
      s.step = 7;

      // Step 7: Discover bidders
      advance('Discovering bidders via market relay');
      let bidderDids = [];
      try {
        const res = await fetch(`${MARKET_RELAY_URL}/xrpc/com.atproto.sync.listReposByCollection?collection=${encodeURIComponent(OFFERING_NSID)}`);
        if (res.ok) {
          const data = await res.json();
          bidderDids = (data.repos || []).map(r => typeof r === 'string' ? r : r.did).filter(Boolean);
        }
      } catch (err) {
        this._addLog('warn', `Discovery warning: ${String(err)}`);
      }
      this._addLog('info', `Found ${bidderDids.length} bidders`);
      s.step = 8;

      // Step 8: Submit RFP to bidders
      advance(`Submitting RFP to ${bidderDids.length} bidders`);
      for (const bidderDid of bidderDids) {
        try {
          const didRes = await fetch(`https://plc.directory/${bidderDid}`);
          if (!didRes.ok) continue;
          const didDoc = await didRes.json();
          const pdsUrl = didDoc.service?.find(sv => sv.type === 'AtprotoPersonalDataServer')?.serviceEndpoint;
          if (!pdsUrl) continue;

          const offeringRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${bidderDid}&collection=${encodeURIComponent(OFFERING_NSID)}`);
          if (!offeringRes.ok) continue;
          const offeringData = await offeringRes.json();
          const offerings = offeringData.records || [];

          for (const off of offerings) {
            const appliesTo = off.value?.appliesTo || [];
            if (appliesTo.length && !appliesTo.includes(COMPUTE_VM_NSID)) continue;
            const endpointUrl = off.value?.endpointUrl;
            if (!endpointUrl) continue;

            const jwt = createServiceAuthJWT({
              privateKeyHex: this._kp.privateKeyHex,
              iss: didPlc,
              aud: `did:web:${new URL(endpointUrl).host}`,
              lxm: SUBMIT_RFP_NSID,
            });
            await fetch(`${endpointUrl}/xrpc/${SUBMIT_RFP_NSID}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ rfpUri, rfpCid }),
            });
            this._addLog('info', `RFP submitted to ${bidderDid}`);
          }
        } catch (err) {
          this._addLog('warn', `Submit to ${bidderDid} failed: ${String(err)}`);
        }
      }
      s.step = 9;

      // Step 9: Collect bids
      advance(`Waiting ${s.bidWindowSec}s for bids...`);
      await new Promise(resolve => setTimeout(resolve, s.bidWindowSec * 1000));
      this._addLog('info', `Collected ${s.bids.length} bids`);
      s.step = 10;

      // Step 10: Accept winner
      if (s.bids.length === 0) {
        throw new Error('No bids received. Try a longer bid window or check bidder availability.');
      }
      const winner = s.bids[0];
      advance(`Accepting bid from ${winner.did}`);

      const acceptAttest = await this._signAttestation(
        { $type: ACCEPT_NSID, rfp: { $type: 'com.atproto.repo.strongRef', uri: rfpUri, cid: rfpCid }, bid: winner.bidRef },
        didPlc,
      );
      const acceptRecord = {
        $type: ACCEPT_NSID,
        rfp: { $type: 'com.atproto.repo.strongRef', uri: rfpUri, cid: rfpCid },
        bid: winner.bidRef,
        submitEvent: `${didPlc}#pdr_temp_compute_event`,
        signatures: [acceptAttest],
      };
      const accRec = this._epds.createRecord(ACCEPT_NSID, acceptRecord);
      const acceptUri = accRec.uri;
      const acceptCid = accRec.cid;

      if (winner.submitAccept) {
        const acceptUrl = winner.submitAccept.startsWith('http') ? winner.submitAccept : `https://${winner.submitAccept.replace(/^did:[^#]+#/, '')}`;
        const jwt = createServiceAuthJWT({
          privateKeyHex: this._kp.privateKeyHex,
          iss: didPlc,
          aud: `did:web:${winner.did || XRPC_DISPATCHER_HOST}`,
          lxm: SUBMIT_ACCEPT_NSID,
        });
        const accRes = await fetch(`${acceptUrl}/xrpc/${SUBMIT_ACCEPT_NSID}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ acceptUri, acceptCid }),
        });
        if (accRes.ok) {
          const receipt = await accRes.json();
          s.flowResult = {
            vmUri, vmCid, rfpUri, rfpCid, acceptUri, acceptCid,
            receiptUri: receipt.uri, receiptCid: receipt.cid,
            winnerDid: winner.did,
            ttydPassword,
            policyMode: s.policyMode,
            submitEventRef: receipt.submitEvent,
          };
          this._addLog('info', `Receipt: ${receipt.uri}`);
        }
      }
      s.step = 11;

      // Step 11: Save VM
      advance('Saving VM');
      s.flowResult = s.flowResult || { vmUri, vmCid, rfpUri, rfpCid, ttydPassword, policyMode: s.policyMode };
      try {
        const saved = JSON.parse(localStorage.getItem('compute-spa-saved-vms') || '[]');
        saved.push({ ...s.flowResult, vmName: s.vmName, role: s.role, createdAt: new Date().toISOString() });
        localStorage.setItem('compute-spa-saved-vms', JSON.stringify(saved));
      } catch {}

      advance('Complete');
      s.phase = 'result';
      this.render();
    } catch (err) {
      this._addLog('error', `Failed: ${String(err)}`);
      s.error = String(err);
      s.phase = 'ready';
      this.render();
    }
  }

  async _signAttestation(record, repositoryDid) {
    try {
      const { Attestation } = await import('@atiproto/atproto-attestation');
      const kp = this._kp;
      if (!kp) throw new Error('No keypair');
      const { fromHex } = await import('compute-spa/constants');
      const priv = fromHex(kp.privateKeyHex);
      const privateKey = { type: 'k256', bytes: priv, toBytes: () => priv };
      const att = new Attestation({ privateKey });
      const entry = await att.sign({ record, repository: repositoryDid || kp.did });
      const sig = entry.signature instanceof Uint8Array ? entry.signature : entry.signature;
      let bin = '';
      for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
      return { $type: entry.$type, key: entry.key, cid: entry.cid, signature: { $bytes: btoa(bin) } };
    } catch {
      return { $type: 'network.attested.signature', key: this._kp?.did || '', cid: '', signature: { $bytes: '' } };
    }
  }
}

if (!customElements.get('swc-request-compute')) {
  customElements.define('swc-request-compute', SwcRequestCompute);
}
