// ============================
// UNPROTECTED OPENINGS CALCULATOR
// Extracted from: Unprotected Opening Calculator.html
// Client-side calculation module for opening size and aggregation
// ============================
(function () {
  /* ============================
     CONSTANTS & GLOBALS
     ============================ */
  const SQFT_PER_M2 = 10.7639;
  const M_PER_FT = 0.3048;
  const FT_PER_M = 1 / M_PER_FT;
  const IMPERIAL_ROUND_INCH = 0.125;
  const LOCAL_KEY_RO = 'bcabd_ro_default_m';

  let wallFaces = [];
  let currentOpenings = [];
  let projectLocked = false;
  let tableSelectInitial = null;
  let areaEnteredManually = false;

  let projectRODefault_m = 0.01905;

  /* ============================
     DOM helper
     ============================ */
  function safeEl(id) { try { return document.getElementById(id); } catch (e) { return null; } }

  /* ============================
     NUMERIC & UNIT HELPERS
     ============================ */
  function toNumber(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  function roundMetricDisplay(m) { return Math.round(m * 10000) / 10000; }
  function roundTo(m, places) { const p = Math.pow(10, places); return Math.round(m * p) / p; }
  function mToFeetDecimal(m) { return m * FT_PER_M; }
  function feetDecimalToM(ft) { return ft * M_PER_FT; }
  function m2ToFt2(m2) { return m2 * SQFT_PER_M2; }
  function ft2ToM2(ft2) { return ft2 / SQFT_PER_M2; }

  /* ============================
     IMPERIAL PARSING & FORMATTING (ROBUST: DECIMAL & FRACTION INCHES)
     ============================ */
  const IMPERIAL_QUOTE_CHARS = /[\""]/g;
  const APOSTROPHE_CHARS = /[''‛`]/g;
  const NBSP = /\u00A0/g;

  function normalizeInput(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(NBSP, ' ')
      .replace(/\u2013|\u2014/g, '-')   // normalize dashes
      .replace(IMPERIAL_QUOTE_CHARS, '"')
      .replace(APOSTROPHE_CHARS, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseInchesStringToDecimal(s) {
    if (s === null || s === undefined) return NaN;
    s = normalizeInput(s);

    let m = s.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
    if (m) {
      const whole = parseInt(m[1], 10);
      const num = parseInt(m[2], 10);
      const den = parseInt(m[3], 10);
      if (den === 0) return NaN;
      return whole + (num / den);
    }

    m = s.match(/^([+-]?\d+)\/(\d+)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      const den = parseInt(m[2], 10);
      if (den === 0) return NaN;
      return num / den;
    }

    if (/^[+-]?\d*\.?\d+$/.test(s)) {
      return parseFloat(s);
    }

    return NaN;
  }

  function parseInchesInput(value) {
    if (value === null || value === undefined) return NaN;
    let s = normalizeInput(String(value));
    s = s.replace(/\s*in(?:ches)?\.?$/i, '').replace(/"$/, '').trim();
    return parseInchesStringToDecimal(s);
  }

  function parseFeetInput(value) {
    if (value === null || value === undefined) return NaN;
    let s = normalizeInput(String(value));
    if (s === '') return NaN;

    if (/^[+-]?\d*\.?\d+$/.test(s)) {
      return parseFloat(s);
    }

    s = s.replace(/\bfeet\b|\bfoot\b|\bft\b/gi, "'").replace(/\binches\b|\bin\b/gi, '"');

    let mixed = s.match(/^([+-]?\d+)\s*['-]\s*([+-]?\d*\.?\d+(?:\s+\d+\/\d+)?)(?:\s*")?$/);
    if (mixed) {
      const feet = parseInt(mixed[1], 10);
      const inchesPart = mixed[2].trim();
      const inchesDecimal = parseInchesStringToDecimal(inchesPart);
      if (!isNaN(inchesDecimal)) return feet + (inchesDecimal / 12);
    }

    let feetOnly = s.match(/^([+-]?\d+)\s*'$/);
    if (feetOnly) {
      return parseInt(feetOnly[1], 10);
    }

    let pureInches = s.match(/^([+-]?\d+(?:\s+\d+\/\d+)?|\d*\.?\d+)\s*(?:")?$/);
    if (pureInches) {
      const inchesPart = pureInches[1].trim();
      const inchesDecimal = parseInchesStringToDecimal(inchesPart);
      if (!isNaN(inchesDecimal)) return inchesDecimal / 12;
    }

    return NaN;
  }

  function formatFeetFractional(ft) {
    if (ft === null || ft === undefined || isNaN(ft)) return '';
    const totalInches = ft * 12;
    let roundedInches = Math.round(totalInches / IMPERIAL_ROUND_INCH) * IMPERIAL_ROUND_INCH;

    const negative = roundedInches < 0;
    if (negative) roundedInches = Math.abs(roundedInches);

    let feet = Math.floor(roundedInches / 12);
    let inchesTotal = roundedInches - (feet * 12);

    inchesTotal = Math.round(inchesTotal / IMPERIAL_ROUND_INCH) * IMPERIAL_ROUND_INCH;

    if (Math.abs(inchesTotal - 12) < 1e-9) {
      inchesTotal = 0;
      feet = feet + 1;
      const displayFeet = negative ? -feet : feet;
      return `${displayFeet}'-0"`;
    }

    const wholeInches = Math.floor(inchesTotal + 1e-9);
    const fracUnits = Math.round((inchesTotal - wholeInches) / IMPERIAL_ROUND_INCH);
    if (fracUnits === 0) {
      const displayFeet = negative ? -feet : feet;
      return `${displayFeet}'-${wholeInches}"`;
    } else {
      const numerator = fracUnits;
      const denominator = Math.round(1 / IMPERIAL_ROUND_INCH);
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
      const g = gcd(numerator, denominator);
      const num = numerator / g;
      const den = denominator / g;
      const inchesDisplay = wholeInches > 0 ? `${wholeInches} ${num}/${den}` : `${num}/${den}`;
      const displayFeet = negative ? -feet : feet;
      return `${displayFeet}'-${inchesDisplay}"`;
    }
  }

  /* ============================
     UNIT CONVERSION HELPERS
     ============================ */
  function metersFromValueUnit(val, unit) {
    if (val === null || val === undefined || val === '') return null;
    if (unit === 'in') {
      const parsedInches = parseInchesInput(val);
      if (isNaN(parsedInches)) return null;
      return parsedInches * 0.0254;
    }
    const n = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(n)) return null;
    if (unit === 'mm') return n / 1000;
    if (unit === 'm') return n;
    return null;
  }

  function valueUnitFromMeters(m, unit) {
    if (m === null || m === undefined || isNaN(m)) return '';
    if (unit === 'in') return (m / 0.0254);
    if (unit === 'mm') return (m * 1000);
    return m;
  }

  /* ============================
     LOCAL STORAGE
     ============================ */
  function saveProjectROToLocal(meters) {
    try { localStorage.setItem(LOCAL_KEY_RO, String(meters)); projectRODefault_m = meters; } catch (e) {}
  }

  function loadProjectROFromLocal() {
    try {
      const v = localStorage.getItem(LOCAL_KEY_RO);
      if (v !== null) {
        const n = parseFloat(v);
        if (!isNaN(n)) projectRODefault_m = n;
      }
    } catch (e) {}
  }

  /* ============================
     RO CONTROLS CREATION & MANAGEMENT
     ============================ */
  function createROControlsIfMissing() {
    const widthLabelEl = safeEl('widthLabel');
    const insertBeforeEl = widthLabelEl ? widthLabelEl.parentElement : null;
    const parent = insertBeforeEl ? insertBeforeEl.parentElement : null;
    if (!parent) return;

    if (!safeEl('roOptionsContainer')) {
      const container = document.createElement('div');
      container.id = 'roOptionsContainer';
      container.style.marginTop = '8px';
      container.innerHTML = `
        <div style="font-weight:bold; margin-bottom:6px;">Rough Opening Options</div>
        <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
          <label style="display:flex; align-items:center; gap:6px;"><input type="radio" name="roMode" id="roUseDefaults" checked> Use System Defaults</label>
          <label style="display:flex; align-items:center; gap:6px;"><input type="radio" name="roMode" id="roCustomSettings"> Custom Settings</label>
        </div>
        <div id="roPresets" style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <button id="roPresetHalf" class="ro-preset-btn small">1/2\" / 12.7 mm</button>
          <button id="roPresetThreeQuarter" class="ro-preset-btn small">3/4\" / 19.1 mm</button>
          <button id="roPresetOne" class="ro-preset-btn small">1\" / 25.4 mm</button>
        </div>
        <div id="roCustomBlock" style="display:none; margin-top:6px;">
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; gap:6px; align-items:center;">
              <div style="font-size:13px;">Sides (per side)</div>
              <input id="roCustomSidesValue" type="text" style="width:110px; padding:6px;" placeholder="Value">
              <select id="roCustomSidesUnit" style="padding:6px;">
                <option value="in">in</option>
                <option value="mm">mm</option>
                <option value="m">m</option>
              </select>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <div style="font-size:13px;">Top (for doors only)</div>
              <input id="roCustomTopValue" type="text" style="width:110px; padding:6px;" placeholder="Value">
              <select id="roCustomTopUnit" style="padding:6px;">
                <option value="in">in</option>
                <option value="mm">mm</option>
                <option value="m">m</option>
              </select>
            </div>
            <div id="roCustomReadout" class="muted" style="margin-left:8px;"></div>
          </div>
        </div>
      `;
      parent.insertBefore(container, insertBeforeEl);

      const PRESETS = {
        half: { in: 0.5, m: 0.5 * 0.0254 },
        threeQuarter: { in: 0.75, m: 0.75 * 0.0254 },
        one: { in: 1.0, m: 1.0 * 0.0254 }
      };

      function clearPresetHighlights() {
        document.querySelectorAll('.ro-preset-btn').forEach(b => {
          b.style.border = '';
          b.style.backgroundColor = '';
        });
      }

      safeEl('roPresetHalf').addEventListener('click', function () {
        clearPresetHighlights();
        this.style.border = '2px solid #0078D4';
        this.style.backgroundColor = '#eef6ff';
        projectRODefault_m = PRESETS.half.m;
        saveProjectROToLocal(projectRODefault_m);
        updateROProjectUI(false);
        recomputeAll();
      });
      safeEl('roPresetThreeQuarter').addEventListener('click', function () {
        clearPresetHighlights();
        this.style.border = '2px solid #0078D4';
        this.style.backgroundColor = '#eef6ff';
        projectRODefault_m = PRESETS.threeQuarter.m;
        saveProjectROToLocal(projectRODefault_m);
        updateROProjectUI(false);
        recomputeAll();
      });
      safeEl('roPresetOne').addEventListener('click', function () {
        clearPresetHighlights();
        this.style.border = '2px solid #0078D4';
        this.style.backgroundColor = '#eef6ff';
        projectRODefault_m = PRESETS.one.m;
        saveProjectROToLocal(projectRODefault_m);
        updateROProjectUI(false);
        recomputeAll();
      });

      safeEl('roUseDefaults').addEventListener('change', function () {
        if (this.checked) {
          safeEl('roPresets').style.display = 'flex';
          safeEl('roCustomBlock').style.display = 'none';
          const per = safeEl('roPerOpeningContainer');
          if (per) per.style.display = 'none';
          recomputeAll();
        }
      });
      safeEl('roCustomSettings').addEventListener('change', function () {
        if (this.checked) {
          safeEl('roPresets').style.display = 'none';
          safeEl('roCustomBlock').style.display = 'block';
          const per = safeEl('roPerOpeningContainer');
          if (per) per.style.display = 'none';
          safeEl('roCustomSidesUnit').value = 'in';
          safeEl('roCustomTopUnit').value = 'in';
          safeEl('roCustomSidesValue').value = (projectRODefault_m / 0.0254).toFixed(3);
          safeEl('roCustomTopValue').value = (projectRODefault_m / 0.0254).toFixed(3);
          updateROCustomReadout();
          recomputeAll();
        }
      });

      ['roCustomSidesValue','roCustomSidesUnit','roCustomTopValue','roCustomTopUnit'].forEach(id => {
        const el = safeEl(id);
        if (!el) return;
        el.addEventListener('input', function () {
          updateROCustomReadout();
          recomputeAll();
        });
      });

      safeEl('roCustomSidesValue').addEventListener('change', function () {
        const m = metersFromValueUnit(safeEl('roCustomSidesValue').value, safeEl('roCustomSidesUnit').value);
        if (m !== null) {
          projectRODefault_m = m;
          saveProjectROToLocal(m);
          updateROProjectUI(true);
          recomputeAll();
          clearPresetHighlights();
        }
      });
      safeEl('roCustomTopValue').addEventListener('change', function () {
        updateROCustomReadout();
        recomputeAll();
      });
    }

    updateROProjectUI(true);
    updateROCustomReadout();
  }

  function updateROProjectUI(dontAutoSwitch) {
    if (!safeEl('roPresetHalf')) return;
    const tol = 1e-9;
    function approx(m, target) { return Math.abs(m - target) < tol; }
    document.querySelectorAll('.ro-preset-btn').forEach(b => { b.style.border = ''; b.style.backgroundColor = ''; });
    if (approx(projectRODefault_m, 0.0127)) {
      safeEl('roPresetHalf').style.border = '2px solid #0078D4'; safeEl('roPresetHalf').style.backgroundColor = '#eef6ff';
      if (!dontAutoSwitch) { safeEl('roUseDefaults').checked = true; safeEl('roPresets').style.display = 'flex'; safeEl('roCustomBlock').style.display = 'none'; }
    } else if (approx(projectRODefault_m, 0.01905)) {
      safeEl('roPresetThreeQuarter').style.border = '2px solid #0078D4'; safeEl('roPresetThreeQuarter').style.backgroundColor = '#eef6ff';
      if (!dontAutoSwitch) { safeEl('roUseDefaults').checked = true; safeEl('roPresets').style.display = 'flex'; safeEl('roCustomBlock').style.display = 'none'; }
    } else if (approx(projectRODefault_m, 0.0254)) {
      safeEl('roPresetOne').style.border = '2px solid #0078D4'; safeEl('roPresetOne').style.backgroundColor = '#eef6ff';
      if (!dontAutoSwitch) { safeEl('roUseDefaults').checked = true; safeEl('roPresets').style.display = 'flex'; safeEl('roCustomBlock').style.display = 'none'; }
    } else {
      if (!dontAutoSwitch) {
        safeEl('roCustomSettings').checked = true;
        safeEl('roPresets').style.display = 'none';
        safeEl('roCustomBlock').style.display = 'block';
      } else {
        if (safeEl('roCustomSettings') && safeEl('roCustomSettings').checked) {
          safeEl('roCustomSidesValue').value = (projectRODefault_m / 0.0254).toFixed(3);
          safeEl('roCustomSidesUnit').value = 'in';
          safeEl('roCustomTopValue').value = (projectRODefault_m / 0.0254).toFixed(3);
          safeEl('roCustomTopUnit').value = 'in';
        }
      }
    }
  }

  function updateROCustomReadout() {
    if (!safeEl('roCustomReadout')) return;
    const sidesVal = safeEl('roCustomSidesValue').value;
    const sidesUnit = safeEl('roCustomSidesUnit').value;
    const topVal = safeEl('roCustomTopValue').value;
    const topUnit = safeEl('roCustomTopUnit').value;
    const sides_m = metersFromValueUnit(sidesVal, sidesUnit);
    const top_m = metersFromValueUnit(topVal, topUnit);
    const parts = [];
    if (!isNaN(sides_m) && sides_m !== null) parts.push(`Sides: ${(sides_m/0.0254).toFixed(3)} in / ${(sides_m*1000).toFixed(2)} mm`);
    if (!isNaN(top_m) && top_m !== null) parts.push(`Top: ${(top_m/0.0254).toFixed(3)} in / ${(top_m*1000).toFixed(2)} mm`);
    safeEl('roCustomReadout').textContent = parts.join(' ; ');
  }

  /* ============================
     PER-OPENING OVERRIDE HELPERS
     ============================ */
  function createPerOpeningIfMissing() {
    if (safeEl('roPerOpeningContainer') || !safeEl('roOptionsContainer')) return;
    const perContainer = document.createElement('div');
    perContainer.id = 'roPerOpeningContainer';
    perContainer.style.marginTop = '8px';
    perContainer.style.display = 'none';
    perContainer.innerHTML = `
      <div style="font-size:14px; margin-bottom:6px;"><strong>Per-Opening Rough Opening Override (optional)</strong></div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <div style="font-size:13px; color:#666;">Leave blank to use project defaults</div>
      </div>
      <div id="roPerOpeningCustom" style="margin-top:8px;">
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="font-size:13px;">Sides (per side)</div>
            <input id="roPerSidesValue" type="text" style="width:110px; padding:6px;" placeholder="Value">
            <select id="roPerSidesUnit" style="padding:6px;">
              <option value="in">in</option>
              <option value="mm">mm</option>
              <option value="m">m</option>
            </select>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <div style="font-size:13px;">Top (for doors only)</div>
            <input id="roPerTopValue" type="text" style="width:110px; padding:6px;" placeholder="Value">
            <select id="roPerTopUnit" style="padding:6px;">
              <option value="in">in</option>
              <option value="mm">mm</option>
              <option value="m">m</option>
            </select>
          </div>
          <div id="roPerReadout" class="muted" style="margin-left:8px;"></div>
        </div>
      </div>
    `;
    const roOptions = safeEl('roOptionsContainer');
    roOptions.parentElement.insertBefore(perContainer, roOptions.nextSibling);

    const toggle = document.createElement('div');
    toggle.style.marginTop = '6px';
    toggle.innerHTML = `<button id="togglePerOpeningOverride" class="calc-button small">Enable per-opening override</button>`;
    roOptions.parentElement.insertBefore(toggle, perContainer);

    safeEl('togglePerOpeningOverride').addEventListener('click', function () {
      const per = safeEl('roPerOpeningContainer');
      if (!per) return;
      if (per.style.display === 'none' || per.style.display === '') {
        per.style.display = 'block';
        this.textContent = 'Disable per-opening override';
      } else {
        per.style.display = 'none';
        this.textContent = 'Enable per-opening override';
        ['roPerSidesValue','roPerTopValue'].forEach(id => { if (safeEl(id)) safeEl(id).value = ''; });
        updateROPerReadout();
        recomputeAll();
      }
    });

    ['roPerSidesValue','roPerSidesUnit','roPerTopValue','roPerTopUnit'].forEach(id => {
      const el = safeEl(id);
      if (!el) return;
      el.addEventListener('input', function () {
        updateROPerReadout();
        recomputeAll();
      });
    });

    ['roPerSidesValue','roPerTopValue','roPerSidesUnit','roPerTopUnit'].forEach(id => {
      const el = safeEl(id);
      if (!el) return;
      el.addEventListener('change', function () {
        updateROPerReadout();
        recomputeAll();
      });
    });

    updateROPerReadout();
  }

  function updateROPerReadout() {
    if (!safeEl('roPerReadout')) return;
    const sidesVal = safeEl('roPerSidesValue')?.value;
    const sidesUnit = safeEl('roPerSidesUnit')?.value;
    const topVal = safeEl('roPerTopValue')?.value;
    const topUnit = safeEl('roPerTopUnit')?.value;
    const sides_m = metersFromValueUnit(sidesVal, sidesUnit);
    const top_m = metersFromValueUnit(topVal, topUnit);
    const parts = [];
    if (!isNaN(sides_m) && sides_m !== null) parts.push(`Sides: ${(sides_m/0.0254).toFixed(3)} in / ${(sides_m*1000).toFixed(2)} mm`);
    if (!isNaN(top_m) && top_m !== null) parts.push(`Top: ${(top_m/0.0254).toFixed(3)} in / ${(top_m*1000).toFixed(2)} mm`);
    safeEl('roPerReadout').textContent = parts.join(' ; ');
  }

  /* ============================
     AREA & DIMENSION SYNCING
     ============================ */
  function syncFromMetricLive(idM, idFt) {
    console.log('🔄 syncFromMetricLive called:', idM, idFt);
    const mInput = safeEl(idM);
    const ftInput = safeEl(idFt);
    if (!mInput || !ftInput) return;
    const raw = mInput.value;
    const m = toNumber(raw);
    console.log('  Raw value:', raw, '→', m);
    if (m !== null) {
      if (document.activeElement !== mInput) {
        mInput.dataset.full = String(m);
      }
      const ftDecimal = mToFeetDecimal(m);
      if (document.activeElement !== ftInput && document.activeElement !== mInput) {
        ftInput.value = formatFeetFractional(ftDecimal);
      }
      console.log('  Calling recomputeAll()...');
      recomputeAll();
    } else {
      if (document.activeElement !== mInput) delete mInput.dataset.full;
      if (document.activeElement !== ftInput && document.activeElement !== mInput) ftInput.value = '';
      console.log('  Calling recomputeAll() (null value)...');
      recomputeAll();
    }
  }

  function syncFromMetricBlur(idM, idFt) {
    const mInput = safeEl(idM);
    const ftInput = safeEl(idFt);
    if (!mInput || !ftInput) return;
    const raw = mInput.value;
    const m = toNumber(raw);
    if (m !== null) {
      mInput.dataset.full = String(m);
      mInput.value = roundMetricDisplay(m).toFixed(4);
      const ftDecimal = mToFeetDecimal(m);
      ftInput.value = formatFeetFractional(ftDecimal);
      recomputeAll();
    } else {
      delete mInput.dataset.full;
      ftInput.value = '';
      recomputeAll();
    }
  }

  function syncFromImperialLive(idFt, idM) {
    const ftInput = safeEl(idFt);
    const mInput = safeEl(idM);
    if (!ftInput || !mInput) return;
    const ftVal = ftInput.value;
    const shouldParse = /["'\/\s\.]/.test(ftVal);
    if (!shouldParse) {
      recomputeAll();
      return;
    }
    const ftDecimal = parseFeetInput(ftVal);
    if (!isNaN(ftDecimal)) {
      if (document.activeElement !== ftInput) {
        const mVal = feetDecimalToM(ftDecimal);
        mInput.dataset.full = String(mVal);
        if (document.activeElement !== mInput) mInput.value = mVal.toFixed(6);
      }
      if (document.activeElement !== ftInput && document.activeElement !== mInput) {
        const mVal = feetDecimalToM(ftDecimal);
        mInput.value = mVal.toFixed(6);
      }
      recomputeAll();
    } else {
      if (document.activeElement !== mInput) delete mInput.dataset.full;
      recomputeAll();
    }
  }

  function syncFromImperialBlur(idFt, idM) {
    const ftInput = safeEl(idFt);
    const mInput = safeEl(idM);
    if (!ftInput || !mInput) return;
    const ftVal = ftInput.value;
    const ftDecimal = parseFeetInput(ftVal);
    if (!isNaN(ftDecimal)) {
      const mVal = feetDecimalToM(ftDecimal);
      mInput.dataset.full = String(mVal);
      ftInput.value = formatFeetFractional(ftDecimal);
      mInput.value = roundMetricDisplay(mVal).toFixed(4);
      recomputeAll();
    } else {
      delete mInput.dataset.full;
      mInput.value = '';
      recomputeAll();
    }
  }

  function syncAreaFromM2() {
      const m2 = toNumber(safeEl('openingArea_m2')?.value);
    if (m2 !== null) {
        safeEl('openingArea_ft2').value = (m2ToFt2(m2)).toFixed(2);
    } else {
        safeEl('openingArea_ft2').value = '';
    }
  }

  function syncAreaFromFt2() {
      const ft2 = toNumber(safeEl('openingArea_ft2')?.value);
    if (ft2 !== null) {
        safeEl('openingArea_m2').value = (ft2ToM2(ft2)).toFixed(2);
    } else {
        safeEl('openingArea_m2').value = '';
    }
  }

  /* ============================
     CORE: recomputeAll()
     ============================ */
  function recomputeAll() {
    console.log('⚙️ recomputeAll() called');
    const sizeMode = safeEl('openingActual')?.checked ? 'actual' : 'rough';
    const isWindow = safeEl('openingWindow')?.checked;
    const isDoor = safeEl('openingDoor')?.checked;

    const wMEl = safeEl('openingWidth_m');
    const hMEl = safeEl('openingHeight_m');
    let width_m = null, height_m = null;

    if (wMEl && wMEl.dataset && wMEl.dataset.full) {
      width_m = parseFloat(wMEl.dataset.full);
    } else {
      const wVal = toNumber(wMEl?.value);
      if (wVal !== null) width_m = wVal;
    }

    if (hMEl && hMEl.dataset && hMEl.dataset.full) {
      height_m = parseFloat(hMEl.dataset.full);
    } else {
      const hVal = toNumber(hMEl?.value);
      if (hVal !== null) height_m = hVal;
    }

    console.log('  Width:', width_m, 'Height:', height_m);

    if ((width_m === null || height_m === null)) {
      const wFtVal = safeEl('openingWidth_ft')?.value;
      const hFtVal = safeEl('openingHeight_ft')?.value;
      const wFtDec = parseFeetInput(wFtVal);
      const hFtDec = parseFeetInput(hFtVal);
      if (!isNaN(wFtDec)) width_m = feetDecimalToM(wFtDec);
      if (!isNaN(hFtDec)) height_m = feetDecimalToM(hFtDec);
      console.log('  After imperial check - Width:', width_m, 'Height:', height_m);
    }

    if (width_m !== null && height_m !== null) {
      console.log('  ✅ Both dimensions present, calculating area...');
      const per = getPerOpeningAllowanceMeters();
      const sides_m = per ? per.sides_m : projectRODefault_m;
      const top_m = per ? per.top_m : projectRODefault_m;

      let widthRO_m_unrounded, heightRO_m_unrounded;

      if (sizeMode === 'rough') {
        widthRO_m_unrounded = width_m;
        heightRO_m_unrounded = height_m;
      } else {
        widthRO_m_unrounded = width_m + 2 * sides_m;
        const isGlassBlock = safeEl('openingGlassBlock')?.checked;
        if (isWindow || isGlassBlock) {
          heightRO_m_unrounded = height_m + 2 * sides_m;
        } else {
          heightRO_m_unrounded = height_m + top_m;
        }
      }

      let area_m2_full = widthRO_m_unrounded * heightRO_m_unrounded;

      // Halve the area for glass block
      const isGlassBlock = safeEl('openingGlassBlock')?.checked;
      if (isGlassBlock) {
        area_m2_full = area_m2_full / 2;
      }

      const area_m2_display = roundTo(area_m2_full, 2);
      const area_ft2_display = roundTo(area_m2_full * SQFT_PER_M2, 2);

      // Always update area fields immediately (they're calculated outputs, not user inputs)
      console.log('🔢 Area calculation:', { width_m, height_m, widthRO_m_unrounded, heightRO_m_unrounded, area_m2_display, area_ft2_display });

      // Use requestAnimationFrame to force WebView repaint
      requestAnimationFrame(() => {
        if (safeEl('openingArea_m2')) {
          const areaM2Field = safeEl('openingArea_m2');
          const oldValue = areaM2Field.value;
          const newValue = area_m2_display.toFixed(2);

          // Force visual update by temporarily removing and re-setting value
          areaM2Field.value = '';
          setTimeout(() => {
            areaM2Field.value = newValue;
            areaM2Field.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Set openingArea_m2 to:', newValue);
          }, 0);
        }

        if (safeEl('openingArea_ft2')) {
          const areaFt2Field = safeEl('openingArea_ft2');
          const oldValue = areaFt2Field.value;
          const newValue = area_ft2_display.toFixed(2);

          // Force visual update by temporarily removing and re-setting value
          areaFt2Field.value = '';
          setTimeout(() => {
            areaFt2Field.value = newValue;
            areaFt2Field.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✅ Set openingArea_ft2 to:', newValue);
          }, 0);
        }
      });

      if (wMEl && wMEl.dataset && wMEl.dataset.full) {
        if (document.activeElement !== wMEl) wMEl.value = roundMetricDisplay(parseFloat(wMEl.dataset.full)).toFixed(2);
      } else if (wMEl) {
        if (document.activeElement !== wMEl) wMEl.value = roundMetricDisplay(width_m).toFixed(2);
        wMEl.dataset.full = String(width_m);
      }
      if (hMEl && hMEl.dataset && hMEl.dataset.full) {
        if (document.activeElement !== hMEl) hMEl.value = roundMetricDisplay(parseFloat(hMEl.dataset.full)).toFixed(2);
      } else if (hMEl) {
        if (document.activeElement !== hMEl) hMEl.value = roundMetricDisplay(height_m).toFixed(2);
        hMEl.dataset.full = String(height_m);
      }

      const wFtDisplay = formatFeetFractional(mToFeetDecimal(width_m));
      const hFtDisplay = formatFeetFractional(mToFeetDecimal(height_m));
      if (safeEl('openingWidth_ft') && document.activeElement !== safeEl('openingWidth_ft')) safeEl('openingWidth_ft').value = wFtDisplay;
      if (safeEl('openingHeight_ft') && document.activeElement !== safeEl('openingHeight_ft')) safeEl('openingHeight_ft').value = hFtDisplay;

      if (safeEl('roWidth_m')) safeEl('roWidth_m').textContent = roundMetricDisplay(widthRO_m_unrounded).toFixed(4) + ' m';
      if (safeEl('roHeight_m')) safeEl('roHeight_m').textContent = roundMetricDisplay(heightRO_m_unrounded).toFixed(4) + ' m';
      if (safeEl('roWidth_ft')) safeEl('roWidth_ft').textContent = formatFeetFractional(mToFeetDecimal(widthRO_m_unrounded));
      if (safeEl('roHeight_ft')) safeEl('roHeight_ft').textContent = formatFeetFractional(mToFeetDecimal(heightRO_m_unrounded));

      return;
    }

    // Clear area fields immediately if width/height incomplete
    if (safeEl('openingArea_m2')) safeEl('openingArea_m2').value = '';
    if (safeEl('openingArea_ft2')) safeEl('openingArea_ft2').value = '';
  }

  function getPerOpeningAllowanceMeters() {
    const perSidesVal = safeEl('roPerSidesValue')?.value;
    const perSidesUnit = safeEl('roPerSidesUnit')?.value;
    const perTopVal = safeEl('roPerTopValue')?.value;
    const perTopUnit = safeEl('roPerTopUnit')?.value;
    const perSides_m = metersFromValueUnit(perSidesVal, perSidesUnit);
    const perTop_m = metersFromValueUnit(perTopVal, perTopUnit);
    if ((perSidesVal && !isNaN(perSides_m) && perSides_m !== null) || (perTopVal && !isNaN(perTop_m) && perTop_m !== null)) {
      const sides_m = !isNaN(perSides_m) && perSides_m !== null ? perSides_m : projectRODefault_m;
      const top_m = !isNaN(perTop_m) && perTop_m !== null ? perTop_m : sides_m;
      return { sides_m, top_m };
    }

    if (safeEl('roCustomSettings') && safeEl('roCustomSettings').checked) {
      const projSidesVal = safeEl('roCustomSidesValue')?.value;
      const projSidesUnit = safeEl('roCustomSidesUnit')?.value;
      const projTopVal = safeEl('roCustomTopValue')?.value;
      const projTopUnit = safeEl('roCustomTopUnit')?.value;
      const projSides_m = metersFromValueUnit(projSidesVal, projSidesUnit);
      const projTop_m = metersFromValueUnit(projTopVal, projTopUnit);
      if ((projSidesVal && !isNaN(projSides_m) && projSides_m !== null) || (projTopVal && !isNaN(projTop_m) && projTop_m !== null)) {
        const sides_m = !isNaN(projSides_m) && projSides_m !== null ? projSides_m : projectRODefault_m;
        const top_m = !isNaN(projTop_m) && projTop_m !== null ? projTop_m : sides_m;
        return { sides_m, top_m };
      }
    }

    return { sides_m: projectRODefault_m, top_m: projectRODefault_m };
  }

  /* ============================
     OPENING & WALL FACE MANAGEMENT
     ============================ */
  function setPlaceholdersForDimensions(flag) {
    const wM = safeEl('openingWidth_m'), wF = safeEl('openingWidth_ft'), hM = safeEl('openingHeight_m'), hF = safeEl('openingHeight_ft');
    if (flag) {
      if (wM) wM.placeholder = "N/A";
      if (wF) wF.placeholder = "N/A";
      if (hM) hM.placeholder = "N/A";
      if (hF) hF.placeholder = "N/A";
    } else {
      if (wM) wM.placeholder = "Width (m)";
      if (wF) wF.placeholder = "Width (ft or 4'11.25\" or 59.25\")";
      if (hM) hM.placeholder = "Height (m)";
      if (hF) hF.placeholder = "Height (ft or 4'11.25\" or 59.25\")";
    }
  }

  function enforceRoughModeUI() {
    const roughRadio = safeEl('openingRough');
    if (roughRadio) roughRadio.checked = true;
    const roOptions = safeEl('roOptionsContainer');
    if (roOptions) roOptions.style.display = 'none';
    const per = safeEl('roPerOpeningContainer');
    if (per) {
      per.style.display = 'none';
      const toggle = safeEl('togglePerOpeningOverride');
      if (toggle) toggle.textContent = 'Enable per-opening override';
      ['roPerSidesValue','roPerTopValue'].forEach(id => { if (safeEl(id)) safeEl(id).value = ''; });
      updateROPerReadout();
    }
    recomputeAll();
  }

  function clearAll() {
    ['projName','projLocation','projClient','projUser','projDate'].forEach(id => { if (safeEl(id)) safeEl(id).value = ''; });
    const sel = safeEl('tableSelect');
    if (sel) { sel.disabled = false; tableSelectInitial = null; }
    projectLocked = false;
    if (safeEl('tableLockedNote')) safeEl('tableLockedNote').style.display = 'none';
    wallFaces = [];
    currentOpenings = [];
      ['wallFaceName', 'openingWidth_m', 'openingWidth_ft', 'openingHeight_m', 'openingHeight_ft', 'openingArea_m2','openingArea_ft2'].forEach(id => { if (safeEl(id)) safeEl(id).value = ''; if (safeEl(id)) delete safeEl(id).dataset.full; });
    setPlaceholdersForDimensions(false);
    if (safeEl('projectReportContent')) safeEl('projectReportContent').innerHTML = '<p style="font-style:italic; color:#555;">Enter inputs above and click "Add Wall Face", then use the export buttons to copy or download the report.</p>';
    if (safeEl('wallFaceNameDisplay')) safeEl('wallFaceNameDisplay').textContent = '—';
    if (safeEl('totalAreaFace_m2')) safeEl('totalAreaFace_m2').textContent = '—';
    if (safeEl('totalAreaFace_ft2')) safeEl('totalAreaFace_ft2').textContent = '—';
    areaEnteredManually = false;

    // Reset radio buttons to defaults when New Project is clicked
    if (safeEl('openingWindow')) safeEl('openingWindow').checked = true;
    if (safeEl('openingRough')) safeEl('openingRough').checked = true;

    renderCurrentOpeningsList();
  }

  function clearInputExceptWallFace() {
    const keep = safeEl('wallFaceName')?.value || '';
    if (safeEl('wallFaceName')) safeEl('wallFaceName').value = keep;
    // DO NOT reset openingType or sizeMode radio buttons - preserve user's selection
      ['openingWidth_m', 'openingWidth_ft', 'openingHeight_m', 'openingHeight_ft', 'openingArea_m2','openingArea_ft2'].forEach(id => {
      if (safeEl(id)) safeEl(id).value = '';
      if (safeEl(id)) delete safeEl(id).dataset.full;
    });
    // Reset quantity to 1
    if (safeEl('openingQuantity')) safeEl('openingQuantity').value = '1';
    setPlaceholdersForDimensions(false);
    areaEnteredManually = false;
    if (safeEl('wallFaceNameDisplay')) safeEl('wallFaceNameDisplay').textContent = safeEl('wallFaceName')?.value || '—';
  }

  function renderCurrentOpeningsList() {
    const container = safeEl('currentOpeningsList');
    if (!container) return;
    container.innerHTML = '';
    if (currentOpenings.length === 0) {
      container.innerHTML = '<div class="muted">No openings added to this wall face yet.</div>';
      if (safeEl('totalAreaFace_m2')) safeEl('totalAreaFace_m2').textContent = '—';
      if (safeEl('totalAreaFace_ft2')) safeEl('totalAreaFace_ft2').textContent = '—';
      return;
    }
    let total_m2_precise = 0;
    currentOpenings.forEach((op, idx) => {
      total_m2_precise += (op.area_m2_full || 0);
      const div = document.createElement('div');
      div.className = 'report-line';
      const left = document.createElement('div'); left.className = 'left';
      const right = document.createElement('div'); right.className = 'right';
      const dimsMetric = (op.width_m !== null && op.height_m !== null) ? `${op.width_m.toFixed(4)} m x ${op.height_m.toFixed(4)} m` : 'N/A';
      const dimsImperial = (op.width_ft_display && op.height_ft_display) ? `${op.width_ft_display} x ${op.height_ft_display}` : 'N/A';
      const roMetric = (op.widthRO_m_display && op.heightRO_m_display) ? `${op.widthRO_m_display.toFixed(4)} m x ${op.heightRO_m_display.toFixed(4)} m` : 'N/A';
      const roImperial = (op.widthRO_ft_display && op.heightRO_ft_display) ? `${op.widthRO_ft_display} x ${op.heightRO_ft_display}` : 'N/A';
      left.innerHTML = `<strong>Opening ${idx+1}:</strong> ${escapeHtml(op.typeLabel)} ${dimsMetric} / ${dimsImperial} <br><span class="muted">(RO ${roMetric} / ${roImperial})</span>`;

      // For glass block, show actual area in brackets
      let areaDisplay = `${(op.area_m2_display || 0).toFixed(2)} m² / ${(op.area_ft2_display || 0).toFixed(2)} ft²`;
      if (op.type === 'glassblock' && op.area_m2_full_before_halving) {
        const actualM2 = op.area_m2_full_before_halving.toFixed(2);
        const actualFt2 = (op.area_m2_full_before_halving * SQFT_PER_M2).toFixed(2);
        areaDisplay = `${(op.area_m2_display || 0).toFixed(2)} m² / ${(op.area_ft2_display || 0).toFixed(2)} ft² <span class="muted">(Actual: ${actualM2} m² / ${actualFt2} ft²)</span>`;
      }
      right.innerHTML = `${areaDisplay} <button class="trash-btn" data-idx="${idx}" title="Delete opening">🗑</button>`;
      div.appendChild(left); div.appendChild(right);
      container.appendChild(div);
    });
    const total_ft2_precise = total_m2_precise * SQFT_PER_M2;
    if (safeEl('totalAreaFace_m2')) safeEl('totalAreaFace_m2').textContent = total_m2_precise.toFixed(2) + ' m²';
    if (safeEl('totalAreaFace_ft2')) safeEl('totalAreaFace_ft2').textContent = total_ft2_precise.toFixed(2) + ' ft²';

    container.querySelectorAll('.trash-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx = parseInt(this.getAttribute('data-idx'),10);
        if (!isNaN(idx)) {
          currentOpenings.splice(idx, 1);
          renderCurrentOpeningsList();
        }
      });
    });

    // Update Column 3 aggregate display
    if (typeof window.updateAggregateDisplay === 'function') {
      window.updateAggregateDisplay();
    }
  }

  function addOpeningToCurrentWallFace() {
    if (!projectLocked) {
      const sel = safeEl('tableSelect');
      if (sel) {
        sel.disabled = true;
        tableSelectInitial = sel.value;
        projectLocked = true;
        if (safeEl('tableLockedNote')) safeEl('tableLockedNote').style.display = 'block';
      }
    }

    // Auto-generate default wall face name if none exists
    const wallFaceNameEl = safeEl('wallFaceName');
    if (wallFaceNameEl && !wallFaceNameEl.value.trim()) {
      // Generate default name based on existing wall faces count
      const defaultName = `Wall Face ${wallFaces.length + 1}`;
      wallFaceNameEl.value = defaultName;
      console.log(`✅ Auto-generated default wall face name: "${defaultName}"`);

      // Update the display as well
      if (safeEl('wallFaceNameDisplay')) {
        safeEl('wallFaceNameDisplay').textContent = defaultName;
      }
    }

    // Get quantity - default to 1 if not specified or invalid
    const quantityEl = safeEl('openingQuantity');
    let quantity = 1;
    if (quantityEl) {
      const qtyValue = parseInt(quantityEl.value, 10);
      if (!isNaN(qtyValue) && qtyValue > 0) {
        quantity = qtyValue;
      }
    }

    let type = 'door'; // default
    if (safeEl('openingWindow')?.checked) type = 'window';
    else if (safeEl('openingGlassBlock')?.checked) type = 'glassblock';

    // Dynamic label based on selected table
    let typeLabel;
    if (type === 'window') {
      typeLabel = 'Window';
    } else if (type === 'door') {
      typeLabel = 'Door';
    } else if (type === 'glassblock') {
      const tableSelect = safeEl('tableSelect');
      typeLabel = (tableSelect && tableSelect.value === 'Opt1') ? 'Glass Block' : 'Wired Glass/Glass Block';
    }
    const sizeMode = safeEl('openingActual')?.checked ? 'actual' : 'rough';

      const area_m2_input = toNumber(safeEl('openingArea_m2')?.value);

    let width_m = null, height_m = null;
    let width_ft_display = '', height_ft_display = '';

    if (sizeMode === 'rough' && areaEnteredManually && area_m2_input !== null) {
      // For glass block, halve the area regardless of entry mode
      const area_m2_actual = area_m2_input;
      const area_m2_display = type === 'glassblock' ? roundTo(area_m2_input / 2, 2) : roundTo(area_m2_input, 2);
      const area_ft2_display = roundTo(area_m2_display * SQFT_PER_M2, 2);
      const area_m2_full_before_halving = type === 'glassblock' ? area_m2_input : null;
      const opening = {
        type, typeLabel,
        width_m: null, height_m: null,
        widthRO_m_display: null, heightRO_m_display: null,
        width_ft_display: 'N/A', height_ft_display: 'N/A',
        widthRO_ft_display: 'N/A', heightRO_ft_display: 'N/A',
        area_m2_display, area_ft2_display,
        area_m2_full_before_halving
      };
      // Add the opening 'quantity' times
      for (let i = 0; i < quantity; i++) {
        currentOpenings.push({...opening}); // Use spread to create a copy for each
      }
      renderCurrentOpeningsList();
      clearInputExceptWallFace();
      enforceRoughModeUI();
      return;
    }

    const wMEl = safeEl('openingWidth_m');
    const hMEl = safeEl('openingHeight_m');
    if (wMEl && wMEl.dataset && wMEl.dataset.full) {
      width_m = parseFloat(wMEl.dataset.full);
      const ftW = mToFeetDecimal(width_m);
      width_ft_display = formatFeetFractional(ftW);
    }
    if (hMEl && hMEl.dataset && hMEl.dataset.full) {
      height_m = parseFloat(hMEl.dataset.full);
      const ftH = mToFeetDecimal(height_m);
      height_ft_display = formatFeetFractional(ftH);
    }

    if (width_m === null || height_m === null) {
      const wMVal = safeEl('openingWidth_m')?.value;
      const hMVal = safeEl('openingHeight_m')?.value;
      const wM = toNumber(wMVal);
      const hM = toNumber(hMVal);
      if (wM !== null && hM !== null) {
        width_m = wM;
        height_m = hM;
        const ftW = mToFeetDecimal(width_m);
        const ftH = mToFeetDecimal(height_m);
        width_ft_display = formatFeetFractional(ftW);
        height_ft_display = formatFeetFractional(ftH);
      } else {
        const wFVal = safeEl('openingWidth_ft')?.value;
        const hFVal = safeEl('openingHeight_ft')?.value;
        const wFtDec = parseFeetInput(wFVal);
        const hFtDec = parseFeetInput(hFVal);
        if (!isNaN(wFtDec) && !isNaN(hFtDec)) {
          width_m = feetDecimalToM(wFtDec);
          height_m = feetDecimalToM(hFtDec);
          width_ft_display = formatFeetFractional(wFtDec);
          height_ft_display = formatFeetFractional(hFtDec);
        } else {
          alert('Please enter valid width and height (either metric or imperial), or enter area directly for rough openings.');
          return;
        }
      }
    }

    const per = getPerOpeningAllowanceMeters();

    const ro = computeRO(width_m, height_m, type, sizeMode, per);
    const widthRO_m_unrounded = ro.widthRO_m_unrounded;
    const heightRO_m_unrounded = ro.heightRO_m_unrounded;
    const widthRO_m_display = ro.widthRO_m_display;
    const heightRO_m_display = ro.heightRO_m_display;

    let area_m2_full = calculateAreaFromDimensionsUnrounded(widthRO_m_unrounded, heightRO_m_unrounded);
    const area_m2_full_before_halving = (type === 'glassblock' && area_m2_full !== null) ? area_m2_full : null;

    // Halve the area for glass block
    if (type === 'glassblock' && area_m2_full !== null) {
      area_m2_full = area_m2_full / 2;
    }

    const area_m2_display = area_m2_full !== null ? roundTo(area_m2_full, 2) : 0;
    const area_ft2_display = area_m2_full !== null ? roundTo(area_m2_full * SQFT_PER_M2, 2) : 0;

    const widthRO_ft_display = widthRO_m_unrounded ? formatFeetFractional(mToFeetDecimal(widthRO_m_unrounded)) : '';
    const heightRO_ft_display = heightRO_m_unrounded ? formatFeetFractional(mToFeetDecimal(heightRO_m_unrounded)) : '';

    const opening = {
      type, typeLabel,
      width_m, height_m,
      widthRO_m_unrounded, heightRO_m_unrounded,
      widthRO_m_display, heightRO_m_display,
      width_ft_display, height_ft_display,
      widthRO_ft_display, heightRO_ft_display,
      area_m2_full: area_m2_full !== null ? area_m2_full : 0,
      area_m2_display,
      area_ft2_display,
      area_m2_full_before_halving
    };

    // Add the opening 'quantity' times - each as a unique opening
    for (let i = 0; i < quantity; i++) {
      currentOpenings.push({...opening}); // Use spread to create a copy for each
    }
    renderCurrentOpeningsList();
    clearInputExceptWallFace();
    // DO NOT call enforceRoughModeUI() - preserve user's sizeMode selection
  }

  function computeRO(width_m, height_m, type, sizeMode, perOpeningAllowance) {
    const per = perOpeningAllowance || { sides_m: projectRODefault_m, top_m: projectRODefault_m };
    if (sizeMode === 'rough') {
      return {
        widthRO_m_unrounded: width_m,
        heightRO_m_unrounded: height_m,
        widthRO_m_display: roundMetricDisplay(width_m),
        heightRO_m_display: roundMetricDisplay(height_m)
      };
    }
    if (type === 'window' || type === 'glassblock') {
      const w = width_m + 2 * per.sides_m;
      const h = height_m + 2 * per.sides_m;
      return {
        widthRO_m_unrounded: w,
        heightRO_m_unrounded: h,
        widthRO_m_display: roundMetricDisplay(w),
        heightRO_m_display: roundMetricDisplay(h)
      };
    } else {
      const w = width_m + 2 * per.sides_m;
      const h = height_m + per.top_m;
      return {
        widthRO_m_unrounded: w,
        heightRO_m_unrounded: h,
        widthRO_m_display: roundMetricDisplay(w),
        heightRO_m_display: roundMetricDisplay(h)
      };
    }
  }

  function calculateAreaFromDimensionsUnrounded(width_m_unrounded, height_m_unrounded) {
    if (width_m_unrounded === null || height_m_unrounded === null || isNaN(width_m_unrounded) || isNaN(height_m_unrounded)) return null;
    return width_m_unrounded * height_m_unrounded;
  }

  /* ============================
     REPORT & EXPORT
     ============================ */
  function appendWallFaceToReport(wf, index) {
    const container = safeEl('projectReportContent');
    if (!container) return;
    const block = document.createElement('div');
    block.className = 'project-report-section wall-face-block';
    block.setAttribute('data-wf-index', index - 1);

    const headingRow = document.createElement('div');
    headingRow.style.display = 'flex';
    headingRow.style.justifyContent = 'space-between';
    headingRow.style.alignItems = 'center';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.textContent = wf.name || ('Wall Face ' + index);
    headingRow.appendChild(heading);

    const delBtn = document.createElement('button');
    delBtn.className = 'calc-button';
    delBtn.style.backgroundColor = '#c00';
    delBtn.style.borderRadius = '8px';
    delBtn.style.padding = '6px 10px';
    delBtn.style.fontSize = '13px';
    delBtn.textContent = 'Delete Wall Face';
    delBtn.title = 'Delete this finalized wall face from the report';
    delBtn.addEventListener('click', function () {
      if (!confirm('Delete this wall face and all its openings from the project report?')) return;
      const idx = parseInt(block.getAttribute('data-wf-index'), 10);
      if (!isNaN(idx)) {
        wallFaces.splice(idx, 1);
        regenerateFullReport();
      }
    });
    headingRow.appendChild(delBtn);

    block.appendChild(headingRow);

    wf.openings.forEach((op, i) => {
      const row = document.createElement('div');
      row.className = 'info-row';
      const label = document.createElement('div'); label.className = 'label';
      label.textContent = 'Opening ' + (i+1) + ':';
      const value = document.createElement('div'); value.className = 'value';
      const dimsMetric = op.width_m ? `${op.width_m.toFixed(4)} m x ${op.height_m.toFixed(4)} m` : 'N/A';
      const dimsImperial = (op.width_ft_display && op.height_ft_display) ? `${op.width_ft_display} x ${op.height_ft_display}` : 'N/A';
      const roMetric = (op.widthRO_m_display && op.heightRO_m_display) ? `${op.widthRO_m_display.toFixed(4)} m x ${op.heightRO_m_display.toFixed(4)} m` : 'N/A';
      const roImperial = (op.widthRO_ft_display && op.heightRO_ft_display) ? `${op.widthRO_ft_display} x ${op.heightRO_ft_display}` : 'N/A';

      // For glass block, show actual area in brackets
      let areaText = `Area-${(op.area_m2_display||0).toFixed(2)} m² / ${(op.area_ft2_display||0).toFixed(2)} ft²`;
      if (op.type === 'glassblock' && op.area_m2_full_before_halving) {
        const actualM2 = op.area_m2_full_before_halving.toFixed(2);
        const actualFt2 = (op.area_m2_full_before_halving * SQFT_PER_M2).toFixed(2);
        areaText = `Area-${(op.area_m2_display||0).toFixed(2)} m² / ${(op.area_ft2_display||0).toFixed(2)} ft² [Actual: ${actualM2} m² / ${actualFt2} ft²]`;
      }

      value.innerHTML = `${op.typeLabel} ${dimsMetric} / ${dimsImperial} (RO ${roMetric} / ${roImperial}) ${areaText}`;
      row.appendChild(label); row.appendChild(value);
      block.appendChild(row);
    });

    const totalRow = document.createElement('div');
    totalRow.className = 'info-row section-divider';
    const tlabel = document.createElement('div'); tlabel.className = 'label'; tlabel.textContent = 'Total Area of Openings:';
    const tvalue = document.createElement('div'); tvalue.className = 'value'; tvalue.textContent = `${wf.totalAreaFace_m2.toFixed(2)} m² / ${wf.totalAreaFace_ft2.toFixed(2)} ft²`;
    totalRow.appendChild(tlabel); totalRow.appendChild(tvalue);
    block.appendChild(totalRow);

    container.appendChild(block);
  }

  function regenerateFullReport() {
    const container = safeEl('projectReportContent');
    if (!container) return;
    container.innerHTML = '';

    const header = document.createElement('div');
    header.style.marginBottom = '8px';
    header.innerHTML = `<div style="font-weight:bold; margin-bottom:8px;">UNPROTECTED AND GLAZED OPENINGS CALCULATIONS</div><div>BCABD BC Association of Building Designers</div><div style="margin-top:8px; font-style:italic;">${escapeHtml(safeEl('disclaimer') ? (safeEl('disclaimer').innerText || '') : '')}</div><hr>`;
    container.appendChild(header);

    const projBlock = document.createElement('div');
    projBlock.className = 'project-report-section';
    projBlock.innerHTML = `<div class="section-heading">PROJECT INFORMATION</div>
      <div class="info-row"><div class="label">PROJECT NAME</div><div class="value">${escapeHtml(safeEl('projName')?.value || '—')}</div></div>
      <div class="info-row"><div class="label">PROJECT LOCATION/ADDRESS</div><div class="value">${escapeHtml(safeEl('projLocation')?.value || '—')}</div></div>
      <div class="info-row"><div class="label">CLIENT NAME</div><div class="value">${escapeHtml(safeEl('projClient')?.value || '—')}</div></div>
      <div class="info-row"><div class="label">DESIGNER/USER</div><div class="value">${escapeHtml(safeEl('projUser')?.value || '—')}</div></div>
      <div class="info-row"><div class="label">DATE</div><div class="value">${escapeHtml(safeEl('projDate')?.value || '—')}</div></div>
      <div class="info-row"><div class="label">BUILDING CLASSIFICATION</div><div class="value">${escapeHtml(getTableSelectLabel())}</div></div>
      <div class="info-row"><div class="label">PROJECT RO ALLOWANCE (per side)</div><div class="value">${(projectRODefault_m/0.0254).toFixed(3)} in / ${(projectRODefault_m*1000).toFixed(2)} mm / ${projectRODefault_m.toFixed(5)} m</div></div>`;
    container.appendChild(projBlock);

    wallFaces.forEach((wf, idx) => {
      appendWallFaceToReport(wf, idx+1);
    });

    if (currentOpenings.length > 0) {
      const temp_m2_precise = currentOpenings.reduce((s,o)=>s+(o.area_m2_full||0),0);
      const temp = { name: safeEl('wallFaceName')?.value || 'Current Wall Face', openings: currentOpenings.slice(), totalAreaFace_m2_precise: temp_m2_precise, totalAreaFace_m2: roundTo(temp_m2_precise, 2), totalAreaFace_ft2: roundTo(temp_m2_precise * SQFT_PER_M2, 2) };
      appendWallFaceToReport(temp, wallFaces.length + 1);
    }

    // Add disclaimer if any glass block openings are present
    const hasGlassBlock = wallFaces.some(wf => wf.openings.some(op => op.type === 'glassblock')) || 
                          currentOpenings.some(op => op.type === 'glassblock');
    if (hasGlassBlock) {
      const disclaimer = document.createElement('div');
      disclaimer.style.marginTop = '20px';
      disclaimer.style.padding = '10px';
      disclaimer.style.backgroundColor = '#fff3cd';
      disclaimer.style.border = '1px solid #ffc107';
      disclaimer.style.borderRadius = '4px';
      disclaimer.style.fontStyle = 'italic';
      disclaimer.innerHTML = '<strong>Note:</strong> Area results for Wired Glass or Glass Block openings are shown as 50% of the actual size.';
      container.appendChild(disclaimer);
    }
  }

  function buildReportLines() {
    const lines = [];
    const projName = safeEl('projName')?.value || "—";
    const projLocation = safeEl('projLocation')?.value || "—";
    const projClient = safeEl('projClient')?.value || "—";
    const projUser = safeEl('projUser')?.value || "—";
    const projDate = safeEl('projDate')?.value || "—";
    lines.push("UNPROTECTED AND GLAZED OPENINGS CALCULATIONS");
    lines.push("BCABD BC Association of Building Designers");
    const disclaimerText = safeEl('disclaimer') ? (safeEl('disclaimer').innerText || '') : '';
    if (disclaimerText) lines.push(disclaimerText);
    lines.push("");
    lines.push("PROJECT INFORMATION");
    lines.push("PROJECT NAME: " + projName);
    lines.push("PROJECT LOCATION/ADDRESS: " + projLocation);
    lines.push("CLIENT NAME: " + projClient);
    lines.push("DESIGNER/USER: " + projUser);
    lines.push("DATE: " + projDate);
    lines.push("BUILDING CLASSIFICATION: " + getTableSelectLabel());
    lines.push("PROJECT RO ALLOWANCE (per side): " + (projectRODefault_m/0.0254).toFixed(3) + " in / " + (projectRODefault_m*1000).toFixed(2) + " mm / " + projectRODefault_m.toFixed(5) + " m");
    lines.push("");

    wallFaces.forEach((wf, index) => {
      lines.push("WALL FACE " + (index+1) + ": " + (wf.name || "—"));
      wf.openings.forEach((op, i) => {
        const dimsMetric = op.width_m ? `${op.width_m.toFixed(4)} m x ${op.height_m.toFixed(4)} m` : 'N/A';
        const dimsImperial = (op.width_ft_display && op.height_ft_display) ? `${op.width_ft_display} x ${op.height_ft_display}` : 'N/A';
        const roMetric = (op.widthRO_m_display && op.heightRO_m_display) ? `${op.widthRO_m_display.toFixed(4)} m x ${op.heightRO_m_display.toFixed(4)} m` : 'N/A';
        const roImperial = (op.widthRO_ft_display && op.heightRO_ft_display) ? `${op.widthRO_ft_display} x ${op.heightRO_ft_display}` : 'N/A';

        let areaText = `Area-${(op.area_m2_display||0).toFixed(2)} m² / ${(op.area_ft2_display||0).toFixed(2)} ft²`;
        if (op.type === 'glassblock' && op.area_m2_full_before_halving) {
          const actualM2 = op.area_m2_full_before_halving.toFixed(2);
          const actualFt2 = (op.area_m2_full_before_halving * SQFT_PER_M2).toFixed(2);
          areaText = `Area-${(op.area_m2_display||0).toFixed(2)} m² / ${(op.area_ft2_display||0).toFixed(2)} ft² [Actual: ${actualM2} m² / ${actualFt2} ft²]`;
        }

        lines.push(`Opening ${i+1}: ${op.typeLabel} ${dimsMetric} / ${dimsImperial} (RO ${roMetric} / ${roImperial}) ${areaText}`);
      });
      lines.push("Total Area of Openings: " + (wf.totalAreaFace_m2 ?? "—") + " m² / " + (wf.totalAreaFace_ft2 ?? "—") + " ft²");
      lines.push("");
    });

    if (currentOpenings.length > 0) {
      lines.push("CURRENT WALL FACE: " + (safeEl('wallFaceName')?.value || '—'));
      currentOpenings.forEach((op, i) => {
        const dimsMetric = op.width_m ? `${op.width_m.toFixed(4)} m x ${op.height_m.toFixed(4)} m` : 'N/A';
        const dimsImperial = (op.width_ft_display && op.height_ft_display) ? `${op.width_ft_display} x ${op.height_ft_display}` : 'N/A';
        const roMetric = (op.widthRO_m_display && op.heightRO_m_display) ? `${op.widthRO_m_display.toFixed(4)} m x ${op.heightRO_m_display.toFixed(4)} m` : 'N/A';
        const roImperial = (op.widthRO_ft_display && op.heightRO_ft_display) ? `${op.widthRO_ft_display} x ${op.heightRO_ft_display}` : 'N/A';

        let areaText = `Area-${(op.area_m2_display||0).toFixed(2)} m² / ${(op.area_ft2_display||0).toFixed(2)} ft²`;
        if (op.type === 'glassblock' && op.area_m2_full_before_halving) {
          const actualM2 = op.area_m2_full_before_halving.toFixed(2);
          const actualFt2 = (op.area_m2_full_before_halving * SQFT_PER_M2).toFixed(2);
          areaText = `Area-${(op.area_m2_display||0).toFixed(2)} m² / ${(op.area_ft2_display||0).toFixed(2)} ft² [Actual: ${actualM2} m² / ${actualFt2} ft²]`;
        }

        lines.push(`Opening ${i+1}: ${op.typeLabel} ${dimsMetric} / ${dimsImperial} (RO ${roMetric} / ${roImperial}) ${areaText}`);
      });
      const t_m = currentOpenings.reduce((s,o)=>s+(o.area_m2_display||0),0);
      const t_f = currentOpenings.reduce((s,o)=>s+(o.area_ft2_display||0),0);
      lines.push("Total Area of Openings (current): " + t_m.toFixed(2) + " m² / " + t_f.toFixed(2) + " ft²");
      lines.push("");
    }

    // Add disclaimer if any glass block openings are present
    const hasGlassBlock = wallFaces.some(wf => wf.openings.some(op => op.type === 'glassblock')) || 
                          currentOpenings.some(op => op.type === 'glassblock');
    if (hasGlassBlock) {
      lines.push("NOTE: Area results for Wired Glass or Glass Block openings are shown as 50% of the actual size.");
      lines.push("");
    }

    return lines;
  }

  function copyReportToClipboard(btn) {
    const lines = buildReportLines();
    const text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = orig; }, 1500);
        }
      }).catch(function () { fallbackCopyText(text, btn); });
    } else {
      fallbackCopyText(text, btn);
    }
  }

  function fallbackCopyText(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = orig; }, 1500);
      }
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function setupPDFButton() {
    const btn = safeEl('downloadPDFUO');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!window.jspdf) {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = () => generatePDF();
        s.onerror = () => alert('Unable to load PDF library.');
        document.head.appendChild(s);
      } else {
        generatePDF();
      }
    });
  }

  function generatePDF() {
    if (!window.jspdf) { alert('PDF library not loaded.'); return; }
    const { jsPDF } = window.jspdf;
    const lines = buildReportLines();
    const pdf = new jsPDF('p', 'mm', 'letter');
    const fontFamily = 'helvetica';
    const fontSize = 10;
    const lineHeight = 6;
    const marginLeft = 18;
    const marginRight = 18;
    const marginTop = 18;
    const marginBottom = 18;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - marginLeft - marginRight;
    let y = marginTop;

    function ensureSpace(required = lineHeight) {
      if (y + required > pageHeight - marginBottom) {
        pdf.addPage();
        y = marginTop;
      }
    }

    function renderLine(text, opts = {}) {
      if (!text) return;
      const wrapped = pdf.splitTextToSize(String(text), usableWidth);
      wrapped.forEach(line => {
        ensureSpace(lineHeight);
        pdf.text(line, marginLeft, y);
        y += lineHeight;
      });
    }

    if (lines.length > 0) {
      pdf.setFont(fontFamily, 'bold'); pdf.setFontSize(fontSize+1);
      renderLine(lines[0]);
      pdf.setFont(fontFamily, 'normal'); pdf.setFontSize(fontSize);
    }
    for (let i = 1; i < lines.length; i++) {
      renderLine(lines[i]);
    }

    const pageCount = pdf.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      pdf.setPage(p);
      const footerText = 'Page ' + p + ' of ' + pageCount;
      pdf.setFontSize(9);
      const textWidth = pdf.getTextWidth(footerText);
      const x = (pageWidth - textWidth) / 2;
      const footerY = pageHeight - (marginBottom / 2);
      pdf.text(footerText, x, footerY);
    }

    pdf.save('BCABD-Unprotected-or-Glazed-Openings-Report.pdf');
  }

  /* ============================
     INITIALIZE & EVENT BINDING
     ============================ */
  function updateActualNote() {
    const noteEl = safeEl('actualNote');
    if (!noteEl) return;
    if (safeEl('openingActual') && safeEl('openingActual').checked) {
      noteEl.textContent = 'Area calculated will be adjusted using rough opening allowances.';
    } else {
      noteEl.textContent = 'Area entered as rough opening; width/height fields will be used as-is.';
    }
  }

  function getTableSelectLabel() {
    const sel = safeEl('tableSelect');
    if (!sel) return '—';
    const opt = sel.options[sel.selectedIndex];
    return opt ? (opt.textContent || opt.innerText || opt.value) : sel.value;
  }

  function updateLabelsForOpeningClass() {
    const cls = getTableSelectLabel();
    const labelEls = document.querySelectorAll('.building-class-label');
    labelEls.forEach(el => { el.textContent = cls; });
  }

  function finalizeCurrentWallFace() {
    console.log('🏗️ ========== FINALIZE WALL FACE CALLED ==========');
    const name = safeEl('wallFaceName')?.value || ('Wall Face ' + (wallFaces.length + 1));
    console.log('  📝 Wall Face Name:', name);
    console.log('  📊 Current Openings Count:', currentOpenings.length);
    console.log('  📦 Existing Wall Faces Count BEFORE:', wallFaces.length);

    if (currentOpenings.length === 0) {
      alert('No openings have been added to this wall face.');
      return;
    }
    let total_m2_precise = 0;
    currentOpenings.forEach(op => { total_m2_precise += (op.area_m2_full || 0); });
    const total_ft2_precise = total_m2_precise * SQFT_PER_M2;

    const wf = {
      name,
      openings: currentOpenings.slice(),
      totalAreaFace_m2_precise: total_m2_precise,
      totalAreaFace_m2: roundTo(total_m2_precise, 2),
      totalAreaFace_ft2: roundTo(total_ft2_precise, 2)
    };

    console.log('  ✅ Created wall face object:', wf);
    wallFaces.push(wf);
    console.log('  📦 Wall Faces Count AFTER push:', wallFaces.length);
    console.log('  📋 ALL Wall Faces:', JSON.stringify(wallFaces, null, 2));

    appendWallFaceToReport(wf, wallFaces.length);

    // Update Column 3 wall faces list display
    if (typeof window.updateWallFacesList === 'function') {
      window.updateWallFacesList(wallFaces);
    }

    currentOpenings = [];
    if (safeEl('wallFaceName')) safeEl('wallFaceName').value = '';
    renderCurrentOpeningsList();
    if (safeEl('wallFaceNameDisplay')) safeEl('wallFaceNameDisplay').textContent = '—';
    if (safeEl('totalAreaFace_m2')) safeEl('totalAreaFace_m2').textContent = '—';
    if (safeEl('totalAreaFace_ft2')) safeEl('totalAreaFace_ft2').textContent = '—';

    // Reset radio buttons to defaults when wall face is finalized
    if (safeEl('openingWindow')) safeEl('openingWindow').checked = true;
    if (safeEl('openingRough')) safeEl('openingRough').checked = true;
    recomputeAll();

    console.log('🏗️ ========== FINALIZE COMPLETE ==========');
  }

  function escapeHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function wireRemainingButtonsAndFinishInit() {
    if (safeEl('addOpeningToWallFaceBtn')) {
      safeEl('addOpeningToWallFaceBtn').addEventListener('click', function () {
        addOpeningToCurrentWallFace();
        if (safeEl('wallFaceNameDisplay')) safeEl('wallFaceNameDisplay').textContent = safeEl('wallFaceName')?.value || '—';
      });
    }

    if (safeEl('addWallFaceBtnUnprotected')) {
      safeEl('addWallFaceBtnUnprotected').addEventListener('click', function () {
        finalizeCurrentWallFace();
      });
    }

    // Support for Column 3 Aggregate tab (combined-calculator.html)
    if (safeEl('addAnotherWallFaceBtnAggregate')) {
      safeEl('addAnotherWallFaceBtnAggregate').addEventListener('click', function () {
        finalizeCurrentWallFace();
      });
    }

    // Legacy listener for #addWallFaceBtn REMOVED
    // In combined-calculator.html, this button ID is used exclusively by Spatial Calculator (Column 2)
    // app.js handles this button via event delegation
    // UnprotectedOpeningsCalculator uses dedicated button IDs:
    //   - #addWallFaceBtnUnprotected (Column 1, Tab 1)
    //   - #addAnotherWallFaceBtnAggregate (Column 3, Tab 1)

    if (safeEl('generateReportBtn')) {
      safeEl('generateReportBtn').addEventListener('click', function () {
        regenerateFullReport();
        if (safeEl('projectReportSection')) safeEl('projectReportSection').scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (safeEl('emailResultsUO')) {
      safeEl('emailResultsUO').addEventListener('click', function () {
        copyReportToClipboard(this);
      });
    }

    setupPDFButton();

    if (safeEl('newProjectBtnUO')) {
      safeEl('newProjectBtnUO').addEventListener('click', function () {
        if (!confirm('Start a new project? This will clear all current data.')) return;
        // Use the global newProject function from app.js
        if (typeof window.newProject === 'function') {
          window.newProject();
        }
      });
    }

    updateActualNote();
    updateROCustomReadout();
    updateROPerReadout();
    renderCurrentOpeningsList();
    updateLabelsForOpeningClass();
    updateGlassBlockLabel();
  }

  function updateGlassBlockLabel() {
    const tableSelect = safeEl('tableSelect');
    const glassBlockLabel = safeEl('glassBlockLabel');
    if (!glassBlockLabel) return;

    if (tableSelect && tableSelect.value === 'Opt1') {
      glassBlockLabel.textContent = 'Glass Block';
    } else {
      glassBlockLabel.textContent = 'Wired Glass/Glass Block';
    }
  }

  function init() {
    loadProjectROFromLocal();
    createROControlsIfMissing();
    createPerOpeningIfMissing();

    if (safeEl('tableSelect')) {
      safeEl('tableSelect').addEventListener('change', function () {
        if (typeof updateLabelsForOpeningClass === 'function') updateLabelsForOpeningClass();
        updateGlassBlockLabel();
      });
    }

    ['openingWindow','openingDoor','openingGlassBlock','openingRough','openingActual'].forEach(id => {
      const el = safeEl(id);
      if (!el) return;
      el.addEventListener('change', function () {
        recomputeAll();
        updateActualNote();
        const showRO = safeEl('openingActual')?.checked;
        if (safeEl('roOptionsContainer')) safeEl('roOptionsContainer').style.display = showRO ? 'block' : 'none';
        const per = safeEl('roPerOpeningContainer');
        if (per) per.style.display = 'none';
        const toggle = safeEl('togglePerOpeningOverride');
        if (toggle) toggle.textContent = 'Enable per-opening override';
      });
    });

    if (safeEl('openingWidth_m')) {
      safeEl('openingWidth_m').addEventListener('input', function () { syncFromMetricLive('openingWidth_m','openingWidth_ft'); });
      safeEl('openingWidth_m').addEventListener('blur', function () { syncFromMetricBlur('openingWidth_m','openingWidth_ft'); });
    }
    if (safeEl('openingHeight_m')) {
      safeEl('openingHeight_m').addEventListener('input', function () { syncFromMetricLive('openingHeight_m','openingHeight_ft'); });
      safeEl('openingHeight_m').addEventListener('blur', function () { syncFromMetricBlur('openingHeight_m','openingHeight_ft'); });
    }

    if (safeEl('openingWidth_ft')) {
      safeEl('openingWidth_ft').addEventListener('input', function () { syncFromImperialLive('openingWidth_ft','openingWidth_m'); });
      safeEl('openingWidth_ft').addEventListener('blur', function () { syncFromImperialBlur('openingWidth_ft','openingWidth_m'); });
    }
    if (safeEl('openingHeight_ft')) {
      safeEl('openingHeight_ft').addEventListener('input', function () { syncFromImperialLive('openingHeight_ft','openingHeight_m'); });
      safeEl('openingHeight_ft').addEventListener('blur', function () { syncFromImperialBlur('openingHeight_ft','openingHeight_m'); });
    }

      if (safeEl('openingArea_m2')) {
          safeEl('openingArea_m2').addEventListener('input', function () {
        areaEnteredManually = true;
        syncAreaFromM2();
        setPlaceholdersForDimensions(true);
      });
    }
      if (safeEl('openingArea_ft2')) {
          safeEl('openingArea_ft2').addEventListener('input', function () {
        areaEnteredManually = true;
        syncAreaFromFt2();
        setPlaceholdersForDimensions(true);
      });
    }

    ['openingWidth_m','openingWidth_ft','openingHeight_m','openingHeight_ft'].forEach(id => {
      const el = safeEl(id);
      if (!el) return;
      el.addEventListener('input', function () {
          if (safeEl('openingArea_m2')) safeEl('openingArea_m2').value = '';
          if (safeEl('openingArea_ft2')) safeEl('openingArea_ft2').value = '';
        setPlaceholdersForDimensions(false);
        areaEnteredManually = false;
      });
    });

    // Sync wall face name to display when user types or edits it
    if (safeEl('wallFaceName')) {
      safeEl('wallFaceName').addEventListener('input', function () {
        const name = this.value.trim();
        if (safeEl('wallFaceNameDisplay')) {
          safeEl('wallFaceNameDisplay').textContent = name || '—';
        }
      });
    }

    wireRemainingButtonsAndFinishInit();

    const show = safeEl('openingActual')?.checked;
    if (safeEl('roOptionsContainer')) safeEl('roOptionsContainer').style.display = show ? 'block' : 'none';
    if (safeEl('roPerOpeningContainer')) safeEl('roPerOpeningContainer').style.display = 'none';

    updateGlassBlockLabel();
    recomputeAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  try {
    window.__bcabd_debug = {
      parseFeetInput,
      parseInchesStringToDecimal,
      parseInchesInput,
      formatFeetFractional,
      metersFromValueUnit,
      getPerOpeningAllowanceMeters,
      recomputeAll,
      // Expose buildReportLines for combined report system
      buildReportLines: buildReportLines,
      // Expose for Column 3 integration
      getWallFaces: () => {
        console.log('🔍 getWallFaces() called, returning:', wallFaces.length, 'wall faces');
        console.log('   Wall Faces:', JSON.stringify(wallFaces, null, 2));
        return wallFaces;
      },
      // NEW: Set wall faces from saved data AND clear current openings
      setWallFaces: (data) => {
        console.log('🔧 setWallFaces called with data:', data);
        wallFaces = JSON.parse(JSON.stringify(data || []));
        // CRITICAL FIX: Also clear current openings when loading/clearing project
        currentOpenings = [];
        console.log('  - wallFaces set to:', wallFaces.length, 'items');
        console.log('  - currentOpenings cleared');
        regenerateFullReport();
        if (typeof window.updateWallFacesList === 'function') {
          window.updateWallFacesList(wallFaces);
        }
        // CRITICAL FIX: Expose renderCurrentOpeningsList so it can be called externally
        renderCurrentOpeningsList();
      },
      // CRITICAL FIX: Expose renderCurrentOpeningsList to global scope
      renderCurrentOpeningsList: renderCurrentOpeningsList,
      deleteWallFaceByIndex: (index) => {
        if (index >= 0 && index < wallFaces.length) {
          wallFaces.splice(index, 1);
          regenerateFullReport();
          if (typeof window.updateWallFacesList === 'function') {
            window.updateWallFacesList(wallFaces);
          }
          return true;
        }
        return false;
      },
      deleteWallFaceByName: (name) => {
        const index = wallFaces.findIndex(wf => wf.name === name);
        if (index >= 0) {
          wallFaces.splice(index, 1);
          regenerateFullReport();
          if (typeof window.updateWallFacesList === 'function') {
            window.updateWallFacesList(wallFaces);
          }
          return true;
        }
        return false;
      },
      finalizeCurrentWallFace: () => {
        const name = (wallFaceNameEl?.value || '').trim();
        if (!name) {
          alert('Please enter a wall face name.');
          return false;
        }
        if (openings.length === 0) {
          alert('Please add at least one opening before finalizing.');
          return false;
        }

        // Add current openings to wall faces array
        wallFaces.push({
          name: name,
          openings: JSON.parse(JSON.stringify(openings)),
          totalAreaFace_m2: totalAreaFace_m2,
          totalAreaFace_ft2: totalAreaFace_ft2
        });

        // Clear current openings
        openings.length = 0;
        totalAreaFace_m2 = 0;
        totalAreaFace_ft2 = 0;

        if (wallFaceNameEl) wallFaceNameEl.value = '';

        regenerateFullReport();
        if (typeof window.updateWallFacesList === 'function') {
          window.updateWallFacesList(wallFaces);
        }

        return true;
      }
    };
    console.log('✅ window.__bcabd_debug initialized successfully');
    console.log('   getWallFaces available:', typeof window.__bcabd_debug.getWallFaces);
  } catch (e) {
    console.error('❌ Error setting up __bcabd_debug:', e);
  }

})();
