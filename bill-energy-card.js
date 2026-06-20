/*
  Bill Energy Card v1.0.0
  Custom Lovelace card สำหรับ Home Assistant
  เปรียบเทียบพลังงานและค่าไฟฟ้าจาก 2 เซ็นเซอร์ (กริด vs โหลด)
  คำนวณค่าไฟตามอัตรา PEA (Ft adjustment, ค่าบริการ, VAT) ที่ปรับตั้งค่าได้
  รองรับ palette สี: solar / modern / pea / custom
*/

const DEFAULT_CONFIG = {
  title: 'Bill Energy Card',
  grid_entity: '',
  load_entity: '',
  ft_adjustment: 0.1623,
  service_charge: 24.62,
  vat_percent: 7,
  tier1_rate: 3.2484,
  tier1_limit: 150,
  tier2_rate: 4.2218,
  tier2_limit: 400,
  tier3_rate: 4.4217,
  palette: 'solar',
  grid_color: '#378ADD',
  load_color: '#1D9E75',
  default_period: 'daily',
  daily_days: 7,
  monthly_months: 6
};

const PALETTES = {
  solar: { grid: '#378ADD', load: '#1D9E75' },
  modern: { grid: '#085041', load: '#5DCAA5' },
  pea: { grid: '#534AB7', load: '#EF9F27' }
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function shade(hex, amt) {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function fmtBaht(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKwh(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

class BillEnergyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._period = 'daily';
    this._built = false;
  }

  setConfig(config) {
    this._config = Object.assign({}, DEFAULT_CONFIG, config || {});
    this._period = this._config.default_period === 'monthly' ? 'monthly' : 'daily';
    this._buildShell();
    if (this._hass) this._updateView();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first || !this._built) this._updateView();
  }

  getCardSize() {
    return 7;
  }

  static getStubConfig() {
    return Object.assign({ type: 'custom:bill-energy-card' }, DEFAULT_CONFIG);
  }

  static getConfigElement() {
    return document.createElement('bill-energy-card-editor');
  }

  _getColors() {
    const c = this._config;
    if (c.palette === 'custom') return { grid: c.grid_color, load: c.load_color };
    return PALETTES[c.palette] || PALETTES.solar;
  }

  _tieredEnergy(units) {
    const c = this._config;
    if (units <= c.tier1_limit) return units * c.tier1_rate;
    if (units <= c.tier2_limit) {
      return c.tier1_limit * c.tier1_rate + (units - c.tier1_limit) * c.tier2_rate;
    }
    return (
      c.tier1_limit * c.tier1_rate +
      (c.tier2_limit - c.tier1_limit) * c.tier2_rate +
      (units - c.tier2_limit) * c.tier3_rate
    );
  }

  _calcCost(units, days) {
    const c = this._config;
    units = Math.max(0, units || 0);
    const energy = this._tieredEnergy(units);
    const ft = units * c.ft_adjustment;
    const service = c.service_charge * (days / 30);
    const subtotal = energy + ft + service;
    const vat = subtotal * (c.vat_percent / 100);
    return { units, energy, ft, service, vat, total: subtotal + vat };
  }

  _buildShell() {
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .bec-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
        .bec-title { font-size:16px; font-weight:500; color:var(--primary-text-color); display:flex; align-items:center; gap:6px; }
        .bec-controls { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
        .bec-controls select, .bec-controls button {
          border:1px solid var(--divider-color); border-radius:8px; padding:4px 10px; font-size:12px;
          background:var(--card-background-color); color:var(--primary-text-color); cursor:pointer;
        }
        .bec-controls button.active { background:var(--primary-color); color:var(--text-primary-color,#fff); border-color:var(--primary-color); }
        .bec-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
        .bec-metric { background:var(--secondary-background-color, rgba(127,127,127,0.08)); border-radius:8px; padding:10px 12px; }
        .bec-metric.saved { background: rgba(76,175,80,0.14); }
        .bec-mlabel { font-size:12px; color:var(--secondary-text-color); margin-bottom:4px; display:flex; align-items:center; gap:4px; }
        .bec-mvalue { font-size:18px; font-weight:500; color:var(--primary-text-color); }
        .bec-metric.saved .bec-mvalue { color:var(--success-color, #4caf50); }
        .bec-msub { font-size:12px; color:var(--secondary-text-color); margin-top:2px; }
        .bec-legend { display:flex; gap:14px; font-size:11px; color:var(--secondary-text-color); margin-bottom:4px; }
        .bec-swatch { width:10px; height:10px; border-radius:2px; display:inline-block; margin-right:4px; vertical-align:middle; }
        .bec-chartwrap { width:100%; margin-bottom:12px; }
        .bec-chartwrap svg { width:100%; height:auto; display:block; }
        .bec-breakdown { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; }
        .bec-bdcol { border:1px solid var(--divider-color); border-radius:8px; padding:8px 10px; }
        .bec-bdtitle { font-size:12px; font-weight:500; margin-bottom:6px; color:var(--primary-text-color); }
        .bec-bdrow { display:flex; justify-content:space-between; font-size:12px; color:var(--secondary-text-color); padding:2px 0; }
        .bec-bdrow.total { border-top:1px solid var(--divider-color); margin-top:4px; padding-top:4px; font-weight:500; color:var(--primary-text-color); }
        .bec-settings { display:flex; flex-wrap:wrap; gap:10px; align-items:center; border-top:1px solid var(--divider-color); padding-top:10px; font-size:12px; color:var(--secondary-text-color); }
        .bec-settings label { display:flex; align-items:center; gap:4px; }
        .bec-settings input { border:1px solid var(--divider-color); border-radius:6px; padding:3px 6px; font-size:12px; width:68px; background:var(--card-background-color); color:var(--primary-text-color); }
        .bec-msg { padding:20px 4px; text-align:center; color:var(--secondary-text-color); font-size:13px; }
      </style>
      <ha-card>
        <div class="bec-body">
          <div class="bec-header">
            <div class="bec-title"><ha-icon icon="mdi:flash"></ha-icon>${this._config.title}</div>
            <div class="bec-controls">
              <select class="bec-palette">
                <option value="solar">Solar</option>
                <option value="modern">Modern</option>
                <option value="pea">PEA</option>
                <option value="custom">กำหนดเอง</option>
              </select>
              <button class="bec-period-btn" data-period="daily">รายวัน</button>
              <button class="bec-period-btn" data-period="monthly">รายเดือน</button>
            </div>
          </div>
          <div class="bec-content"></div>
        </div>
      </ha-card>
    `;
    this._built = true;
    root.querySelector('.bec-palette').value = this._config.palette;
    root.querySelector('.bec-palette').addEventListener('change', (e) => {
      this._config.palette = e.target.value;
      this._updateView();
    });
    root.querySelectorAll('.bec-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._period = btn.dataset.period;
        this._updateView();
      });
    });
  }

  _showMessage(text) {
    const content = this.shadowRoot.querySelector('.bec-content');
    if (content) content.innerHTML = '<div class="bec-msg">' + text + '</div>';
  }

  async _fetchSeries(entityId, period, count) {
    if (!entityId || !this._hass) return [];
    const now = new Date();
    let start;
    if (period === 'daily') {
      start = new Date(now);
      start.setDate(start.getDate() - count);
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - count, 1);
    }
    try {
      const result = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        end_time: now.toISOString(),
        statistic_ids: [entityId],
        period: period === 'daily' ? 'day' : 'month',
        types: ['sum']
      });
      const rows = (result && result[entityId]) || [];
      const out = [];
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i].sum;
        const b = rows[i - 1].sum;
        if (a == null || b == null) continue;
        out.push({ start: rows[i].start, value: Math.max(0, a - b) });
      }
      if (out.length > 0) return out.slice(-count);
      return await this._fetchHistoryFallback(entityId, count);
    } catch (e) {
      return await this._fetchHistoryFallback(entityId, count);
    }
  }

  async _fetchHistoryFallback(entityId, count) {
    try {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - count - 1);
      const path =
        'history/period/' +
        start.toISOString() +
        '?filter_entity_id=' +
        entityId +
        '&end_time=' +
        now.toISOString() +
        '&minimal_response';
      const history = await this._hass.callApi('GET', path);
      const states = (history && history[0]) || [];
      const byDay = {};
      states.forEach((s) => {
        const day = s.last_changed.slice(0, 10);
        const val = parseFloat(s.state);
        if (!isNaN(val)) byDay[day] = val;
      });
      const days = Object.keys(byDay).sort();
      const out = [];
      for (let i = 1; i < days.length; i++) {
        out.push({ start: days[i], value: Math.max(0, byDay[days[i]] - byDay[days[i - 1]]) });
      }
      return out.slice(-count);
    } catch (e) {
      return [];
    }
  }

  _formatLabel(isoStart, period) {
    const d = new Date(isoStart);
    if (period === 'daily') return d.getDate() + ' ' + THAI_MONTHS[d.getMonth()];
    return THAI_MONTHS[d.getMonth()];
  }

  async _updateView() {
    if (!this._built) this._buildShell();
    if (!this._hass) return;
    this.shadowRoot.querySelectorAll('.bec-period-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === this._period);
    });
    const c = this._config;
    if (!c.grid_entity || !c.load_entity) {
      this._showMessage('กรุณาตั้งค่า grid_entity และ load_entity ในการตั้งค่าการ์ด (แก้ไขการ์ด → ระบุเซ็นเซอร์)');
      return;
    }
    if (!this._hass.states[c.grid_entity] || !this._hass.states[c.load_entity]) {
      this._showMessage('ไม่พบเซ็นเซอร์ที่ระบุไว้ ตรวจสอบ entity id อีกครั้ง');
      return;
    }
    this._showMessage('กำลังโหลดข้อมูล...');
    const count = this._period === 'daily' ? c.daily_days : c.monthly_months;
    const [gridSeries, loadSeries] = await Promise.all([
      this._fetchSeries(c.grid_entity, this._period, count),
      this._fetchSeries(c.load_entity, this._period, count)
    ]);
    const n = Math.max(gridSeries.length, loadSeries.length);
    if (n === 0) {
      this._showMessage('ยังไม่มีข้อมูลพอสำหรับช่วงเวลานี้ (ต้องมีประวัติ statistics อย่างน้อย 2 ช่วง)');
      return;
    }
    const labels = [];
    const gridVals = [];
    const loadVals = [];
    for (let i = 0; i < n; i++) {
      const g = gridSeries[i];
      const l = loadSeries[i];
      const ref = g || l;
      labels.push(this._formatLabel(ref.start, this._period));
      gridVals.push(g ? g.value : 0);
      loadVals.push(l ? l.value : 0);
    }
    this._renderData(labels, gridVals, loadVals);
  }

  _renderData(labels, gridVals, loadVals) {
    const c = this._config;
    const colors = this._getColors();
    const bucketDays = this._period === 'daily' ? 1 : 30;
    const totalDays = this._period === 'daily' ? labels.length : c.monthly_months * 30;
    const gridTotal = gridVals.reduce((s, v) => s + v, 0);
    const loadTotal = loadVals.reduce((s, v) => s + v, 0);
    const gridCost = this._calcCost(gridTotal, totalDays);
    const loadCost = this._calcCost(loadTotal, totalDays);
    const saved = loadCost.total - gridCost.total;
    const savedPct = loadCost.total > 0 ? (saved / loadCost.total) * 100 : 0;

    const content = this.shadowRoot.querySelector('.bec-content');
    content.innerHTML = `
      <div class="bec-metrics">
        <div class="bec-metric">
          <div class="bec-mlabel"><ha-icon icon="mdi:transmission-tower"></ha-icon>จากกริด</div>
          <div class="bec-mvalue">${fmtKwh(gridTotal)} kWh</div>
          <div class="bec-msub">${fmtBaht(gridCost.total)} บาท</div>
        </div>
        <div class="bec-metric">
          <div class="bec-mlabel"><ha-icon icon="mdi:home-lightning-bolt"></ha-icon>โหลดรวม</div>
          <div class="bec-mvalue">${fmtKwh(loadTotal)} kWh</div>
          <div class="bec-msub">${fmtBaht(loadCost.total)} บาท</div>
        </div>
        <div class="bec-metric saved">
          <div class="bec-mlabel"><ha-icon icon="mdi:leaf"></ha-icon>ประหยัดได้</div>
          <div class="bec-mvalue">${fmtBaht(saved)} บาท</div>
          <div class="bec-msub">${savedPct.toFixed(1)}% ของค่าไฟเทียบเท่า</div>
        </div>
      </div>
      <div class="bec-legend">
        <span><span class="bec-swatch" style="background:${colors.grid}"></span>จากกริด</span>
        <span><span class="bec-swatch" style="background:${colors.load}"></span>โหลดรวม</span>
      </div>
      <div class="bec-chartwrap">${this._buildChartSVG(labels, gridVals, loadVals, bucketDays, colors)}</div>
      <div class="bec-breakdown">
        <div class="bec-bdcol">
          <div class="bec-bdtitle">รายละเอียด: กริด</div>
          ${this._buildBreakdownHTML(gridCost)}
        </div>
        <div class="bec-bdcol">
          <div class="bec-bdtitle">รายละเอียด: โหลด</div>
          ${this._buildBreakdownHTML(loadCost)}
        </div>
      </div>
      <div class="bec-settings">
        <ha-icon icon="mdi:cog-outline"></ha-icon>
        <label>Ft <input type="number" step="0.0001" class="bec-set-ft" value="${c.ft_adjustment}"></label>
        <label>ค่าบริการ <input type="number" step="0.01" class="bec-set-service" value="${c.service_charge}"></label>
        <label>VAT % <input type="number" step="0.1" class="bec-set-vat" value="${c.vat_percent}"></label>
      </div>
    `;
    content.querySelector('.bec-set-ft').addEventListener('change', (e) => {
      c.ft_adjustment = parseFloat(e.target.value) || 0;
      this._renderData(labels, gridVals, loadVals);
    });
    content.querySelector('.bec-set-service').addEventListener('change', (e) => {
      c.service_charge = parseFloat(e.target.value) || 0;
      this._renderData(labels, gridVals, loadVals);
    });
    content.querySelector('.bec-set-vat').addEventListener('change', (e) => {
      c.vat_percent = parseFloat(e.target.value) || 0;
      this._renderData(labels, gridVals, loadVals);
    });
  }

  _buildBreakdownHTML(cost) {
    return (
      '<div class="bec-bdrow"><span>หน่วยที่ใช้</span><span>' + fmtKwh(cost.units) + ' หน่วย</span></div>' +
      '<div class="bec-bdrow"><span>ค่าพลังงาน</span><span>' + fmtBaht(cost.energy) + ' บาท</span></div>' +
      '<div class="bec-bdrow"><span>Ft</span><span>' + fmtBaht(cost.ft) + ' บาท</span></div>' +
      '<div class="bec-bdrow"><span>ค่าบริการ</span><span>' + fmtBaht(cost.service) + ' บาท</span></div>' +
      '<div class="bec-bdrow"><span>VAT</span><span>' + fmtBaht(cost.vat) + ' บาท</span></div>' +
      '<div class="bec-bdrow total"><span>รวม</span><span>' + fmtBaht(cost.total) + ' บาท</span></div>'
    );
  }

  _buildChartSVG(labels, gridVals, loadVals, bucketDays, colors) {
    const W = 640;
    const H = 260;
    const marginLeft = 8;
    const marginRight = 8;
    const marginTop = 30;
    const marginBottom = 24;
    const chartW = W - marginLeft - marginRight;
    const chartH = H - marginTop - marginBottom;
    const n = Math.max(1, labels.length);
    const maxRaw = Math.max(1, ...gridVals, ...loadVals);
    const maxVal = maxRaw * 1.3;
    const groupW = chartW / n;
    const barW = Math.min(26, groupW * 0.32);
    const gap = 4;
    const labelStep = n > 12 ? 3 : n > 8 ? 2 : 1;

    let bars = '';
    let xLabels = '';
    const baseline =
      '<line x1="' + marginLeft + '" y1="' + (marginTop + chartH) + '" x2="' + (W - marginRight) +
      '" y2="' + (marginTop + chartH) + '" stroke="var(--divider-color)" stroke-width="1"/>';

    for (let i = 0; i < n; i++) {
      const cx = marginLeft + i * groupW + groupW / 2;
      const gx = cx - barW - gap / 2;
      const lx = cx + gap / 2;
      const gv = gridVals[i] || 0;
      const lv = loadVals[i] || 0;
      const gh = (gv / maxVal) * chartH;
      const lh = (lv / maxVal) * chartH;
      const gy = marginTop + chartH - gh;
      const ly = marginTop + chartH - lh;
      bars +=
        '<rect x="' + gx.toFixed(1) + '" y="' + gy.toFixed(1) + '" width="' + barW.toFixed(1) +
        '" height="' + gh.toFixed(1) + '" rx="2" fill="' + colors.grid + '"/>';
      bars +=
        '<rect x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" width="' + barW.toFixed(1) +
        '" height="' + lh.toFixed(1) + '" rx="2" fill="' + colors.load + '"/>';

      if (i % labelStep === 0) {
        const gCost = this._calcCost(gv, bucketDays).total;
        const lCost = this._calcCost(lv, bucketDays).total;
        bars +=
          '<text x="' + (gx + barW / 2).toFixed(1) + '" y="' + Math.max(10, gy - 4).toFixed(1) +
          '" font-size="9" text-anchor="middle" fill="' + shade(colors.grid, -70) + '">' +
          Math.round(gCost) + '฿</text>';
        bars +=
          '<text x="' + (lx + barW / 2).toFixed(1) + '" y="' + Math.max(10, ly - 4).toFixed(1) +
          '" font-size="9" text-anchor="middle" fill="' + shade(colors.load, -70) + '">' +
          Math.round(lCost) + '฿</text>';
        xLabels +=
          '<text x="' + cx.toFixed(1) + '" y="' + (H - 6) +
          '" font-size="9" text-anchor="middle" fill="var(--secondary-text-color)">' + labels[i] + '</text>';
      }
    }

    return (
      '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="กราฟเปรียบเทียบหน่วยและค่าไฟฟ้าจากกริดและโหลด">' +
      baseline + bars + xLabels + '</svg>'
    );
  }
}

class BillEnergyCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, DEFAULT_CONFIG, config || {});
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._gridPicker) this._gridPicker.hass = hass;
    if (this._loadPicker) this._loadPicker.hass = hass;
  }

  _emitChange(newConfig) {
    this._config = newConfig;
    const event = new Event('config-changed', { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  _field(label, key, type, step) {
    const v = this._config[key];
    return (
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">' +
      '<label style="font-size:13px;color:var(--primary-text-color);">' + label + '</label>' +
      '<input data-key="' + key + '" type="' + type + '"' +
      (step ? ' step="' + step + '"' : '') +
      ' value="' + v + '" style="border:1px solid var(--divider-color);border-radius:6px;padding:4px 6px;font-size:13px;width:160px;background:var(--card-background-color);color:var(--primary-text-color);"/>' +
      '</div>'
    );
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const c = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        .card-config { padding: 8px 4px; }
        .section-title { font-size:13px; font-weight:500; margin:10px 0 2px; color:var(--primary-text-color); }
        select { border:1px solid var(--divider-color); border-radius:6px; padding:4px 6px; font-size:13px; width:166px; background:var(--card-background-color); color:var(--primary-text-color); }
        input[type="color"] { width:48px; height:28px; border:1px solid var(--divider-color); border-radius:6px; padding:0; }
      </style>
      <div class="card-config">
        <div class="section-title">เซ็นเซอร์</div>
        ${this._field('ชื่อการ์ด', 'title', 'text')}
        <div id="grid-entity-slot" style="margin:6px 0;"></div>
        <div id="load-entity-slot" style="margin:6px 0;"></div>

        <div class="section-title">อัตราค่าไฟ (ปรับได้ตามประกาศ กกพ.)</div>
        ${this._field('Ft adjustment (บาท/หน่วย)', 'ft_adjustment', 'number', '0.0001')}
        ${this._field('ค่าบริการ (บาท/เดือน)', 'service_charge', 'number', '0.01')}
        ${this._field('VAT (%)', 'vat_percent', 'number', '0.1')}
        ${this._field('Tier1 rate (≤ tier1_limit)', 'tier1_rate', 'number', '0.0001')}
        ${this._field('Tier1 limit (หน่วย)', 'tier1_limit', 'number', '1')}
        ${this._field('Tier2 rate', 'tier2_rate', 'number', '0.0001')}
        ${this._field('Tier2 limit (หน่วย)', 'tier2_limit', 'number', '1')}
        ${this._field('Tier3 rate (เกิน tier2_limit)', 'tier3_rate', 'number', '0.0001')}

        <div class="section-title">รูปแบบสี</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
          <label style="font-size:13px;color:var(--primary-text-color);">Palette</label>
          <select id="palette-select">
            <option value="solar">Solar</option>
            <option value="modern">Modern</option>
            <option value="pea">PEA</option>
            <option value="custom">กำหนดเอง</option>
          </select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
          <label style="font-size:13px;color:var(--primary-text-color);">สีกริด</label>
          <input id="grid-color" type="color" value="${c.grid_color}"/>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
          <label style="font-size:13px;color:var(--primary-text-color);">สีโหลด</label>
          <input id="load-color" type="color" value="${c.load_color}"/>
        </div>

        <div class="section-title">มุมมองเริ่มต้น</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;">
          <label style="font-size:13px;color:var(--primary-text-color);">Default period</label>
          <select id="period-select">
            <option value="daily">รายวัน</option>
            <option value="monthly">รายเดือน</option>
          </select>
        </div>
      </div>
    `;
    this.shadowRoot.querySelector('#palette-select').value = c.palette;
    this.shadowRoot.querySelector('#period-select').value = c.default_period;

    this._gridPicker = document.createElement('ha-entity-picker');
    this._gridPicker.hass = this._hass;
    this._gridPicker.value = c.grid_entity || '';
    this._gridPicker.label = 'Grid entity (เซ็นเซอร์พลังงานจากกริด)';
    this._gridPicker.allowCustomEntity = true;
    this._gridPicker.style.display = 'block';
    this._gridPicker.style.width = '100%';
    this._gridPicker.addEventListener('value-changed', (e) => {
      e.stopPropagation();
      const newConfig = Object.assign({}, this._config, { grid_entity: e.detail.value || '' });
      this._emitChange(newConfig);
    });
    this.shadowRoot.querySelector('#grid-entity-slot').appendChild(this._gridPicker);

    this._loadPicker = document.createElement('ha-entity-picker');
    this._loadPicker.hass = this._hass;
    this._loadPicker.value = c.load_entity || '';
    this._loadPicker.label = 'Load entity (เซ็นเซอร์พลังงานโหลดรวม)';
    this._loadPicker.allowCustomEntity = true;
    this._loadPicker.style.display = 'block';
    this._loadPicker.style.width = '100%';
    this._loadPicker.addEventListener('value-changed', (e) => {
      e.stopPropagation();
      const newConfig = Object.assign({}, this._config, { load_entity: e.detail.value || '' });
      this._emitChange(newConfig);
    });
    this.shadowRoot.querySelector('#load-entity-slot').appendChild(this._loadPicker);

    this.shadowRoot.querySelectorAll('input[data-key]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.key;
        const newConfig = Object.assign({}, this._config);
        newConfig[key] = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
        this._emitChange(newConfig);
      });
    });
    this.shadowRoot.querySelector('#palette-select').addEventListener('change', (e) => {
      const newConfig = Object.assign({}, this._config, { palette: e.target.value });
      this._emitChange(newConfig);
    });
    this.shadowRoot.querySelector('#period-select').addEventListener('change', (e) => {
      const newConfig = Object.assign({}, this._config, { default_period: e.target.value });
      this._emitChange(newConfig);
    });
    this.shadowRoot.querySelector('#grid-color').addEventListener('change', (e) => {
      const newConfig = Object.assign({}, this._config, { grid_color: e.target.value, palette: 'custom' });
      this.shadowRoot.querySelector('#palette-select').value = 'custom';
      this._emitChange(newConfig);
    });
    this.shadowRoot.querySelector('#load-color').addEventListener('change', (e) => {
      const newConfig = Object.assign({}, this._config, { load_color: e.target.value, palette: 'custom' });
      this.shadowRoot.querySelector('#palette-select').value = 'custom';
      this._emitChange(newConfig);
    });
  }
}

customElements.define('bill-energy-card', BillEnergyCard);
customElements.define('bill-energy-card-editor', BillEnergyCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'bill-energy-card',
  name: 'Bill Energy Card',
  description: 'เปรียบเทียบพลังงานและค่าไฟฟ้าจาก 2 เซ็นเซอร์ (กริด vs โหลด) พร้อมคำนวณ Ft/ค่าบริการ/VAT ที่ปรับตั้งค่าได้',
  preview: true
});
