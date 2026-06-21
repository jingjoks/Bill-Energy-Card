/*
  Bill Energy Card v2.2.0
  Custom Lovelace card for Home Assistant
  เปรียบเทียบพลังงานและค่าไฟฟ้าจาก 2 เซ็นเซอร์ (กริด vs โหลด) / Compare energy & cost from 2 sensors (grid vs load)
  คำนวณค่าไฟตามอัตรา PEA (Ft adjustment, ค่าบริการ, VAT) ที่ปรับตั้งค่าได้ / Configurable PEA rate calculation

  *** ใหม่ใน v2.2.0: รวม Live Meter เข้ามาในการ์ดเดียว (ไม่บังคับ) ***
  ส่วนบน (ไม่บังคับ) — ใส่ grid_power_entity/load_power_entity (และ voltage/current ไม่บังคับ)
  จะโชว์: % ใช้จากโซลาร์ตอนนี้, กำลังไฟ/แรงดัน/กระแสแบบเรียลไทม์, กราฟเส้นกำลังไฟ (kW) ย้อนหลัง
  ส่วนล่าง "ค่าไฟตามจริง" คือของเดิม (รอบบิล/กราฟแท่ง/รายละเอียด/ตั้งค่า) ไม่กระทบของเดิมถ้าไม่ตั้งค่าเซ็นเซอร์เรียลไทม์

  เลิกใช้ grid_entity/load_entity + billing_cycle_day (คำนวณรอบบิลจาก HA statistics เอง)
  เปลี่ยนเป็นอ่านจาก 4 sensor ที่ผู้ใช้ reset ค่าเองตรงเวลาจริง (เช่นผ่าน Node-RED หรือ Utility Meter + Automation):
    grid_entity_daily / load_entity_daily  — reset ทุกเที่ยงคืน
    grid_entity_cycle / load_entity_cycle  — reset ตรงเวลาที่ PEA ตัดรอบบิลจริง
  การ์ดตรวจจับรอบจากค่าที่ "ตกลงกะทันหัน" ใน LTS hourly statistics ของ sensor นั้นๆ เอง
  ไม่ต้องรู้วัน/เวลาตัดรอบล่วงหน้าอีกต่อไป

  รองรับ palette สี: solar / modern / pea / custom
  รองรับภาษา: th (ไทย) / en (English)
*/

const DEFAULT_CONFIG = {
  title: 'Bill Energy Card',
  language: 'th',
  grid_entity_daily: '',
  load_entity_daily: '',
  grid_entity_cycle: '',
  load_entity_cycle: '',
  grid_power_entity: '',
  load_power_entity: '',
  grid_voltage_entity: '',
  load_voltage_entity: '',
  grid_current_entity: '',
  load_current_entity: '',
  live_sparkline_hours: 6,
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
  cycle_count: 6,
  cutoff_day_entity: '',
  cutoff_hour_entity: ''
};

const PALETTES = {
  solar: { grid: '#378ADD', load: '#1D9E75' },
  modern: { grid: '#085041', load: '#5DCAA5' },
  pea: { grid: '#534AB7', load: '#EF9F27' }
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STRINGS = {
  th: {
    daily: 'รายวัน',
    monthly: 'รายเดือน',
    gridShort: 'กริด',
    loadShort: 'โหลด',
    savedShort: 'ประหยัด',
    fromGrid: 'จากกริด',
    totalLoad: 'โหลดรวม',
    equivalentSuffix: '% เทียบเท่า',
    detailGrid: 'รายละเอียด: กริด',
    detailLoad: 'รายละเอียด: โหลด',
    unitsUsed: 'หน่วยที่ใช้',
    unitsWord: 'หน่วย',
    energyCost: 'ค่าพลังงาน',
    ftWord: 'Ft',
    serviceCharge: 'ค่าบริการ',
    vatWord: 'VAT',
    totalWord: 'รวม',
    currencyWord: 'บาท',
    ftSettingLabel: 'Ft (บาท/หน่วย)',
    serviceSettingLabel: 'ค่าบริการ (บาท/เดือน)',
    vatSettingLabel: 'VAT (%)',
    secCutoff: 'การตั้งค่ารอบบิล (ตัวเลือก)',
    fieldCutoffDayEntity: 'Entity วันตัดรอบ (input_number)',
    fieldCutoffHourEntity: 'Entity ชั่วโมงตัดรอบ (input_number)',
    cutoffDaySettingLabel: 'วันตัดรอบ',
    cutoffHourSettingLabel: 'ชั่วโมงตัดรอบ',
    msgConfigMissing: 'กรุณาตั้งค่าเซ็นเซอร์ในการตั้งค่าการ์ดให้ครบ (แก้ไขการ์ด → ระบุเซ็นเซอร์ของมุมมองที่ใช้อยู่)',
    msgEntityNotFound: 'ไม่พบเซ็นเซอร์ที่ระบุไว้ ตรวจสอบ entity id อีกครั้ง',
    msgLoading: 'กำลังโหลดข้อมูล...',
    msgNoData: 'ยังไม่พบรอบที่ตัดเสร็จในประวัติของเซ็นเซอร์ (เซ็นเซอร์ต้อง reset ค่าเองอย่างน้อย 1 ครั้งถึงจะเริ่มมีข้อมูลให้แสดง)',
    paletteSolar: 'โซลาร์',
    paletteModern: 'มรกต',
    paletteCustom: 'กำหนดเอง',
    secSensors: 'เซ็นเซอร์รายวัน',
    secSensorsCycle: 'เซ็นเซอร์รอบบิล',
    fieldCardTitle: 'ชื่อการ์ด',
    gridDailyPickerLabel: 'เซ็นเซอร์รายวัน: พลังงานจากกริด (reset เที่ยงคืน)',
    loadDailyPickerLabel: 'เซ็นเซอร์รายวัน: พลังงานโหลดรวม (reset เที่ยงคืน)',
    gridCyclePickerLabel: 'เซ็นเซอร์รอบบิล: พลังงานจากกริด (reset ตามรอบบิล)',
    loadCyclePickerLabel: 'เซ็นเซอร์รอบบิล: พลังงานโหลดรวม (reset ตามรอบบิล)',
    secRates: 'อัตราค่าไฟ (ปรับได้ตามประกาศ กกพ.)',
    fieldFt: 'ค่า Ft (บาท/หน่วย)',
    fieldService: 'ค่าบริการ (บาท/เดือน)',
    fieldVat: 'ภาษีมูลค่าเพิ่ม VAT (%)',
    fieldTier1Rate: 'อัตราค่าไฟ ขั้นที่ 1 (บาท/หน่วย)',
    fieldTier1Limit: 'เพดานหน่วย ขั้นที่ 1 (หน่วย)',
    fieldTier2Rate: 'อัตราค่าไฟ ขั้นที่ 2 (บาท/หน่วย)',
    fieldTier2Limit: 'เพดานหน่วย ขั้นที่ 2 (หน่วย)',
    fieldTier3Rate: 'อัตราค่าไฟ ขั้นที่ 3 (เกินเพดานขั้น 2)',
    secColor: 'โทนสี',
    fieldPaletteLabel: 'โทนสี',
    paletteOptSolar: 'โซลาร์ (ฟ้า-เขียว)',
    paletteOptModern: 'มรกต (เขียวเข้ม)',
    paletteOptPea: 'PEA (ม่วง-ทอง)',
    paletteOptCustom: 'กำหนดเอง',
    fieldGridColor: 'สีกริด',
    fieldLoadColor: 'สีโหลด',
    secDefaultView: 'มุมมองเริ่มต้น',
    fieldPeriodLabel: 'ช่วงเวลาเริ่มต้น',
    periodOptDaily: 'รายวัน',
    periodOptMonthly: 'รายเดือน',
    secLanguage: 'ภาษา',
    fieldLanguageLabel: 'ภาษา',
    liveWord: 'LIVE',
    solarNowLabel: 'ใช้จากโซลาร์ตอนนี้',
    voltageLabel: 'แรงดัน',
    currentLabel: 'กระแส',
    liveChartTitle: 'กำลังไฟย้อนหลัง',
    hoursWord: 'ชม.',
    costSectionTitle: 'ค่าไฟตามจริง',
    secLiveSensors: 'เซ็นเซอร์เรียลไทม์ (ไม่บังคับ)',
    fieldGridPowerEntity: 'เซ็นเซอร์: กำลังไฟกริด (W)',
    fieldLoadPowerEntity: 'เซ็นเซอร์: กำลังไฟโหลด (W)',
    fieldGridVoltageEntity: 'เซ็นเซอร์: แรงดันกริด (V) (ไม่บังคับ)',
    fieldLoadVoltageEntity: 'เซ็นเซอร์: แรงดันโหลด (V) (ไม่บังคับ)',
    fieldGridCurrentEntity: 'เซ็นเซอร์: กระแสกริด (A) (ไม่บังคับ)',
    fieldLoadCurrentEntity: 'เซ็นเซอร์: กระแสโหลด (A) (ไม่บังคับ)',
    fieldLiveSparklineHours: 'จำนวนชั่วโมงย้อนหลัง (กราฟกำลังไฟ)'
  },
  en: {
    daily: 'Daily',
    monthly: 'Monthly',
    gridShort: 'Grid',
    loadShort: 'Load',
    savedShort: 'Saved',
    fromGrid: 'From grid',
    totalLoad: 'Total load',
    equivalentSuffix: '% of equivalent bill',
    detailGrid: 'Details: Grid',
    detailLoad: 'Details: Load',
    unitsUsed: 'Units used',
    unitsWord: 'units',
    energyCost: 'Energy cost',
    ftWord: 'Ft',
    serviceCharge: 'Service charge',
    vatWord: 'VAT',
    totalWord: 'Total',
    currencyWord: 'THB',
    ftSettingLabel: 'Ft (THB/unit)',
    serviceSettingLabel: 'Service charge (THB/month)',
    vatSettingLabel: 'VAT (%)',
    secCutoff: 'Billing cycle settings (optional)',
    fieldCutoffDayEntity: 'Cutoff day entity (input_number)',
    fieldCutoffHourEntity: 'Cutoff hour entity (input_number)',
    cutoffDaySettingLabel: 'Cutoff day',
    cutoffHourSettingLabel: 'Cutoff hour',
    msgConfigMissing: 'Please configure the sensors needed for this view in the card settings (Edit card -> set sensors)',
    msgEntityNotFound: 'Sensor not found. Please check the entity id.',
    msgLoading: 'Loading data...',
    msgNoData: "No completed cycles found yet in this sensor's history (the sensor needs to reset at least once before data appears)",
    paletteSolar: 'Solar',
    paletteModern: 'Emerald',
    paletteCustom: 'Custom',
    secSensors: 'Daily sensors',
    secSensorsCycle: 'Billing cycle sensors',
    fieldCardTitle: 'Card title',
    gridDailyPickerLabel: 'Daily sensor: grid energy (resets at midnight)',
    loadDailyPickerLabel: 'Daily sensor: total load energy (resets at midnight)',
    gridCyclePickerLabel: 'Cycle sensor: grid energy (resets on your billing cycle)',
    loadCyclePickerLabel: 'Cycle sensor: total load energy (resets on your billing cycle)',
    secRates: 'Electricity rates (adjustable per regulator announcements)',
    fieldFt: 'Ft adjustment (THB/unit)',
    fieldService: 'Service charge (THB/month)',
    fieldVat: 'VAT (%)',
    fieldTier1Rate: 'Tier 1 rate (THB/unit)',
    fieldTier1Limit: 'Tier 1 limit (units)',
    fieldTier2Rate: 'Tier 2 rate (THB/unit)',
    fieldTier2Limit: 'Tier 2 limit (units)',
    fieldTier3Rate: 'Tier 3 rate (above tier 2 limit)',
    secColor: 'Color theme',
    fieldPaletteLabel: 'Color theme',
    paletteOptSolar: 'Solar (blue-green)',
    paletteOptModern: 'Emerald (dark green)',
    paletteOptPea: 'PEA (purple-gold)',
    paletteOptCustom: 'Custom',
    fieldGridColor: 'Grid color',
    fieldLoadColor: 'Load color',
    secDefaultView: 'Default view',
    fieldPeriodLabel: 'Default period',
    periodOptDaily: 'Daily',
    periodOptMonthly: 'Monthly',
    secLanguage: 'Language',
    fieldLanguageLabel: 'Language',
    liveWord: 'LIVE',
    solarNowLabel: 'Solar self-use now',
    voltageLabel: 'Voltage',
    currentLabel: 'Current',
    liveChartTitle: 'Power - last',
    hoursWord: 'h',
    costSectionTitle: 'Actual cost',
    secLiveSensors: 'Live sensors (optional)',
    fieldGridPowerEntity: 'Sensor: grid power (W)',
    fieldLoadPowerEntity: 'Sensor: load power (W)',
    fieldGridVoltageEntity: 'Sensor: grid voltage (V) (optional)',
    fieldLoadVoltageEntity: 'Sensor: load voltage (V) (optional)',
    fieldGridCurrentEntity: 'Sensor: grid current (A) (optional)',
    fieldLoadCurrentEntity: 'Sensor: load current (A) (optional)',
    fieldLiveSparklineHours: 'Hours of history (power chart)'
  }
};

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

function tint(hex, alpha) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function fmtBaht(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKwh(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
    if (this._hass) {
      this._updateView();
      this._updateLiveMeter(true);
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first || !this._built) this._updateView();
    this._updateLiveMeter(first);
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

  _t(key) {
    const lang = (this._config && this._config.language === 'en') ? 'en' : 'th';
    return STRINGS[lang][key] || key;
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
    const t = (k) => this._t(k);
    root.innerHTML = `
      <style>
        ha-card { padding: 16px; }
        .bec-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
        .bec-title { font-size:16px; font-weight:500; color:var(--primary-text-color); display:flex; align-items:center; gap:10px; }
        .bec-title-badge { width:32px; height:32px; border-radius:50%; background:rgba(var(--rgb-primary-color, 3,169,244),0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .bec-title-badge ha-icon { color:var(--primary-color); --mdc-icon-size:18px; }
        .bec-lang-btn, .bec-palette-btn {
          display:block; width:100%; box-sizing:border-box; border:1px solid var(--divider-color); border-radius:999px; padding:6px 14px; font-size:13px; text-align:center;
          background:var(--card-background-color); color:var(--primary-text-color); cursor:pointer;
        }
        .bec-period-track { display:inline-flex; background:var(--secondary-background-color, rgba(127,127,127,0.08)); border-radius:999px; padding:3px; gap:2px; }
        .bec-period-btn { border:none; border-radius:999px; padding:6px 14px; font-size:12px; background:transparent; color:var(--secondary-text-color); cursor:pointer; }
        .bec-period-btn.active { background:var(--primary-color); color:var(--text-primary-color,#fff); }
        .bec-metrics { display:grid; grid-template-columns:repeat(auto-fit, minmax(108px, 1fr)); gap:10px; margin-bottom:14px; }
        .bec-metric { border-radius:14px; padding:12px 14px; min-width:0; }
        .bec-metric.saved { background: var(--color-background-success, rgba(76,175,80,0.14)); }
        .bec-micon { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:8px; }
        .bec-micon ha-icon { --mdc-icon-size:15px; }
        .bec-mlabel { font-size:12px; color:var(--secondary-text-color); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bec-mvalue { font-size:19px; font-weight:500; color:var(--primary-text-color); line-height:1.25; word-break:break-word; }
        .bec-metric.saved .bec-mvalue { color:var(--success-color, #4caf50); }
        .bec-msub { font-size:12px; color:var(--secondary-text-color); margin-top:2px; }
        .bec-legend { display:flex; gap:14px; font-size:13px; color:var(--secondary-text-color); margin-bottom:6px; flex-wrap:wrap; }
        .bec-swatch { width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:5px; vertical-align:middle; }
        .bec-chartwrap { width:100%; margin-bottom:14px; }
        .bec-chartwrap svg { width:100%; height:auto; display:block; }
        .bec-breakdown { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom:14px; }
        .bec-bdcol { border-radius:14px; padding:12px 14px; min-width:0; }
        .bec-bdtitle { font-size:13px; font-weight:500; margin-bottom:8px; color:var(--primary-text-color); display:flex; align-items:center; gap:6px; }
        .bec-bdtitle ha-icon { --mdc-icon-size:15px; }
        .bec-bdrow { display:flex; flex-direction:column; gap:1px; padding:4px 0; }
        .bec-bdrow span:first-child { font-size:12px; color:var(--secondary-text-color); }
        .bec-bdrow span:last-child { font-size:14px; color:var(--primary-text-color); }
        .bec-bdtotal { display:flex; flex-direction:column; align-items:center; gap:2px; margin-top:8px; padding:10px 14px; border-radius:16px; color:var(--primary-text-color); }
        .bec-bdtotal span:first-child { font-size:12px; font-weight:500; color:var(--secondary-text-color); }
        .bec-bdtotal span:last-child { font-size:17px; font-weight:600; }
        .bec-settings { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px; align-items:start; border-top:1px solid var(--divider-color); padding-top:14px; }
        .bec-settings-icon { color:var(--secondary-text-color); margin-bottom:2px; }
        .bec-settings label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--secondary-text-color); }
        .bec-settings input { display:block; width:100%; box-sizing:border-box; border:1px solid var(--divider-color); border-radius:999px; padding:6px 14px; font-size:13px; text-align:center; background:var(--card-background-color); color:var(--primary-text-color); }
        .bec-msg { padding:20px 4px; text-align:center; color:var(--secondary-text-color); font-size:13px; }
        .bec-live-top { display:flex; align-items:center; justify-content:flex-end; margin-bottom:10px; }
        .bec-live-badge { display:flex; align-items:center; gap:5px; background:var(--color-background-success, rgba(76,175,80,0.14)); padding:4px 10px; border-radius:999px; }
        .bec-live-dot { width:6px; height:6px; border-radius:50%; background:var(--success-color,#4caf50); }
        .bec-live-text { font-size:10px; color:var(--success-color,#4caf50); font-weight:500; }
        .bec-hero { text-align:center; padding:0 0 14px; }
        .bec-hero-label { font-size:12px; color:var(--secondary-text-color); margin-bottom:2px; }
        .bec-hero-value { font-size:24px; font-weight:500; color:var(--success-color,#4caf50); }
        .bec-hero-bar { margin-top:8px; height:6px; border-radius:999px; background:var(--secondary-background-color, rgba(127,127,127,0.12)); overflow:hidden; }
        .bec-hero-bar-fill { height:100%; border-radius:999px; }
        .bec-livecols { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:8px; margin-bottom:12px; }
        .bec-livecol { border-radius:14px; padding:10px 12px; min-width:0; }
        .bec-livecol-label { font-size:11px; color:var(--secondary-text-color); margin-bottom:4px; }
        .bec-livepower { font-size:18px; font-weight:500; color:var(--primary-text-color); }
        .bec-livepower-unit { font-size:11px; font-weight:400; color:var(--secondary-text-color); }
        .bec-livesub { font-size:10px; color:var(--secondary-text-color); margin-top:4px; }
        .bec-livechart-title { font-size:11px; color:var(--secondary-text-color); margin-bottom:4px; }
        .bec-costheader { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
        .bec-costheader-title { font-weight:500; font-size:15px; color:var(--primary-text-color); }
        .bec-livedivider { border-top:1px solid var(--divider-color); margin:14px 0; }
      </style>
      <ha-card>
        <div class="bec-body">
          <div class="bec-header">
            <div class="bec-title">
              <span class="bec-title-badge"><ha-icon icon="mdi:flash"></ha-icon></span>
              ${this._config.title}
            </div>
          </div>
          <div class="bec-live"></div>
          <div class="bec-cost"></div>
        </div>
      </ha-card>
    `;
    this._built = true;
  }

  _showMessage(text) {
    const content = this.shadowRoot.querySelector('.bec-cost');
    if (content) content.innerHTML = '<div class="bec-msg">' + text + '</div>';
  }

  _state(entityId) {
    const st = entityId && this._hass && this._hass.states[entityId];
    return st ? parseFloat(st.state) : null;
  }

  _unit(entityId, fallback) {
    const st = entityId && this._hass && this._hass.states[entityId];
    return (st && st.attributes && st.attributes.unit_of_measurement) || fallback;
  }

  async _fetchHourlyMean(entityId, hours) {
    if (!entityId || !this._hass) return [];
    const end = new Date();
    const start = new Date(end);
    start.setHours(start.getHours() - hours);
    try {
      const result = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        statistic_ids: [entityId],
        period: 'hour',
        types: ['mean']
      });
      const rows = (result && result[entityId]) || [];
      return rows.map((r) => ({ t: r.start, v: r.mean || 0 }));
    } catch (e) {
      return [];
    }
  }

  async _updateLiveMeter(forceFetch) {
    const c = this._config;
    if (!c.grid_power_entity && !c.load_power_entity) {
      this._renderLive();
      return;
    }
    const now = Date.now();
    const shouldFetch = forceFetch || !this._lastLiveFetch || now - this._lastLiveFetch > 5 * 60 * 1000;
    if (shouldFetch) {
      this._lastLiveFetch = now;
      const hours = c.live_sparkline_hours || 6;
      const [g, l] = await Promise.all([
        this._fetchHourlyMean(c.grid_power_entity, hours),
        this._fetchHourlyMean(c.load_power_entity, hours)
      ]);
      this._liveSparkCache = { grid: g, load: l };
    }
    this._renderLive();
  }

  _renderLive() {
    if (!this._built) return;
    const live = this.shadowRoot.querySelector('.bec-live');
    if (!live) return;
    const c = this._config;
    const t = (k) => this._t(k);
    if (!c.grid_power_entity && !c.load_power_entity) {
      live.innerHTML = '';
      return;
    }
    const colors = this._getColors();
    const gridPower = this._state(c.grid_power_entity) || 0;
    const loadPower = this._state(c.load_power_entity) || 0;
    const solarPower = Math.max(0, loadPower - gridPower);
    const solarPct = loadPower > 0 ? (solarPower / loadPower) * 100 : 0;
    const gridVoltage = this._state(c.grid_voltage_entity);
    const loadVoltage = this._state(c.load_voltage_entity);
    const gridCurrent = this._state(c.grid_current_entity);
    const loadCurrent = this._state(c.load_current_entity);
    const vUnit = this._unit(c.grid_voltage_entity, 'V');
    const aUnit = this._unit(c.grid_current_entity, 'A');

    const stat = (label, value, unit) =>
      value == null ? '' : label + ' ' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + unit;
    const subParts = [stat(t('voltageLabel'), gridVoltage, vUnit), stat(t('currentLabel'), gridCurrent, aUnit)].filter(Boolean);
    const subPartsLoad = [stat(t('voltageLabel'), loadVoltage, vUnit), stat(t('currentLabel'), loadCurrent, aUnit)].filter(Boolean);
    const cache = this._liveSparkCache || { grid: [], load: [] };

    live.innerHTML = `
      <div class="bec-live-top">
        <div class="bec-live-badge">
          <span class="bec-live-dot"></span>
          <span class="bec-live-text">${t('liveWord')}</span>
        </div>
      </div>
      <div class="bec-hero">
        <div class="bec-hero-label">${t('solarNowLabel')}</div>
        <div class="bec-hero-value">${solarPct.toFixed(1)}%</div>
        <div class="bec-hero-bar"><div class="bec-hero-bar-fill" style="width:${solarPct.toFixed(1)}%;background:${colors.load}"></div></div>
      </div>
      <div class="bec-livecols">
        <div class="bec-livecol" style="background:${tint(colors.grid, 0.1)}">
          <div class="bec-livecol-label"><ha-icon icon="mdi:transmission-tower" style="color:${colors.grid};--mdc-icon-size:13px;"></ha-icon> ${t('gridShort')}</div>
          <div class="bec-livepower">${Number(gridPower).toFixed(1)} <span class="bec-livepower-unit">W</span></div>
          ${subParts.length ? '<div class="bec-livesub">' + subParts.join(' · ') + '</div>' : ''}
        </div>
        <div class="bec-livecol" style="background:${tint(colors.load, 0.1)}">
          <div class="bec-livecol-label"><ha-icon icon="mdi:home-lightning-bolt" style="color:${colors.load};--mdc-icon-size:13px;"></ha-icon> ${t('loadShort')}</div>
          <div class="bec-livepower">${Number(loadPower).toFixed(1)} <span class="bec-livepower-unit">W</span></div>
          ${subPartsLoad.length ? '<div class="bec-livesub">' + subPartsLoad.join(' · ') + '</div>' : ''}
        </div>
      </div>
      <div class="bec-livechart-title">${t('liveChartTitle')} ${c.live_sparkline_hours || 6} ${t('hoursWord')}</div>
      <div class="bec-chartwrap">${this._buildPowerLineChartSVG(cache.grid, cache.load, colors)}</div>
      <div class="bec-legend">
        <span><span class="bec-swatch" style="background:${colors.grid}"></span>${t('gridShort')}</span>
        <span><span class="bec-swatch" style="background:${colors.load}"></span>${t('loadShort')}</span>
      </div>
      <div class="bec-livedivider"></div>
    `;
  }

  _buildPowerLineChartSVG(gridSeries, loadSeries, colors) {
    const W = 640;
    const H = 170;
    const padLeft = 38;
    const padRight = 8;
    const padTop = 14;
    const padBottom = 26;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const axisFontSize = 12;

    if (!gridSeries.length && !loadSeries.length) {
      return (
        '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
        '<text x="' + W / 2 + '" y="' + H / 2 + '" font-size="12" text-anchor="middle" fill="var(--secondary-text-color)">no data</text></svg>'
      );
    }

    const toKw = (series) => series.map((r) => Math.max(0, r.v) / 1000);
    const gridKw = toKw(gridSeries);
    const loadKw = toKw(loadSeries);
    const maxV = Math.max(0.1, ...gridKw, ...loadKw) * 1.15;

    const toPoints = (vals) => {
      if (!vals.length) return '';
      return vals
        .map((v, i) => {
          const x = padLeft + (i / Math.max(1, vals.length - 1)) * chartW;
          const y = padTop + chartH - (v / maxV) * chartH;
          return x.toFixed(1) + ',' + y.toFixed(1);
        })
        .join(' ');
    };
    const gridPts = toPoints(gridKw);
    const loadPts = toPoints(loadKw);

    let yAxis = '';
    [0, 0.5, 1].forEach((frac) => {
      const val = maxV * frac;
      const y = padTop + chartH - frac * chartH;
      yAxis +=
        '<line x1="' + padLeft + '" y1="' + y.toFixed(1) + '" x2="' + (W - padRight) + '" y2="' + y.toFixed(1) +
        '" stroke="var(--divider-color)" stroke-width="1"' + (frac === 0 ? '' : ' stroke-dasharray="3,3"') + '/>';
      yAxis +=
        '<text x="' + (padLeft - 8) + '" y="' + y.toFixed(1) +
        '" font-size="' + axisFontSize + '" text-anchor="end" dominant-baseline="middle" fill="var(--secondary-text-color)">' +
        val.toFixed(2) + 'kW</text>';
    });

    const refSeries = gridSeries.length >= loadSeries.length ? gridSeries : loadSeries;
    const labelStep = refSeries.length > 8 ? Math.ceil(refSeries.length / 6) : 1;
    let xAxis = '';
    refSeries.forEach((r, i) => {
      if (i % labelStep !== 0 && i !== refSeries.length - 1) return;
      const x = padLeft + (i / Math.max(1, refSeries.length - 1)) * chartW;
      const d = new Date(r.t);
      const hh = d.getHours() + ':00';
      xAxis +=
        '<text x="' + x.toFixed(1) + '" y="' + (H - 6) +
        '" font-size="' + axisFontSize + '" text-anchor="middle" fill="var(--secondary-text-color)">' + hh + '</text>';
    });

    const gridLine = gridPts ? '<polyline points="' + gridPts + '" fill="none" stroke="' + colors.grid + '" stroke-width="2"/>' : '';
    const loadLine = loadPts ? '<polyline points="' + loadPts + '" fill="none" stroke="' + colors.load + '" stroke-width="2" stroke-dasharray="6,4"/>' : '';

    return (
      '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Line chart of grid and load power in kilowatts over recent hours">' +
      yAxis + gridLine + loadLine + xAxis + '</svg>'
    );
  }

  async _fetchHourlyRows(entityId, start, end) {
    if (!entityId || !this._hass) return [];
    try {
      const result = await this._hass.callWS({
        type: 'recorder/statistics_during_period',
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        statistic_ids: [entityId],
        period: 'hour',
        types: ['state', 'sum']
      });
      const rows = (result && result[entityId]) || [];
      if (rows.length > 1) return rows.map((r) => ({ start: r.start, state: r.state, sum: r.sum }));
      return await this._hourlyRowsFallback(entityId, start, end);
    } catch (e) {
      return await this._hourlyRowsFallback(entityId, start, end);
    }
  }

  async _hourlyRowsFallback(entityId, start, end) {
    try {
      const path =
        'history/period/' +
        start.toISOString() +
        '?filter_entity_id=' +
        entityId +
        '&end_time=' +
        end.toISOString() +
        '&minimal_response';
      const history = await this._hass.callApi('GET', path);
      const states = (history && history[0]) || [];
      const byHour = {};
      states.forEach((s) => {
        const hour = s.last_changed.slice(0, 13);
        const val = parseFloat(s.state);
        if (!isNaN(val)) byHour[hour] = val;
      });
      const hours = Object.keys(byHour).sort();
      let sum = 0;
      let prevState = null;
      const rows = [];
      hours.forEach((h) => {
        const state = byHour[h];
        if (prevState != null) sum += state >= prevState ? state - prevState : state;
        rows.push({ start: h + ':00:00.000Z', state, sum });
        prevState = state;
      });
      return rows;
    } catch (e) {
      return [];
    }
  }

  _detectSegments(rows) {
    if (!rows.length) return [];
    const segments = [];
    let segStart = rows[0].start;
    let segSum = 0;
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i].sum;
      const b = rows[i - 1].sum;
      const delta = a != null && b != null ? Math.max(0, a - b) : 0;
      const resetHappened = rows[i].state != null && rows[i - 1].state != null && rows[i].state < rows[i - 1].state;
      if (resetHappened) {
        segments.push({ start: segStart, end: rows[i - 1].start, value: segSum });
        segStart = rows[i].start;
        segSum = delta;
      } else {
        segSum += delta;
      }
    }
    segments.push({ start: segStart, end: rows[rows.length - 1].start, value: segSum, current: true });
    return segments;
  }

  async _fetchSegments(entityId, lookbackDays, count) {
    if (!entityId || !this._hass) return [];
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - lookbackDays);
    const rows = await this._fetchHourlyRows(entityId, start, end);
    const segments = this._detectSegments(rows);
    return segments.slice(-count).map((s) => {
      const startMs = new Date(s.start).getTime();
      const endMs = new Date(s.end).getTime();
      const days = Math.max(1, Math.round((endMs - startMs) / 86400000) || 1);
      return { start: s.start, value: s.value, days };
    });
  }

  _formatLabel(isoStart) {
    const d = new Date(isoStart);
    const months = this._config.language === 'en' ? EN_MONTHS : THAI_MONTHS;
    return this._config.language === 'en'
      ? months[d.getMonth()] + ' ' + d.getDate()
      : d.getDate() + ' ' + months[d.getMonth()];
  }

  async _updateView() {
    if (!this._built) this._buildShell();
    if (!this._hass) return;
    const c = this._config;
    const gridKey = this._period === 'daily' ? 'grid_entity_daily' : 'grid_entity_cycle';
    const loadKey = this._period === 'daily' ? 'load_entity_daily' : 'load_entity_cycle';
    if (!c[gridKey] || !c[loadKey]) {
      this._showMessage(this._t('msgConfigMissing'));
      return;
    }
    if (!this._hass.states[c[gridKey]] || !this._hass.states[c[loadKey]]) {
      this._showMessage(this._t('msgEntityNotFound'));
      return;
    }
    this._showMessage(this._t('msgLoading'));
    const count = this._period === 'daily' ? c.daily_days : c.cycle_count;
    const lookbackDays = this._period === 'daily' ? count + 3 : count * 32 + 10;
    const [gridSeries, loadSeries] = await Promise.all([
      this._fetchSegments(c[gridKey], lookbackDays, count),
      this._fetchSegments(c[loadKey], lookbackDays, count)
    ]);
    const n = Math.max(gridSeries.length, loadSeries.length);
    if (n === 0) {
      this._showMessage(this._t('msgNoData'));
      return;
    }
    const labels = [];
    const gridVals = [];
    const loadVals = [];
    const daysArr = [];
    for (let i = 0; i < n; i++) {
      const g = gridSeries[i];
      const l = loadSeries[i];
      const ref = g || l;
      labels.push(this._formatLabel(ref.start));
      gridVals.push(g ? g.value : 0);
      loadVals.push(l ? l.value : 0);
      daysArr.push(ref.days || 1);
    }
    this._renderData(labels, gridVals, loadVals, daysArr);
  }

  _renderData(labels, gridVals, loadVals, daysArr) {
    const c = this._config;
    const t = (k) => this._t(k);
    const colors = this._getColors();
    const totalDays = daysArr.reduce((s, d) => s + d, 0) || labels.length;
    const gridTotal = gridVals.reduce((s, v) => s + v, 0);
    const loadTotal = loadVals.reduce((s, v) => s + v, 0);
    const gridCost = this._calcCost(gridTotal, totalDays);
    const loadCost = this._calcCost(loadTotal, totalDays);
    const saved = loadCost.total - gridCost.total;
    const savedPct = loadCost.total > 0 ? (saved / loadCost.total) * 100 : 0;
    const cur = t('currencyWord');

    const content = this.shadowRoot.querySelector('.bec-cost');
    content.innerHTML = `
      <div class="bec-costheader">
        <span class="bec-costheader-title">${t('costSectionTitle')}</span>
        <div class="bec-period-track">
          <button class="bec-period-btn ${this._period === 'daily' ? 'active' : ''}" data-period="daily">${t('daily')}</button>
          <button class="bec-period-btn ${this._period === 'monthly' ? 'active' : ''}" data-period="monthly">${t('monthly')}</button>
        </div>
      </div>
      <div class="bec-metrics">
        <div class="bec-metric" style="background:${tint(colors.grid, 0.14)}">
          <div class="bec-micon" style="background:${tint(colors.grid, 0.28)}"><ha-icon icon="mdi:transmission-tower" style="color:${colors.grid}"></ha-icon></div>
          <div class="bec-mlabel">${t('gridShort')}</div>
          <div class="bec-mvalue">${fmtKwh(gridTotal)} kWh</div>
          <div class="bec-msub">${fmtBaht(gridCost.total)} ${cur}</div>
        </div>
        <div class="bec-metric" style="background:${tint(colors.load, 0.14)}">
          <div class="bec-micon" style="background:${tint(colors.load, 0.28)}"><ha-icon icon="mdi:home-lightning-bolt" style="color:${colors.load}"></ha-icon></div>
          <div class="bec-mlabel">${t('loadShort')}</div>
          <div class="bec-mvalue">${fmtKwh(loadTotal)} kWh</div>
          <div class="bec-msub">${fmtBaht(loadCost.total)} ${cur}</div>
        </div>
        <div class="bec-metric saved">
          <div class="bec-micon" style="background:var(--color-background-success)"><ha-icon icon="mdi:leaf" style="color:var(--success-color)"></ha-icon></div>
          <div class="bec-mlabel">${t('savedShort')}</div>
          <div class="bec-mvalue">${fmtBaht(saved)} ${cur}</div>
          <div class="bec-msub">${savedPct.toFixed(1)}${t('equivalentSuffix')}</div>
        </div>
      </div>
      <div class="bec-legend">
        <span><span class="bec-swatch" style="background:${colors.grid}"></span>${t('fromGrid')}</span>
        <span><span class="bec-swatch" style="background:${colors.load}"></span>${t('totalLoad')}</span>
      </div>
      <div class="bec-chartwrap">${this._buildChartSVG(labels, gridVals, loadVals, daysArr, colors)}</div>
      <div class="bec-breakdown">
        <div class="bec-bdcol" style="background:${tint(colors.grid, 0.09)};border:1px solid ${tint(colors.grid, 0.3)}">
          <div class="bec-bdtitle"><ha-icon icon="mdi:transmission-tower" style="color:${colors.grid}"></ha-icon>${t('detailGrid')}</div>
          ${this._buildBreakdownHTML(gridCost, colors.grid)}
        </div>
        <div class="bec-bdcol" style="background:${tint(colors.load, 0.09)};border:1px solid ${tint(colors.load, 0.3)}">
          <div class="bec-bdtitle"><ha-icon icon="mdi:home-lightning-bolt" style="color:${colors.load}"></ha-icon>${t('detailLoad')}</div>
          ${this._buildBreakdownHTML(loadCost, colors.load)}
        </div>
      </div>
      <div class="bec-settings">
        <ha-icon class="bec-settings-icon" icon="mdi:cog-outline"></ha-icon>
        <label>${t('fieldLanguageLabel')}<button type="button" class="bec-lang-btn">${(c.language || 'th').toUpperCase()}</button></label>
        <label>${t('fieldPaletteLabel')}<button type="button" class="bec-palette-btn">${c.palette === 'solar' ? t('paletteSolar') : c.palette === 'modern' ? t('paletteModern') : c.palette === 'pea' ? 'PEA' : t('paletteCustom')}</button></label>
        <label>${t('ftSettingLabel')}<input type="number" step="0.0001" class="bec-set-ft" value="${c.ft_adjustment}"></label>
        <label>${t('serviceSettingLabel')}<input type="number" step="0.01" class="bec-set-service" value="${c.service_charge}"></label>
        <label>${t('vatSettingLabel')}<input type="number" step="0.1" class="bec-set-vat" value="${c.vat_percent}"></label>
        ${c.cutoff_day_entity ? '<label>' + t('cutoffDaySettingLabel') + '<input type="number" step="1" min="1" max="31" class="bec-set-cutoff-day" value="' + this._entityState(c.cutoff_day_entity) + '"></label>' : ''}
        ${c.cutoff_hour_entity ? '<label>' + t('cutoffHourSettingLabel') + '<input type="number" step="1" min="0" max="23" class="bec-set-cutoff-hour" value="' + this._entityState(c.cutoff_hour_entity) + '"></label>' : ''}
      </div>
    `;
    content.querySelectorAll('.bec-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._period = btn.dataset.period;
        this._updateView();
      });
    });
    content.querySelector('.bec-lang-btn').addEventListener('click', () => {
      this._config.language = this._config.language === 'en' ? 'th' : 'en';
      this._buildShell();
      this._renderLive();
      this._updateView();
    });
    content.querySelector('.bec-palette-btn').addEventListener('click', () => {
      const order = ['solar', 'modern', 'pea', 'custom'];
      const idx = order.indexOf(this._config.palette);
      this._config.palette = order[(idx + 1) % order.length];
      this._renderLive();
      this._updateView();
    });
    content.querySelector('.bec-set-ft').addEventListener('change', (e) => {
      c.ft_adjustment = parseFloat(e.target.value) || 0;
      this._renderData(labels, gridVals, loadVals, daysArr);
    });
    content.querySelector('.bec-set-service').addEventListener('change', (e) => {
      c.service_charge = parseFloat(e.target.value) || 0;
      this._renderData(labels, gridVals, loadVals, daysArr);
    });
    content.querySelector('.bec-set-vat').addEventListener('change', (e) => {
      c.vat_percent = parseFloat(e.target.value) || 0;
      this._renderData(labels, gridVals, loadVals, daysArr);
    });
    const cutoffDayEl = content.querySelector('.bec-set-cutoff-day');
    if (cutoffDayEl) {
      cutoffDayEl.addEventListener('change', (e) => {
        this._hass.callService('input_number', 'set_value', {
          entity_id: c.cutoff_day_entity,
          value: parseFloat(e.target.value) || 0
        });
      });
    }
    const cutoffHourEl = content.querySelector('.bec-set-cutoff-hour');
    if (cutoffHourEl) {
      cutoffHourEl.addEventListener('change', (e) => {
        this._hass.callService('input_number', 'set_value', {
          entity_id: c.cutoff_hour_entity,
          value: parseFloat(e.target.value) || 0
        });
      });
    }
  }

  _entityState(entityId) {
    const st = this._hass && this._hass.states[entityId];
    return st ? st.state : '';
  }

  _buildBreakdownHTML(cost, accentColor) {
    const t = (k) => this._t(k);
    const cur = t('currencyWord');
    return (
      '<div class="bec-bdrow"><span>' + t('unitsUsed') + '</span><span>' + fmtKwh(cost.units) + ' ' + t('unitsWord') + '</span></div>' +
      '<div class="bec-bdrow"><span>' + t('energyCost') + '</span><span>' + fmtBaht(cost.energy) + ' ' + cur + '</span></div>' +
      '<div class="bec-bdrow"><span>' + t('ftWord') + '</span><span>' + fmtBaht(cost.ft) + ' ' + cur + '</span></div>' +
      '<div class="bec-bdrow"><span>' + t('serviceCharge') + '</span><span>' + fmtBaht(cost.service) + ' ' + cur + '</span></div>' +
      '<div class="bec-bdrow"><span>' + t('vatWord') + '</span><span>' + fmtBaht(cost.vat) + ' ' + cur + '</span></div>' +
      '<div class="bec-bdtotal" style="background:' + tint(accentColor, 0.22) + '"><span>' + t('totalWord') + '</span><span>' + fmtBaht(cost.total) + ' ' + cur + '</span></div>'
    );
  }

  _roundedTopPath(x, y, w, h, r) {
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return (
      'M' + x + ',' + (y + h) +
      ' L' + x + ',' + (y + r) +
      ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      ' L' + (x + w - r) + ',' + y +
      ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
      ' L' + (x + w) + ',' + (y + h) +
      ' Z'
    );
  }

  _buildChartSVG(labels, gridVals, loadVals, daysArr, colors) {
    const W = 640;
    const H = 300;
    const marginLeft = 40;
    const marginRight = 8;
    const marginTop = 46;
    const marginBottom = 36;
    const chartW = W - marginLeft - marginRight;
    const chartH = H - marginTop - marginBottom;
    const n = Math.max(1, labels.length);
    const maxRaw = Math.max(1, ...gridVals, ...loadVals);
    const maxVal = maxRaw * 1.3;
    const groupW = chartW / n;
    const barW = Math.min(40, groupW * 0.38);
    const gap = 6;
    const barRadius = Math.min(8, barW / 2);
    const labelStep = n > 12 ? 3 : n > 8 ? 2 : 1;
    const costFontSize = 20;
    const axisFontSize = 17;
    const yAxisFontSize = 14;

    let yAxis = '';
    [0, 0.5, 1].forEach((frac) => {
      const val = maxVal * frac;
      const yy = marginTop + chartH - frac * chartH;
      yAxis +=
        '<line x1="' + marginLeft + '" y1="' + yy.toFixed(1) + '" x2="' + (W - marginRight) + '" y2="' + yy.toFixed(1) +
        '" stroke="var(--divider-color)" stroke-width="1"' + (frac === 0 ? '' : ' stroke-dasharray="3,3"') + '/>';
      yAxis +=
        '<text x="' + (marginLeft - 8) + '" y="' + yy.toFixed(1) +
        '" font-size="' + yAxisFontSize + '" text-anchor="end" dominant-baseline="middle" fill="var(--secondary-text-color)">' +
        val.toFixed(0) + '</text>';
    });

    let bars = '';
    let xLabels = '';

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
      bars += '<path d="' + this._roundedTopPath(gx, gy, barW, gh, barRadius) + '" fill="' + colors.grid + '"/>';
      bars += '<path d="' + this._roundedTopPath(lx, ly, barW, lh, barRadius) + '" fill="' + colors.load + '"/>';

      if (i % labelStep === 0) {
        const gCost = this._calcCost(gv, daysArr[i] || 1).total;
        const lCost = this._calcCost(lv, daysArr[i] || 1).total;
        const gLabelY = Math.max(marginTop - 10, gy - 10);
        const lLabelY = Math.max(marginTop - 10, ly - 10);
        bars +=
          '<text x="' + (gx + barW / 2).toFixed(1) + '" y="' + gLabelY.toFixed(1) +
          '" font-size="' + costFontSize + '" font-weight="600" text-anchor="middle" fill="var(--primary-text-color)">' +
          Math.round(gCost) + '฿</text>';
        bars +=
          '<text x="' + (lx + barW / 2).toFixed(1) + '" y="' + lLabelY.toFixed(1) +
          '" font-size="' + costFontSize + '" font-weight="600" text-anchor="middle" fill="var(--primary-text-color)">' +
          Math.round(lCost) + '฿</text>';
        xLabels +=
          '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) +
          '" font-size="' + axisFontSize + '" text-anchor="middle" fill="var(--secondary-text-color)">' + labels[i] + '</text>';
      }
    }

    return (
      '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Grid vs load energy in kWh and cost comparison chart">' +
      yAxis + bars + xLabels + '</svg>'
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
    if (this._gridDailyPicker) this._gridDailyPicker.hass = hass;
    if (this._loadDailyPicker) this._loadDailyPicker.hass = hass;
    if (this._gridCyclePicker) this._gridCyclePicker.hass = hass;
    if (this._loadCyclePicker) this._loadCyclePicker.hass = hass;
    if (this._cutoffDayPicker) this._cutoffDayPicker.hass = hass;
    if (this._cutoffHourPicker) this._cutoffHourPicker.hass = hass;
    if (this._gridPowerPicker) this._gridPowerPicker.hass = hass;
    if (this._loadPowerPicker) this._loadPowerPicker.hass = hass;
    if (this._gridVoltagePicker) this._gridVoltagePicker.hass = hass;
    if (this._loadVoltagePicker) this._loadVoltagePicker.hass = hass;
    if (this._gridCurrentPicker) this._gridCurrentPicker.hass = hass;
    if (this._loadCurrentPicker) this._loadCurrentPicker.hass = hass;
  }

  _t(key) {
    const lang = (this._config && this._config.language === 'en') ? 'en' : 'th';
    return STRINGS[lang][key] || key;
  }

  _emitChange(newConfig) {
    this._config = newConfig;
    const event = new Event('config-changed', { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  _makePicker(slotId, configKey, label, includeDomains) {
    const picker = document.createElement('ha-entity-picker');
    picker.hass = this._hass;
    picker.value = this._config[configKey] || '';
    picker.label = label;
    picker.allowCustomEntity = true;
    if (includeDomains) picker.includeDomains = includeDomains;
    picker.style.display = 'block';
    picker.style.width = '100%';
    picker.addEventListener('value-changed', (e) => {
      e.stopPropagation();
      const newConfig = Object.assign({}, this._config, { [configKey]: e.detail.value || '' });
      this._emitChange(newConfig);
    });
    this.shadowRoot.querySelector('#' + slotId).appendChild(picker);
    return picker;
  }

  _field(label, key, type, step) {
    const v = this._config[key];
    return (
      '<div style="padding:6px 0;">' +
      '<label style="display:block;font-size:13px;color:var(--secondary-text-color);margin-bottom:4px;">' + label + '</label>' +
      '<input data-key="' + key + '" type="' + type + '"' +
      (step ? ' step="' + step + '"' : '') +
      ' value="' + v + '" style="display:block;width:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:6px;padding:8px 10px;font-size:14px;background:var(--card-background-color);color:var(--primary-text-color);"/>' +
      '</div>'
    );
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const c = this._config;
    const t = (k) => this._t(k);
    this.shadowRoot.innerHTML = `
      <style>
        .card-config { padding: 8px 4px; }
        .section-title { font-size:13px; font-weight:500; margin:14px 0 4px; color:var(--primary-text-color); }
        .field-row { padding:6px 0; }
        .field-row label { display:block; font-size:13px; color:var(--secondary-text-color); margin-bottom:4px; }
        select { display:block; width:100%; box-sizing:border-box; border:1px solid var(--divider-color); border-radius:6px; padding:8px 10px; font-size:14px; background:var(--card-background-color); color:var(--primary-text-color); }
        input[type="color"] { width:56px; height:36px; border:1px solid var(--divider-color); border-radius:6px; padding:0; }
        .btn-group { display:flex; gap:6px; flex-wrap:wrap; }
        .btn-group button { border:1px solid var(--divider-color); border-radius:8px; padding:8px 14px; font-size:13px; background:var(--card-background-color); color:var(--primary-text-color); cursor:pointer; }
        .btn-group button.active { background:var(--primary-color); color:#fff; border-color:var(--primary-color); }
      </style>
      <div class="card-config">
        <div class="section-title">${t('secLanguage')}</div>
        <div class="field-row">
          <label>${t('fieldLanguageLabel')}</label>
          <div class="btn-group" id="language-group">
            <button type="button" data-value="th" class="${(c.language || 'th') === 'th' ? 'active' : ''}">ไทย</button>
            <button type="button" data-value="en" class="${c.language === 'en' ? 'active' : ''}">English</button>
          </div>
        </div>

        <div class="section-title">${t('secSensors')}</div>
        ${this._field(t('fieldCardTitle'), 'title', 'text')}
        <div id="grid-daily-slot" style="margin:6px 0;"></div>
        <div id="load-daily-slot" style="margin:6px 0;"></div>

        <div class="section-title">${t('secSensorsCycle')}</div>
        <div id="grid-cycle-slot" style="margin:6px 0;"></div>
        <div id="load-cycle-slot" style="margin:6px 0;"></div>

        <div class="section-title">${t('secRates')}</div>
        ${this._field(t('fieldFt'), 'ft_adjustment', 'number', '0.0001')}
        ${this._field(t('fieldService'), 'service_charge', 'number', '0.01')}
        ${this._field(t('fieldVat'), 'vat_percent', 'number', '0.1')}
        ${this._field(t('fieldTier1Rate'), 'tier1_rate', 'number', '0.0001')}
        ${this._field(t('fieldTier1Limit'), 'tier1_limit', 'number', '1')}
        ${this._field(t('fieldTier2Rate'), 'tier2_rate', 'number', '0.0001')}
        ${this._field(t('fieldTier2Limit'), 'tier2_limit', 'number', '1')}
        ${this._field(t('fieldTier3Rate'), 'tier3_rate', 'number', '0.0001')}

        <div class="section-title">${t('secCutoff')}</div>
        <div id="cutoff-day-slot" style="margin:6px 0;"></div>
        <div id="cutoff-hour-slot" style="margin:6px 0;"></div>

        <div class="section-title">${t('secLiveSensors')}</div>
        <div id="grid-power-slot" style="margin:6px 0;"></div>
        <div id="load-power-slot" style="margin:6px 0;"></div>
        <div id="grid-voltage-slot" style="margin:6px 0;"></div>
        <div id="load-voltage-slot" style="margin:6px 0;"></div>
        <div id="grid-current-slot" style="margin:6px 0;"></div>
        <div id="load-current-slot" style="margin:6px 0;"></div>
        ${this._field(t('fieldLiveSparklineHours'), 'live_sparkline_hours', 'number', '1')}

        <div class="section-title">${t('secColor')}</div>
        <div class="field-row">
          <label>${t('fieldPaletteLabel')}</label>
          <div class="btn-group" id="palette-group">
            <button type="button" data-value="solar" class="${c.palette === 'solar' ? 'active' : ''}">${t('paletteOptSolar')}</button>
            <button type="button" data-value="modern" class="${c.palette === 'modern' ? 'active' : ''}">${t('paletteOptModern')}</button>
            <button type="button" data-value="pea" class="${c.palette === 'pea' ? 'active' : ''}">${t('paletteOptPea')}</button>
            <button type="button" data-value="custom" class="${c.palette === 'custom' ? 'active' : ''}">${t('paletteOptCustom')}</button>
          </div>
        </div>
        <div class="field-row">
          <label>${t('fieldGridColor')}</label>
          <input id="grid-color" type="color" value="${c.grid_color}"/>
        </div>
        <div class="field-row">
          <label>${t('fieldLoadColor')}</label>
          <input id="load-color" type="color" value="${c.load_color}"/>
        </div>

        <div class="section-title">${t('secDefaultView')}</div>
        <div class="field-row">
          <label>${t('fieldPeriodLabel')}</label>
          <div class="btn-group" id="period-group">
            <button type="button" data-value="daily" class="${c.default_period === 'daily' ? 'active' : ''}">${t('periodOptDaily')}</button>
            <button type="button" data-value="monthly" class="${c.default_period === 'monthly' ? 'active' : ''}">${t('periodOptMonthly')}</button>
          </div>
        </div>
      </div>
    `;

    this._gridDailyPicker = this._makePicker('grid-daily-slot', 'grid_entity_daily', t('gridDailyPickerLabel'));
    this._loadDailyPicker = this._makePicker('load-daily-slot', 'load_entity_daily', t('loadDailyPickerLabel'));
    this._gridCyclePicker = this._makePicker('grid-cycle-slot', 'grid_entity_cycle', t('gridCyclePickerLabel'));
    this._loadCyclePicker = this._makePicker('load-cycle-slot', 'load_entity_cycle', t('loadCyclePickerLabel'));
    this._cutoffDayPicker = this._makePicker('cutoff-day-slot', 'cutoff_day_entity', t('fieldCutoffDayEntity'), ['input_number']);
    this._cutoffHourPicker = this._makePicker('cutoff-hour-slot', 'cutoff_hour_entity', t('fieldCutoffHourEntity'), ['input_number']);
    this._gridPowerPicker = this._makePicker('grid-power-slot', 'grid_power_entity', t('fieldGridPowerEntity'));
    this._loadPowerPicker = this._makePicker('load-power-slot', 'load_power_entity', t('fieldLoadPowerEntity'));
    this._gridVoltagePicker = this._makePicker('grid-voltage-slot', 'grid_voltage_entity', t('fieldGridVoltageEntity'));
    this._loadVoltagePicker = this._makePicker('load-voltage-slot', 'load_voltage_entity', t('fieldLoadVoltageEntity'));
    this._gridCurrentPicker = this._makePicker('grid-current-slot', 'grid_current_entity', t('fieldGridCurrentEntity'));
    this._loadCurrentPicker = this._makePicker('load-current-slot', 'load_current_entity', t('fieldLoadCurrentEntity'));

    this.shadowRoot.querySelectorAll('#language-group button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newConfig = Object.assign({}, this._config, { language: btn.dataset.value });
        this._emitChange(newConfig);
        this._render();
      });
    });
    this.shadowRoot.querySelectorAll('input[data-key]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.key;
        const newConfig = Object.assign({}, this._config);
        newConfig[key] = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
        this._emitChange(newConfig);
      });
    });
    this.shadowRoot.querySelectorAll('#palette-group button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newConfig = Object.assign({}, this._config, { palette: btn.dataset.value });
        this._emitChange(newConfig);
        this._render();
      });
    });
    this.shadowRoot.querySelectorAll('#period-group button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const newConfig = Object.assign({}, this._config, { default_period: btn.dataset.value });
        this._emitChange(newConfig);
        this._render();
      });
    });
    this.shadowRoot.querySelector('#grid-color').addEventListener('change', (e) => {
      const newConfig = Object.assign({}, this._config, { grid_color: e.target.value, palette: 'custom' });
      this._emitChange(newConfig);
      this._render();
    });
    this.shadowRoot.querySelector('#load-color').addEventListener('change', (e) => {
      const newConfig = Object.assign({}, this._config, { load_color: e.target.value, palette: 'custom' });
      this._emitChange(newConfig);
      this._render();
    });
  }
}

customElements.define('bill-energy-card', BillEnergyCard);
customElements.define('bill-energy-card-editor', BillEnergyCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'bill-energy-card',
  name: 'Bill Energy Card',
  description: 'เปรียบเทียบพลังงานและค่าไฟฟ้าจาก 2 เซ็นเซอร์ (กริด vs โหลด) พร้อมกำลังไฟเรียลไทม์ (ไม่บังคับ) และคำนวณ Ft/ค่าบริการ/VAT ที่ปรับตั้งค่าได้ / Compare 2 sensors with optional live power monitoring and configurable PEA rate calc',
  preview: true
});
