// ============================
// PART 1
// ============================

(function () {
    "use strict";

    // ==========================================================
    // 1.1 C# BRIDGE: The "Inbox" for results
    // ==========================================================
    window.receiveFromCSharp = function (data) {
        console.log("📥 Bridge received raw data:", data);

        let result;
        try {
            // Handle cases where data might already be an object or needs parsing
            result = (typeof data === 'string') ? JSON.parse(data) : data;
        } catch (e) {
            console.error("❌ Bridge JSON Parse Error:", e, "Data:", data);
            return;
        }

        console.log("📬 Parsed Command:", result.command);

        // 1. Handle Project List
        if (result.command === 'PROJECT_LIST') {
            window.savedProjects = result.payload || {};
            if (typeof window.RenderProjectList === 'function') {
                window.RenderProjectList();
            }
            console.log("✅ Project List Updated");
            return;
        }

        // 2. Handle Calculation Results (Updated to use .payload)
        if (result.command === 'CALC_RESULT') {
            if (typeof onCalculationResultReceived === 'function') {
                onCalculationResultReceived(result.payload); // Pass the payload, not the whole envelope
            }
            return;
        }

        // 3. Handle Errors
        if (result.command === 'ERROR') {
            alert("C# Error: " + result.payload);
            return;
        }
    };

    // ==========================================================
    // 1.2 HELPERS & GLOBAL STATE
    // ==========================================================
    const SQFT_PER_M2 = 10.7639;
    const FT_PER_M = 3.28084;

    // Global State
    window.currentActiveProjectName = null;
    window.savedProjects = {};
    window.isResettingUI = false;

    // SYNCED: Case-sensitive fix to match Part 10
    window.WallFaces = window.WallFaces || [];
    window.DeletedWallFaces = window.DeletedWallFaces || [];
    let LdOverrideActive = false;

    // ... rest of your helper functions ...

    function ApplyFinalCladdingOverride() {
        const cc = typeof evaluateCombustibleCladdingOverride === 'function' ? evaluateCombustibleCladdingOverride() : null;
        const maxFaceCell = safeEl('maxFaceAreaCombustible');
        const cladCell = safeEl('clad');

        if (cc && maxFaceCell && cladCell) {
            maxFaceCell.textContent =
                cc.MaxFaceArea_m2.toFixed(0) + " m² / " + cc.MaxFaceArea_ft2.toFixed(0) + " ft²";

            if (cc.AllowCombustible) {
                cladCell.textContent = "Combustible or noncombustible";
            }
        }
    }
    function evaluateCombustibleCladdingOverride() {
        const tableOpt = safeEl('tableSelect')?.value || "Opt1";
        const areaVal = parseFloat(safeEl('areaFace_m2')?.value);
        const distVal = parseFloat(safeEl('limitDist_m')?.value);
        const widthVal = parseFloat(safeEl('buildingWidth_m')?.value);
        const heightVal = parseFloat(safeEl('buildingHeight_m')?.value);
        const maxPctVal = parseFloat(safeEl('maxPctAllowed')?.textContent);

        if (!["Opt2", "Opt3", "Opt4", "Opt5", "Opt6", "Opt7"].includes(tableOpt)) {
            return null;
        }

        if (isNaN(areaVal) || isNaN(distVal) || isNaN(widthVal) || isNaN(heightVal) || heightVal <= 0) {
            return null;
        }

        if (isNaN(maxPctVal) || maxPctVal <= 25 || maxPctVal > 50) {
            return null;
        }

        if (distVal <= 2.5) {
            return null;
        }

        let r = widthVal / heightVal;
        r = Math.max(1, Math.min(5, r));

        const base = [0, 88, 102, 129, 161, 195];
        const low = Math.floor(r);
        const high = Math.ceil(r);

        let MaxFaceArea_m2;
        if (low === high) {
            MaxFaceArea_m2 = base[low];
        } else {
            const t = r - low;
            MaxFaceArea_m2 = base[low] + (base[high] - base[low]) * t;
        }

        const MaxFaceArea_ft2 = MaxFaceArea_m2 * 10.7639;

        return {
            AllowCombustible: areaVal <= MaxFaceArea_m2,
            MaxFaceArea_m2,
            MaxFaceArea_ft2
        };
    }

    // ============================
    // 1.4 CONSTRUCTION TABLE MANAGER
    // ============================
    function UpdateConstructionTableDisabledState() {
        const mainTableContainer = safeEl('constructionReqTable');
        if (!mainTableContainer) return;

        // A. Individual Row Grey-out Logic
        const rows = [
            { row: safeEl('frr')?.parentElement, cell: safeEl('frr') },
            { row: safeEl('conreq')?.parentElement, cell: safeEl('conreq') },
            { row: safeEl('clad')?.parentElement, cell: safeEl('clad') },
            { row: safeEl('maxFaceAreaCombustible')?.parentElement, cell: safeEl('maxFaceAreaCombustible') }
        ];

        let hasActiveData = false;

        rows.forEach(({ row, cell }) => {
            if (!row || !cell) return;
            const val = (cell.textContent || "").trim();

            // If the cell is empty or a dash, grey it out
            if (val === "—" || val === "") {
                row.classList.add("ns-disabled");
            } else {
                row.classList.remove("ns-disabled");
                // If we find even ONE real value, the table has data to show
                hasActiveData = true;
            }
        });

        // B. Visibility Toggle
        // Show the whole section only if there is at least one valid result
        mainTableContainer.style.display = hasActiveData ? "block" : "none";

        // C. Handle specific red text rows if they are visible
        // This ensures extra notes don't force an empty table to stay visible
        const sprinkAdjust = safeEl('sprinkAdjustRow');
        const nonCombRow = safeEl('conreqNonCombRow');

        if (!hasActiveData) {
            if (sprinkAdjust) sprinkAdjust.style.display = "none";
            if (nonCombRow) nonCombRow.style.display = "none";
        }
    }

    // ========================================================
    // 1.6 UNIFIED CAPTURE FUNCTION - FIXED FOR SPRINKLER MODE - WITH DEBUG LOGGING
    // ========================================================
    function captureCurrentWallFace() {
        console.log('🔍 [DEBUG] captureCurrentWallFace() called');

        const name = (safeEl('spatialWallFaceName')?.value || safeEl('wallFaceName')?.value || "").trim();
        console.log('🔍 [DEBUG] Wall face name:', name);

        const isSprink = !!safeEl('sprinkYes')?.checked;
        console.log('🔍 [DEBUG] Is sprinklered:', isSprink);

        const frr = safeEl('frr')?.textContent || "—";
        const conreq = safeEl('conreq')?.textContent || "—";
        const clad = safeEl('clad')?.textContent || "—";
        const maxFaceArea_m2 = safeEl('maxFaceAreaCombustible')?.textContent || "—";

        console.log('🔍 [DEBUG] Captured construction values:');
        console.log('  - FRR:', frr);
        console.log('  - CONREQ:', conreq);
        console.log('  - CLAD:', clad);
        console.log('  - MaxFaceArea:', maxFaceArea_m2);

        // --- Calculate Ratio for the Object ---
        const width = parseFloat(safeEl('buildingWidth_m')?.value) || 0;
        const height = parseFloat(safeEl('buildingHeight_m')?.value) || 0;
        let ratioText = "—";
        if (width > 0 && height > 0) {
            ratioText = (width / height).toFixed(2) + ":1";
        }

        // --- CONDITIONAL CAPTURE: Use sprinkler table if sprinklered, otherwise use non-sprinkler table ---
        let maxOpen_m2, maxOpen_ft2, maxPctAllowed, actualPct, passFail, maxIndivOpen_m2, maxIndivOpen_ft2;

        if (isSprink) {
            // Read from SPRINKLER results table (sprinkResultsTable2)
            maxOpen_m2 = safeEl('maxOpenSpr_m2')?.textContent || "—";
            maxOpen_ft2 = safeEl('maxOpenSpr_ft2')?.textContent || "—";
            maxPctAllowed = safeEl('maxPctAllowedSpr')?.textContent || "—";
            actualPct = safeEl('actualPctSpr_m2')?.textContent || "—";
            passFail = safeEl('passFailSpr')?.textContent || "—";
            // Individual opening size doesn't apply to sprinklered buildings
            maxIndivOpen_m2 = "—";
            maxIndivOpen_ft2 = "—";
        } else {
            // Read from NON-SPRINKLER results table (sprinkResultsTable)
            maxOpen_m2 = safeEl('maxOpen_m2')?.textContent || "—";
            maxOpen_ft2 = safeEl('maxOpen_ft2')?.textContent || "—";
            maxPctAllowed = safeEl('maxPctAllowed')?.textContent || "—";
            actualPct = safeEl('actualPct_m2')?.textContent || "—";
            passFail = safeEl('passFail')?.textContent || "—";
            maxIndivOpen_m2 = safeEl('nsCalcMaxOpen_m2')?.textContent || "—";
            maxIndivOpen_ft2 = safeEl('nsCalcMaxOpen_ft2')?.textContent || "—";
        }

        // Helper functions to get precise values
        const getOpeningsM2 = () => {
            const el = safeEl('openings_m2');
            if (el?.dataset.precise) {
                return parseFloat(el.dataset.precise).toFixed(2);
            }
            return el?.value || "—";
        };

        const getOpeningsFt2 = () => {
            const el = safeEl('openings_ft2');
            if (el?.dataset.precise) {
                return parseFloat(el.dataset.precise).toFixed(2);
            }
            return el?.value || "—";
        };

        const wf = {
            Name: name || ("Wall Face " + ((window.WallFaces?.length || 0) + 1)),
            Area_m2: safeEl('areaFace_m2')?.value || "—",
            Area_ft2: safeEl('areaFace_ft2')?.value || "—",
            LimitDist_m: safeEl('limitDist_m')?.value || "—",
            LimitDist_ft: safeEl('limitDist_ft')?.value || "—",
            Openings_m2: getOpeningsM2(),
            Openings_ft2: getOpeningsFt2(),

            BuildingWidth_m: width || "",
            BuildingWidth_ft: safeEl('buildingWidth_ft')?.value || "",
            BuildingHeight_m: height || "",
            BuildingHeight_ft: safeEl('buildingHeight_ft')?.value || "",

            RatioDisplay: ratioText,

            // Use the conditionally captured values
            MaxOpen_m2: maxOpen_m2,
            MaxOpen_ft2: maxOpen_ft2,
            MaxPctAllowed: maxPctAllowed,
            MaxIndivOpen_m2: maxIndivOpen_m2,
            MaxIndivOpen_ft2: maxIndivOpen_ft2,
            ActualPct: actualPct,

            Frr: frr,
            Conreq: conreq,
            Clad: clad,
            MaxFaceArea_m2: maxFaceArea_m2,
            PassFail: passFail,
            IsSprink: isSprink,
            SprinklerStandard: isSprink ? (safeEl('sprinkStandard')?.textContent || "—") : null,

            TableOpt: safeEl('tableSelect')?.value || "Opt1",
            FireResponse: safeEl('fireRespHigh')?.checked ? "Greater than 10 min" : "10 min or less",
            Comments: safeEl('wallFaceComments')?.value || "",

            Timestamp: new Date().toISOString()
        };

        console.log('🔍 [DEBUG] Wall face object created:', wf);

        if (!name && (wf.Area_m2 === "—" || wf.Area_m2 === "")) {
            console.warn('⚠️ [DEBUG] captureCurrentWallFace returning null - no name and no area');
            return null;
        }

        console.log('✅ [DEBUG] captureCurrentWallFace returning wall face:', wf.Name);
        return wf;
    }

    // ============================
    // 1.7 REMOVE WALL FACE BUTTON FUNCTION - FIXED WITH AUTOSAVE
    // ============================
    window.removeWallFace = function (idx) {
        idx = parseInt(idx, 10);
        if (isNaN(idx) || !window.WallFaces || !window.WallFaces[idx]) return;

        // A. USE UPPERCASE 'D' to match the Render function
        if (!Array.isArray(window.DeletedWallFaces)) {
            window.DeletedWallFaces = [];
        }

        window.DeletedWallFaces.push({
            Face: window.WallFaces[idx],
            Index: idx
        });

        // B. Remove from active list
        window.WallFaces.splice(idx, 1);

        // C. Re-render the report
        if (typeof RenderWallFacesListForReport === 'function') {
            RenderWallFacesListForReport();
        }

        // D. Update calculations
        if (typeof UpdateSprinklerResults === 'function') {
            UpdateSprinklerResults(true);
        }

        // E. Unlock controls if list is now empty
        if (window.WallFaces.length === 0 && typeof UnlockProjectControls === 'function') {
            UnlockProjectControls();
        }

        // F. AUTOSAVE - Save project after deletion
        if (window.currentActiveProjectName && typeof window.SaveProject === 'function') {
            console.log("💾 Auto-saving after wall face deletion");
            window.SaveProject();
        }
    };

    // ============================
    // PART 2
    // ============================
    // ============================
    // 2.1 UNDO FUNCTIONS (GLOBAL SCOPE)
    // ============================

    // A. Undo the very last deletion
    window.UndoLastWallFace = function () {
        if (!window.DeletedWallFaces || window.DeletedWallFaces.length === 0) return;

        // Pop the last deleted item off the stack
        const entry = window.DeletedWallFaces.pop();

        // entry.Face is the data, entry.Index is where it used to be
        window.WallFaces.splice(entry.Index, 0, entry.Face);

        // Refresh the UI
        RenderWallFacesListForReport();
    };

    // B. Undo everything in the deleted list
    window.UndoAllWallFaces = function () {
        if (!window.DeletedWallFaces || window.DeletedWallFaces.length === 0) return;

        // Sort by index ascending to ensure they go back into the array correctly
        window.DeletedWallFaces.sort((a, b) => a.Index - b.Index).forEach(entry => {
            window.WallFaces.splice(entry.Index, 0, entry.Face);
        });

        // Clear the history
        window.DeletedWallFaces = [];

        // Refresh the UI
        RenderWallFacesListForReport();
    };

    // C. Permanently clear the deleted history
    window.ClearDeletedWallFaces = function () {
        if (!confirm("Are you sure you want to permanently clear the deleted history?")) return;

        window.DeletedWallFaces = [];
        RenderWallFacesListForReport();
    };

    // ============================
    // 2.2 UTILITY FUNCTIONS
    // ============================

    // A. --- AREA CONVERSION ---
    function m2ToFt2(m2) { return m2 * SQFT_PER_M2; }
    function ft2ToM2(ft2) { return ft2 / SQFT_PER_M2; }

    // B. --- METRIC / IMPERIAL HELPERS ---
    function mToFeetDecimal(m) {
        return m * FT_PER_M;
    }

    function feetDecimalToM(ft) {
        return ft / FT_PER_M;
    }

    function roundMetricDisplay(m) {
        return Math.round(m * 10000) / 10000;
    }

    // C. --- PRECISION HELPERS ---
    function StoreRawMetricValue(inputEl, decimalsStore = 4) {
        if (!inputEl) return;

        const raw = inputEl.value.trim();
        const num = parseFloat(raw);

        if (!isNaN(num)) {
            inputEl.dataset.raw = num.toFixed(decimalsStore);
        } else {
            delete inputEl.dataset.raw;
        }
    }

    function ApplyRoundedDisplayFromRaw(inputEl, decimalsDisplay = 2) {
        if (!inputEl) return;

        const rawStr = inputEl.dataset.raw || inputEl.value;
        const num = parseFloat(rawStr);

        if (!isNaN(num)) {
            inputEl.value = num.toFixed(decimalsDisplay);
        }
    }

    function toNumber(val) {
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
    }

    // D. --- FEET/INCHES FORMATTING ---
    function feetToFeetInches(feetValue) {
        if (isNaN(feetValue)) return "";

        let feet = Math.floor(feetValue);
        let inchesTotal = (feetValue - feet) * 12;

        let sixteenth = Math.round(inchesTotal * 16);
        let inches = Math.floor(sixteenth / 16);
        let frac = sixteenth % 16;

        if (frac === 0) {
            if (inches === 12) {
                feet += 1;
                inches = 0;
            }
            return feet + "'-" + inches + "\"";
        }

        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const g = gcd(frac, 16);
        const num = frac / g;
        const den = 16 / g;

        if (inches === 12) {
            feet += 1;
            inches = 0;
        }

        return feet + "'-" + inches + " " + num + "/" + den + "\"";
    }

    function formatFeetFractional(ft) {
        return feetToFeetInches(ft);
    }

    // E. --- FEET/INCHES PARSER ---
    function parseFeetInput(value) {
        if (!value) return NaN;
        value = value.trim().toLowerCase();

        value = value
            .replace(/feet|foot|ft/g, "'")
            .replace(/inches|inch|in/g, "\"")
            .replace(/-/g, " ")
            .replace(/\s+/g, " ");

        if (/^[0-9]*\.?[0-9]+$/.test(value)) {
            return parseFloat(value);
        }

        let feet = 0;
        let inches = 0;

        const feetMatch = value.match(/(\d+(\.\d+)?)'/);
        if (feetMatch) {
            feet = parseFloat(feetMatch[1]);
        }

        const inchPart = value.replace(/.*'/, "").trim();

        if (inchPart.includes("/")) {
            const fracMatch = inchPart.match(/(\d+)\s+(\d+)\/(\d+)/);
            if (fracMatch) {
                const whole = parseFloat(fracMatch[1]);
                const num = parseFloat(fracMatch[2]);
                const den = parseFloat(fracMatch[3]);
                inches = whole + num / den;
                return feet + inches / 12;
            }

            const onlyFrac = inchPart.match(/(\d+)\/(\d+)/);
            if (onlyFrac) {
                const num = parseFloat(onlyFrac[1]);
                const den = parseFloat(onlyFrac[2]);
                inches = num / den;
                return feet + inches / 12;
            }
        }

        const inchMatch = inchPart.match(/(\d+(\.\d+)?)/);
        if (inchMatch) {
            inches = parseFloat(inchMatch[1]);
            return feet + inches / 12;
        }

        if (!feetMatch && inchMatch) {
            inches = parseFloat(inchMatch[1]);
            return inches / 12;
        }

        return isNaN(feet) ? NaN : feet;
    }

    // F. --- HTML ESCAPE ---
    function escapeHtml(str) {
        // Handle null, undefined, empty strings, and "null" strings
        if (str === null || str === undefined) return "—";
        let s = String(str).trim();
        if (s === "" || s.toLowerCase() === "null") return "—";

        // Escape HTML entities
        return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // G. --- DATA VALIDATION ---
    function hasData(val) {
        if (val === null || val === undefined) return false;
        let s = String(val).trim().toLowerCase();
        // Note: Removed single "-" to avoid blocking negative numbers or partial conversions
        const emptyValues = ["", "null", "—", "–", "undefined"];
        return !emptyValues.includes(s);
    }


    // ============================
    // 2.3 LOCK AND UNLOCK PROJECT CONTROLS
    // ============================
    function LockProjectControls() {
        const ids = ['tableSelect', 'fireRespNormal', 'fireRespHigh', 'sprinkYes', 'sprinkNo'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = true;
                el.classList.add('locked-control');
            }
        });
    }

    function UnlockProjectControls() {
        const ids = ['tableSelect', 'fireRespNormal', 'fireRespHigh', 'sprinkYes', 'sprinkNo'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = false;
                el.classList.remove('locked-control');
            }
        });
    }

    // ============================
    // PART 3
    // ============================
    // ============================
    // 3.1 UNIT SYNC FUNCTIONS
    // ============================

    // A. --- AREA SYNC ---
    function SyncAreaFromM2() {
        const m2El = safeEl('areaFace_m2');
        const m2OpenEl = safeEl('openings_m2');

        const m2 = parseFloat(m2El?.dataset.raw || m2El?.value);
        const m2Open = parseFloat(m2OpenEl?.dataset.raw || m2OpenEl?.value);

        if (safeEl('areaFace_ft2'))
            safeEl('areaFace_ft2').value = isFinite(m2) ? m2ToFt2(m2).toFixed(2) : "";

        if (safeEl('openings_ft2'))
            safeEl('openings_ft2').value = isFinite(m2Open) ? m2ToFt2(m2Open).toFixed(2) : "";
    }

    function SyncAreaFromFt2() {
        const ft2 = toNumber(safeEl('areaFace_ft2')?.value);
        const ft2Open = toNumber(safeEl('openings_ft2')?.value);

        if (safeEl('areaFace_m2'))
            safeEl('areaFace_m2').value = ft2 !== null ? ft2ToM2(ft2).toFixed(2) : "";

        if (safeEl('openings_m2'))
            safeEl('openings_m2').value = ft2Open !== null ? ft2ToM2(ft2Open).toFixed(2) : "";
    }

    // B. --- LIMITING DISTANCE (LD) ---
    function SyncLimitDistFromMetricLive() {
        const mInput = safeEl('limitDist_m');
        const ftInput = safeEl('limitDist_ft');
        const ftDisplay = safeEl('limitDist_ftIn');

        const raw = mInput?.dataset.raw || mInput?.value;

        if (raw === "" || raw === "." || raw === "-" || raw === "-.") {
            return;
        }

        const m = parseFloat(raw);
        if (isNaN(m)) return;

        const ftDec = mToFeetDecimal(m);
        const formatted = formatFeetFractional(ftDec);

        if (ftInput) ftInput.value = formatted;
        if (ftDisplay) ftDisplay.textContent = formatted;
    }

    function SyncLimitDistFromImperialLive() {
        const ftInput = safeEl('limitDist_ft');
        const mInput = safeEl('limitDist_m');
        const ftDisplay = safeEl('limitDist_ftIn');

        const ftDec = parseFeetInput(ftInput?.value);
        if (isNaN(ftDec)) return;

        const m = feetDecimalToM(ftDec);
        if (mInput) mInput.value = m.toFixed(4);
        if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
    }

    function SyncLimitDistFromMetricBlur() {
        const mInput = safeEl('limitDist_m');
        const ftInput = safeEl('limitDist_ft');
        const ftDisplay = safeEl('limitDist_ftIn');

        ApplyRoundedDisplayFromRaw(mInput);

        const m = parseFloat(mInput?.dataset.raw || mInput?.value);

        if (isFinite(m)) {
            const ftDec = mToFeetDecimal(m);
            if (ftInput) ftInput.value = formatFeetFractional(ftDec);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (ftInput) ftInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncLimitDistFromImperialBlur() {
        const ftInput = safeEl('limitDist_ft');
        const mInput = safeEl('limitDist_m');
        const ftDisplay = safeEl('limitDist_ftIn');

        const ftDec = parseFeetInput(ftInput?.value);

        if (!isNaN(ftDec)) {
            const m = feetDecimalToM(ftDec);
            const rounded = roundMetricDisplay(m);

            ftInput.value = formatFeetFractional(ftDec);
            mInput.value = rounded.toFixed(4);

            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            mInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    // C. --- WIDTH ---
    function SyncWidthFromMetricLive() {
        const mInput = safeEl('buildingWidth_m');
        const ftInput = safeEl('buildingWidth_ft');
        const ftDisplay = safeEl('buildingWidth_ftIn');

        const m = parseFloat(mInput?.dataset.raw || mInput?.value);

        if (isFinite(m)) {
            const ftDec = mToFeetDecimal(m);
            if (ftInput) ftInput.value = formatFeetFractional(ftDec);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (ftInput) ftInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncWidthFromImperialLive() {
        const ftInput = safeEl('buildingWidth_ft');
        const mInput = safeEl('buildingWidth_m');
        const ftDisplay = safeEl('buildingWidth_ftIn');

        const ftDec = parseFeetInput(ftInput?.value);

        if (!isNaN(ftDec)) {
            const m = feetDecimalToM(ftDec);
            if (mInput) mInput.value = m.toFixed(4);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (mInput) mInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncWidthFromMetricBlur() {
        const mInput = safeEl('buildingWidth_m');
        const ftInput = safeEl('buildingWidth_ft');
        const ftDisplay = safeEl('buildingWidth_ftIn');

        ApplyRoundedDisplayFromRaw(mInput);

        const m = parseFloat(mInput?.dataset.raw || mInput?.value);

        if (isFinite(m)) {
            const ftDec = mToFeetDecimal(m);
            if (ftInput) ftInput.value = formatFeetFractional(ftDec);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (ftInput) ftInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncWidthFromImperialBlur() {
        const ftInput = safeEl('buildingWidth_ft');
        const mInput = safeEl('buildingWidth_m');
        const ftDisplay = safeEl('buildingWidth_ftIn');

        const ftDec = parseFeetInput(ftInput?.value);

        if (!isNaN(ftDec)) {
            const m = feetDecimalToM(ftDec);
            const rounded = roundMetricDisplay(m);

            ftInput.value = formatFeetFractional(ftDec);
            mInput.value = rounded.toFixed(4);

            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            mInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    // D. --- HEIGHT ---
    function SyncHeightFromMetricLive() {
        const mInput = safeEl('buildingHeight_m');
        const ftInput = safeEl('buildingHeight_ft');
        const ftDisplay = safeEl('buildingHeight_ftIn');

        const m = parseFloat(mInput?.dataset.raw || mInput?.value);

        if (isFinite(m)) {
            const ftDec = mToFeetDecimal(m);
            if (ftInput) ftInput.value = formatFeetFractional(ftDec);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (ftInput) ftInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncHeightFromImperialLive() {
        const ftInput = safeEl('buildingHeight_ft');
        const mInput = safeEl('buildingHeight_m');
        const ftDisplay = safeEl('buildingHeight_ftIn');

        const ftDec = parseFeetInput(ftInput?.value);

        if (!isNaN(ftDec)) {
            const m = feetDecimalToM(ftDec);
            if (mInput) mInput.value = m.toFixed(4);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (mInput) mInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncHeightFromMetricBlur() {
        const mInput = safeEl('buildingHeight_m');
        const ftInput = safeEl('buildingHeight_ft');
        const ftDisplay = safeEl('buildingHeight_ftIn');

        ApplyRoundedDisplayFromRaw(mInput);

        const m = parseFloat(mInput?.dataset.raw || mInput?.value);

        if (isFinite(m)) {
            const ftDec = mToFeetDecimal(m);
            if (ftInput) ftInput.value = formatFeetFractional(ftDec);
            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            if (ftInput) ftInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    function SyncHeightFromImperialBlur() {
        const ftInput = safeEl('buildingHeight_ft');
        const mInput = safeEl('buildingHeight_m');
        const ftDisplay = safeEl('buildingHeight_ftIn');

        const ftDec = parseFeetInput(ftInput?.value);

        if (!isNaN(ftDec)) {
            const m = feetDecimalToM(ftDec);
            const rounded = roundMetricDisplay(m);

            ftInput.value = formatFeetFractional(ftDec);
            mInput.value = rounded.toFixed(4);

            if (ftDisplay) ftDisplay.textContent = formatFeetFractional(ftDec);
        } else {
            mInput.value = "";
            if (ftDisplay) ftDisplay.textContent = "";
        }
    }

    // ============================
    // PART 4
    // ============================
    // ========================================================
    // 4.1 THE OUTBOX: Gathers data and sends it to C#
    // ========================================================
    function UpdateSprinklerResults() {
        // A. GATHER RAW INPUTS
        const face_m2 = parseFloat(safeEl('areaFace_m2')?.value);
        const openings_m2 = parseFloat(safeEl('openings_m2')?.value);
        const limitDist_m = parseFloat(safeEl('limitDist_m')?.value);

        // B. GATHER UI STATE
        const tableOpt = safeEl('tableSelect')?.value;
        const isSprink = safeEl('sprinkYes')?.checked;
        const isHighResp = safeEl('fireRespHigh')?.checked;
        const useInterpolation = safeEl('calcInterpolation')?.checked ?? true;
        // For Opt3, read the open-air radio state; for others, always send true (doesn't matter for non-Opt3)
        const isOpenAir = (tableOpt === 'Opt3') ? (safeEl('openAirYes')?.checked ?? true) : true;

        console.log('🔍 Calculation Method - useInterpolation:', useInterpolation);
        console.log('🔍 calcInterpolation element:', safeEl('calcInterpolation'));
        console.log('🔍 calcInterpolation checked:', safeEl('calcInterpolation')?.checked);
        console.log('🔍 Open Air Storeys:', isOpenAir);

        // C. DYNAMIC UI TOGGLE (Immediate Filter)
        // If the user selects Opt1 or Sprinklers, we hide the ratio blocks immediately
        // so the UI feels responsive before the calculation even returns.
        if (tableOpt === "Opt1" || isSprink) {
            if (safeEl('widthBlock')) safeEl('widthBlock').style.display = "none";
            if (safeEl('heightBlock')) safeEl('heightBlock').style.display = "none";
        }

        // Update label terminology for Opt1 and Opt3
        updateOpeningsLabels(tableOpt);

        // D. PACKAGE DATA (Matches C# SpatialRequest record)
        const req = {
            Table: tableOpt,
            IsSprinklered: isSprink,
            IsHighResp: isHighResp,
            FaceArea_m2: isNaN(face_m2) ? null : face_m2,
            Openings_m2: isNaN(openings_m2) ? null : openings_m2,
            LimitDistance_m: isNaN(limitDist_m) ? null : limitDist_m,
            BuildingWidth_m: parseFloat(safeEl('buildingWidth_m')?.value) || 0,
            BuildingHeight_m: parseFloat(safeEl('buildingHeight_m')?.value) || 0,
            UseInterpolation: useInterpolation,
            IsOpenAirStoreys: isOpenAir
        };

        // E. SEND TO C# BRIDGE OR HTTP API
        if (window.sendToCSharp) {
            console.log("📤 Sending to C# Bridge:", req);
            window.sendToCSharp(req);
        } else if (typeof callSpatialApi === 'function') {
            // Web mode: Use the hybrid api-client
            console.log("🌐 Calling HTTP API via callSpatialApi()");
            callSpatialApi();
        } else {
            console.error("❌ No API client available - neither C# bridge nor callSpatialApi found");
        }

        if (typeof SynchronizeResultsVisibility === "function") {
            SynchronizeResultsVisibility();
        }
    }

    // ============================
    // 4.2 THE INBOX: Receives result from C# and updates all UI
    // ============================
    function onCalculationResultReceived(result) {
        console.log("📥 Calculation result received, flag =", window.isResettingUI, "result =", result);

        if (!result) {
            console.warn("⚠️ Result is NULL!");
            return;
        }

        if (window.isResettingUI) {
            console.warn("⚠️ Calculation BLOCKED! isResettingUI = true");
            return;
        }

        const ns = result.NonSprinkler;
        const spr = result.Sprinkler;
        const con = result.Construction;
        const comb = result.CombustibleOverride;
        const isSprinkChecked = !!safeEl('sprinkYes')?.checked;

        // --- A. NON-SPRINKLER & EGRESS ---
        const nsCalcM2El = safeEl("nsCalcMaxOpen_m2");
        const nsCalcFt2El = safeEl("nsCalcMaxOpen_ft2");
        const nsRow = safeEl("nsRow"); // The ID for the <tr>

        if (nsCalcM2El) {
            if (ns.IsEgressException) {
                nsCalcM2El.innerHTML = "<em>0.35 m² Egress</em>";
                if (nsCalcFt2El) nsCalcFt2El.innerHTML = "<em>3.77 ft² Egress</em>";
                if (nsRow) nsRow.style.display = 'table-row'; // Always show for Egress
            } else {
                const hasValue = ns.NsCalcMaxOpen_m2 !== null;

                // 1. Update text
                nsCalcM2El.textContent = hasValue ? ns.NsCalcMaxOpen_m2.toFixed(2) + " m²" : "—";
                if (nsCalcFt2El) nsCalcFt2El.textContent = ns.NsCalcMaxOpen_ft2 !== null ? ns.NsCalcMaxOpen_ft2.toFixed(1) + " ft²" : "—";

                // 2. Hide row if null
                if (nsRow) {
                    nsRow.style.display = hasValue ? 'table-row' : 'none';
                }
            }
        }

        // --- B. UPDATE NON-SPRINKLER NUMBERS ---
        if (safeEl('maxOpen_m2')) safeEl('maxOpen_m2').textContent = ns.MaxOpen_m2 !== null ? ns.MaxOpen_m2.toFixed(2) + " m²" : "—";
        if (safeEl('maxOpen_ft2')) safeEl('maxOpen_ft2').textContent = ns.MaxOpen_ft2 !== null ? ns.MaxOpen_ft2.toFixed(1) + " ft²" : "—";
        if (safeEl('maxPctAllowed')) safeEl('maxPctAllowed').textContent = ns.ZValuePercent !== null ? ns.ZValuePercent.toFixed(1) + "%" : "—";
        if (safeEl('actualPct_m2')) safeEl('actualPct_m2').textContent = ns.ActualPct !== null ? ns.ActualPct.toFixed(1) + "%" : "";

        const pf = safeEl('passFail');
        if (pf) {
            pf.style.color = ns.Pass ? "green" : "red";
            pf.textContent = ns.Pass ? "PASS" : "FAIL";
        }

        // --- C. SPRINKLER BRANCH ---
        if (isSprinkChecked && spr) {
            if (safeEl('maxOpenSpr_m2')) safeEl('maxOpenSpr_m2').textContent = spr.MaxOpenSpr_m2 !== null ? spr.MaxOpenSpr_m2.toFixed(1) + " m²" : "—";
            if (safeEl('maxOpenSpr_ft2')) safeEl('maxOpenSpr_ft2').textContent = spr.MaxOpenSpr_ft2 !== null ? spr.MaxOpenSpr_ft2.toFixed(1) + " ft²" : "—";
            if (safeEl('actualPctSpr_m2')) safeEl('actualPctSpr_m2').textContent = spr.ActualPct !== null ? spr.ActualPct.toFixed(1) + "%" : "—";
            if (safeEl('maxPctAllowedSpr')) safeEl('maxPctAllowedSpr').textContent = spr.MaxPctAllowedSpr !== null ? spr.MaxPctAllowedSpr.toFixed(1) + "%" : "—";

            const pfSpr = safeEl('passFailSpr');
            if (pfSpr) {
                pfSpr.style.color = spr.Pass ? "green" : "red";
                pfSpr.textContent = spr.Pass ? "PASS" : "FAIL";
            }
            if (safeEl('sprinkStandard')) safeEl('sprinkStandard').textContent = spr.SprinklerStandard || "—";
        } else {
            ['maxOpenSpr_m2', 'maxOpenSpr_ft2', 'actualPctSpr_m2', 'maxPctAllowedSpr', 'sprinkStandard'].forEach(id => {
                if (safeEl(id)) safeEl(id).textContent = "—";
            });
            if (safeEl('passFailSpr')) safeEl('passFailSpr').textContent = "";
        }

        // --- D. UPDATE CONSTRUCTION REQUIREMENTS ---
        if (safeEl('frr')) safeEl('frr').textContent = con.FireResistanceRating || "—";
        if (safeEl('conreq')) safeEl('conreq').textContent = con.ConstructionRequired || "—";
        if (safeEl('clad')) safeEl('clad').textContent = con.CladdingRequired || "—";

        // --- E. TABLE LOCKING & VISUAL STATE ---
        const cTable = safeEl('constructionRequirementsTable') || safeEl('constructionReqTable');
        if (cTable) {
            if (con.LdOverrideActive) {
                cTable.classList.add('locked-control', 'ns-disabled', 'ld-override-active');
            } else {
                cTable.classList.remove('locked-control', 'ns-disabled', 'ld-override-active');
            }
        }

        // --- F. CONDITIONAL VISIBILITY (The Note Boxes) ---
        // Opt1 Cladding Note
        const opt1Note = safeEl('opt1CladdingNote');
        const opt1NoteText = safeEl('opt1CladdingText');
        if (opt1Note && opt1NoteText) {
            if (con.ShowNoteRow && con.Note && con.Note.includes('*')) {
                opt1Note.style.display = 'block';
                opt1NoteText.textContent = con.Note || "";
            } else {
                opt1Note.style.display = 'none';
                opt1NoteText.textContent = "";
            }
        }

        // Opt3 Exemption Note (handled separately by existing logic)

        // --- F2. OPT3 EXEMPTION NOTE VISIBILITY ---
        const opt3Note = safeEl('opt3ExemptionNote');
        const tableSelect = safeEl('tableSelect');
        const isOpt3 = tableSelect && tableSelect.value === 'Opt3';
        if (opt3Note) {
            opt3Note.style.display = isOpt3 ? 'block' : 'none';
        }

        // --- G. COMBUSTIBLE OVERRIDE AREA ---
        const maxFaceEl = safeEl('maxFaceAreaCombustible');
        if (maxFaceEl) {
            const row = maxFaceEl.closest('tr');
            if (comb && comb.MaxFaceArea_m2 > 0) {
                if (row) row.style.display = 'table-row';
                maxFaceEl.textContent = comb.MaxFaceArea_m2.toFixed(1) + " m² / " + comb.MaxFaceArea_ft2.toFixed(1) + " ft²";
                if (comb.AllowCombustible && safeEl('clad')) {
                    safeEl('clad').textContent = "Combustible or noncombustible";
                }
            } else {
                if (row) row.style.display = 'none';
                maxFaceEl.textContent = "—";
            }
        }

        // --- H. WIDTH/HEIGHT RATIO VISIBILITY ---
        // We now rely on the C# Eligibility flag to keep inputs visible during calculation
        const showRatioBlocks = !!(comb && comb.IsEligibleForOverride);

        if (safeEl('widthBlock')) safeEl('widthBlock').style.display = showRatioBlocks ? "block" : "none";
        if (safeEl('heightBlock')) safeEl('heightBlock').style.display = showRatioBlocks ? "block" : "none";

        // --- I. FINAL SYNC ---
        if (typeof UpdateConstructionTableDisabledState === "function") {
            UpdateConstructionTableDisabledState();
        }

        // --- J. SYNC RESULT VISIBILITY (CRITICAL: After data is populated!) ---
        if (typeof SynchronizeResultsVisibility === "function") {
            SynchronizeResultsVisibility();
        }
    } // Function correctly ends here



    // ========================================================
    // 4.3 HELPERS
    // ========================================================

    // Update label terminology based on table selection
    function updateOpeningsLabels(tableOpt) {
        const isGlazed = (tableOpt === 'Opt1' || tableOpt === 'Opt3');
        const openingType = isGlazed ? 'Glazed Openings' : 'Unprotected Openings';

        // Non-sprinkler results labels
        if (safeEl('labelMaxAreaPermitted')) 
            safeEl('labelMaxAreaPermitted').textContent = `Maximum Area of ${openingType} Permitted`;
        if (safeEl('labelMaxPctAllowed')) 
            safeEl('labelMaxPctAllowed').textContent = `Maximum Percentage of ${openingType} Allowed`;
        if (safeEl('labelMaxIndividual')) 
            safeEl('labelMaxIndividual').textContent = `Maximum Area of Individual ${openingType}`;
        if (safeEl('labelActualPct')) 
            safeEl('labelActualPct').textContent = `Actual Percentage of ${openingType}`;

        // Sprinkler results labels
        if (safeEl('labelMaxAreaPermittedSpr')) 
            safeEl('labelMaxAreaPermittedSpr').textContent = `Maximum Area of ${openingType} Permitted`;
        if (safeEl('labelMaxPctAllowedSpr')) 
            safeEl('labelMaxPctAllowedSpr').textContent = `Maximum Percentage of ${openingType} Allowed`;
        if (safeEl('labelActualPctSpr')) 
            safeEl('labelActualPctSpr').textContent = `Actual Percentage of ${openingType}`;
    }

    // Show/hide and reset open-air storeys option based on table selection
    function updateOpenAirStoreysVisibility() {
        const tableOpt = safeEl('tableSelect')?.value;
        const openAirGroup = safeEl('openAirStoreysGroup');
        const wasVisible = openAirGroup && openAirGroup.style.display !== 'none';

        if (openAirGroup) {
            if (tableOpt === 'Opt3') {
                openAirGroup.style.display = 'block';
                // Only reset to Yes when SWITCHING TO Opt3 (not already visible)
                if (!wasVisible && safeEl('openAirYes')) {
                    safeEl('openAirYes').checked = true;
                }
            } else {
                openAirGroup.style.display = 'none';
            }
        }
    }

    function safeEl(id) {
        return document.getElementById(id);
    }

    // ============================
    // 4.3.1 UNICODE CLEANER
    // ============================
    function cleanUnicode(str) {
        if (!str) return "";
        return String(str)
            .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-")   // hyphens & dashes → ASCII hyphen
            .replace(/\u00A0/g, " ")                           // non-breaking space → normal space
            .replace(/\u202F/g, " ")                           // narrow NBSP → space
            .replace(/\u200B/g, "")                            // zero-width space → remove
            .replace(/≤/g, "<=")
            .replace(/≥/g, ">=")
            .replace(/&amp;/g, "&")                            // Fix double-encoded ampersands
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    // ============================
    // PART 5
    // ============================
    // ============================
    // 5.1 SPRINKLER NOTES
    // ============================
    function getSprinklerNotesHtml(tableOpt) {
        const Opt = tableOpt || (safeEl("tableSelect")?.value || "Opt1");

        const notes = {
            // --- OPT 1: Group C (Houses) ---
            Opt1: {
                Heading: "Sprinkler System Notes – Part 9 Group C Residential (Houses)",
                Content: `
<div class="sprinkler-notes">
    <h3>Glazed Openings & Limiting Distance (BCBC 9.10.15.4)</h3>
    <ul>
        <li>When the limiting distance is 2 m or less, non-sprinklered buildings are limited to <strong>50% of the allowable glazed opening area</strong>.</li>
        <li>Sprinklered buildings may exceed this 50% limit.</li>
        <li>Where a building is sprinklered and all rooms adjoining the exposing building face are sprinklered (including closets, bathrooms, and attached garages), the <strong>maximum aggregate area of glazed openings may be doubled</strong>.</li>
    </ul>
    <h3>Water Supply Requirements (BCBC 3.2.5.7)</h3>
    <ul>
        <li>Every building must have an adequate firefighting water supply.</li>
        <li>A building is deemed compliant if it is sprinklered throughout per 3.2.5.12 or has a standpipe system per 3.2.5.8-3.2.5.10.</li>
    </ul>
    <h3>Standpipe System Triggers (BCBC 3.2.5.8)</h3>
    <ul>
        <li>A standpipe system is required unless the building is sprinklered throughout when:
            <ul>
                <li>The building is more than 3 storeys,</li>
                <li>The building height exceeds 14 m, or</li>
                <li>The building is ≤14 m but exceeds the allowable building area in Table 3.2.5.8.</li>
            </ul>
        </li>
    </ul>
    <h3>Sprinkler System Standards (BCBC 3.2.5.12)</h3>
    <ul>
        <li>NFPA 13D systems permitted in:
            <ul>
                <li>One- and two-family dwellings</li>
                <li>Small care occupancies (≤2 suites, ≤5 residents)</li>
                <li>Certain multi-unit residential buildings meeting separation and supply requirements</li>
            </ul>
        </li>
        <li>All rooms adjoining the exposing building face must be sprinklered when sprinkler credit is used for limiting distance.</li>
        <li>Buildings with fewer than 9 sprinklers may use the domestic water supply if flow requirements are met.</li>
        <li>Sprinklers cannot be omitted in any room or closet directly below a roof assembly.</li>
        <li>Fast-response sprinklers required in residential, care, treatment, and detention occupancies.</li>
    </ul>
    <h3>Combustible Sprinkler Piping (BCBC 3.2.5.13)</h3>
    <ul>
        <li>Combustible piping permitted only in residential and light-hazard occupancies.</li>
        <li>Piping must comply with ULC/ORD-C199P.</li>
    </ul>
</div>`
            },

            // --- OPT 2: Group C (General) ---
            Opt2: {
                Heading: "Sprinkler System Notes – Part 9 Group C Residential (BCBC 9.10.14.4)",
                Content: `
<div class="sprinkler-notes">
    <h3>Unprotected Openings & Limiting Distance (BCBC 9.10.14.4)</h3>
    <ul>
        <li>When the limiting distance is 2 m or less, individual unprotected openings are limited to:</li>
            <ul>
                <li>the area stated in Table 9.10.14.4.-B, or</li>
                <li>for limiting distances equal to or greater than 1.2 m, the calculated area:</li>
                    <li><p class="displayed-formula">Area = 0.24 × (2 × LD - 1.2)²</p></li>
            </ul>
        </li>
        <li>Sprinklered buildings may exceed these limits when all rooms adjoining the exposing building face are sprinklered.</li>
        <li>Where sprinkler credit is applied, the maximum aggregate area of unprotected openings may be up to <strong>twice</strong> the non-sprinklered allowance.</li>
    </ul>
    <h3>Water Supply Requirements (BCBC 3.2.5.7)</h3>
    <ul>
        <li>Every building must have an adequate firefighting water supply.</li>
        <li>Buildings sprinklered throughout per 3.2.5.12 or equipped with a standpipe system per 3.2.5.8-3.2.5.10 are deemed compliant.</li>
    </ul>
    <h3>Standpipe System Triggers (BCBC 3.2.5.8)</h3>
    <ul>
        <li>A standpipe system is required unless the building is sprinklered throughout when:
            <ul>
                <li>the building exceeds 3 storeys,</li>
                <li>the building height exceeds 14 m, or</li>
                <li>the building area exceeds the limits in Table 3.2.5.8 for its height.</li>
            </ul>
        </li>
    </ul>
    <h3>Sprinkler System Standards (BCBC 3.2.5.12)</h3>
    <ul>
        <li>Sprinkler systems must conform to NFPA 13 unless NFPA 13R or NFPA 13D is permitted based on occupancy and building height.</li>
        <li>NFPA 13R permitted in certain low-rise Group C buildings and small care occupancies.</li>
        <li>NFPA 13D permitted in one- and two-family dwellings and small care occupancies with limited residents.</li>
        <li>Buildings with fewer than 9 sprinklers may use the domestic water supply if flow requirements are met.</li>
        <li>Sprinklers cannot be omitted in any room or closet directly below a roof assembly.</li>
        <li>Fast-response sprinklers required in residential, care, treatment, and detention occupancies.</li>
        <li>Balconies and decks deeper than 610 mm require sprinklers in certain building types.</li>
        <li>Sprinklers in elevator machine rooms must have intermediate-temperature ratings and be protected from damage.</li>
    </ul>
    <h3>Combustible Sprinkler Piping (BCBC 3.2.5.13)</h3>
    <ul>
        <li>Combustible piping permitted only in residential and light-hazard occupancies.</li>
        <li>Piping must comply with ULC/ORD-C199P.</li>
    </ul>
</div>`
            },

            // --- OPT 4: Group D (Business) ---
            Opt4: {
                Heading: "Sprinkler System Notes – Part 9 Group D Business & Personal Services (BCBC 9.10.14.4)",
                Content: `
<div class="sprinkler-notes">
    <h3>Unprotected Openings & Limiting Distance (BCBC 9.10.14.4)</h3>
    <ul>
        <li>When the limiting distance is 2 m or less, individual unprotected openings are limited to:</li>
            <ul>
                <li>the area stated in Table 9.10.14.4.-B, or</li>
                <li>for limiting distances equal to or greater than 1.2 m, the calculated area:</li>
                    <li><p class="displayed-formula">Area = 0.24 × (2 × LD - 1.2)²</p></li>
            </ul>
        </li>
        <li>Sprinklered buildings may double the maximum aggregate area of unprotected openings if all adjacent rooms (including closets and bathrooms) are sprinklered.</li>
    </ul>
    <h3>Water Supply Requirements (BCBC 3.2.5.7)</h3>
    <ul>
        <li>Every building must have an adequate firefighting water supply.</li>
        <li>Buildings sprinklered throughout per 3.2.5.12 or equipped with a standpipe system per 3.2.5.8–3.2.5.10 are deemed compliant.</li>
    </ul>
    <h3>Standpipe System Triggers (BCBC 3.2.5.8)</h3>
    <ul>
        <li>A standpipe system is required unless the building is sprinklered throughout when:
            <ul>
                <li>the building exceeds 3 storeys,</li>
                <li>the building height exceeds 14 m, or</li>
                <li>the building area exceeds the limits in Table 3.2.5.8 for its height.</li>
            </ul>
        </li>
    </ul>
    <h3>Sprinkler System Standards (BCBC 3.2.5.12)</h3>
    <ul>
        <li>Sprinkler systems must conform to NFPA 13 unless NFPA 13R or NFPA 13D is permitted based on occupancy and building height.</li>
        <li>NFPA 13R permitted in certain low-rise residential and care occupancies.</li>
        <li>NFPA 13D permitted in one- and two-family dwellings and small care occupancies.</li>
        <li>Buildings with fewer than 9 sprinklers may use the domestic water supply if flow requirements are met.</li>
        <li>Sprinklers cannot be omitted in any room or closet directly below a roof assembly.</li>
        <li>Fast-response sprinklers required in residential, care, treatment, and detention occupancies.</li>
        <li>Sprinklers required for balconies and decks deeper than 610 mm in certain building types.</li>
        <li>Sprinklers in elevator machine rooms must have intermediate-temperature ratings and be protected from damage.</li>
    </ul>
    <h3>Combustible Sprinkler Piping (BCBC 3.2.5.13)</h3>
    <ul>
        <li>Combustible piping permitted only in residential and light-hazard occupancies.</li>
        <li>Piping must comply with ULC/ORD-C199P.</li>
    </ul>
</div>`
            },

            // --- OPT 5: Group E (Mercantile) ---
            Opt5: {
                Heading: "Sprinkler System Notes – Part 9 Group E Mercantile (BCBC 9.10.14.4)",
                Content: `
<div class="sprinkler-notes">
    <h3>Unprotected Openings & Limiting Distance (BCBC 9.10.14.4)</h3>
    <ul>
        <li>When the limiting distance is 2 m or less, individual unprotected openings are limited to:</li>
            <ul>
                <li>the area stated in Table 9.10.14.4.-B, or</li>
                <li>for limiting distances equal to or greater than 1.2 m, the calculated area:</li>
                    <li><p class="displayed-formula">Area = 0.24 × (2 × LD - 1.2)²</p></li>
            </ul>
        </li>
        <li>Sprinklered buildings may double the maximum aggregate area of unprotected openings if all adjacent rooms (including closets and bathrooms) are sprinklered.</li>
    </ul>
    <h3>Water Supply Requirements (BCBC 3.2.5.7)</h3>
    <ul>
        <li>Every building must have an adequate firefighting water supply.</li>
        <li>Buildings sprinklered throughout per 3.2.5.12 or equipped with a standpipe system per 3.2.5.8–3.2.5.10 are deemed compliant.</li>
    </ul>
    <h3>Standpipe System Triggers (BCBC 3.2.5.8)</h3>
    <ul>
        <li>A standpipe system is required unless the building is sprinklered throughout when:
            <ul>
                <li>the building exceeds 3 storeys,</li>
                <li>the building height exceeds 14 m, or</li>
                <li>the building area exceeds the limits in Table 3.2.5.8 for its height.</li>
            </ul>
        </li>
    </ul>
    <h3>Sprinkler System Standards (BCBC 3.2.5.12)</h3>
    <ul>
        <li>Sprinkler systems must conform to NFPA 13 unless NFPA 13R or NFPA 13D is permitted based on occupancy and building height.</li>
        <li>NFPA 13R permitted in certain low-rise residential and care occupancies.</li>
        <li>NFPA 13D permitted in one- and two-family dwellings and small care occupancies.</li>
        <li>Buildings with fewer than 9 sprinklers may use the domestic water supply if flow requirements are met.</li>
        <li>Sprinklers cannot be omitted in any room or closet directly below a roof assembly.</li>
        <li>Fast-response sprinklers required in residential, care, treatment, and detention occupancies.</li>
        <li>Sprinklers required for balconies and decks deeper than 610 mm in certain building types.</li>
        <li>Sprinklers in elevator machine rooms must have intermediate-temperature ratings and be protected from damage.</li>
    </ul>
    <h3>Combustible Sprinkler Piping (BCBC 3.2.5.13)</h3>
    <ul>
        <li>Combustible piping permitted only in residential and light-hazard occupancies.</li>
        <li>Piping must comply with ULC/ORD-C199P.</li>
    </ul>
</div>`
            },

            // --- OPT 6: Group F2 (Medium Hazard) ---
            Opt6: {
                Heading: "Sprinkler System Notes – Part 9 Group F2 Medium Hazard Industrial (BCBC 9.10.14.4)",
                Content: `
<div class="sprinkler-notes">
    <h3>Unprotected Openings & Limiting Distance (BCBC 9.10.14.4)</h3>
    <ul>
        <li>When the limiting distance is 2 m or less, individual unprotected openings are limited to:</li>
            <ul>
                <li>the area stated in Table 9.10.14.4.-B, or</li>
                <li>for limiting distances equal to or greater than 1.2 m, the calculated area:</li>
                    <li><p class="displayed-formula">Area = 0.24 × (2 × LD - 1.2)²</p></li>
            </ul>
        </li>
        <li>Sprinklered buildings may double the maximum aggregate area of unprotected openings if all adjacent rooms (including closets and bathrooms) are sprinklered.</li>
    </ul>
    <h3>Water Supply Requirements (BCBC 3.2.5.7)</h3>
    <ul>
        <li>Every building must have an adequate firefighting water supply.</li>
        <li>Buildings sprinklered throughout per 3.2.5.12 or equipped with a standpipe system per 3.2.5.8–3.2.5.10 are deemed compliant.</li>
    </ul>
    <h3>Standpipe System Triggers (BCBC 3.2.5.8)</h3>
    <ul>
        <li>A standpipe system is required unless the building is sprinklered throughout when:
            <ul>
                <li>the building exceeds 3 storeys,</li>
                <li>the building height exceeds 14 m, or</li>
                <li>the building area exceeds the limits in Table 3.2.5.8 for its height.</li>
            </ul>
        </li>
    </ul>
    <h3>Sprinkler System Standards (BCBC 3.2.5.12)</h3>
    <ul>
        <li>Sprinkler systems must conform to NFPA 13 unless NFPA 13R or NFPA 13D is permitted based on occupancy and building height.</li>
        <li>NFPA 13R permitted in certain low-rise residential and care occupancies.</li>
        <li>NFPA 13D permitted in one- and two-family dwellings and small care occupancies.</li>
        <li>Buildings with fewer than 9 sprinklers may use the domestic water supply if flow requirements are met.</li>
        <li>Sprinklers cannot be omitted in any room or closet directly below a roof assembly.</li>
        <li>Fast-response sprinklers required in residential, care, treatment, and detention occupancies.</li>
        <li>Sprinklers required for balconies and decks deeper than 610 mm in certain building types.</li>
        <li>Sprinklers in elevator machine rooms must have intermediate-temperature ratings and be protected from damage.</li>
    </ul>
    <h3>Combustible Sprinkler Piping (BCBC 3.2.5.13)</h3>
    <ul>
        <li>Combustible piping permitted only in residential and light-hazard occupancies.</li>
        <li>Piping must comply with ULC/ORD-C199P.</li>
    </ul>
</div>`
            },

            // --- OPT 7: Group F3 (Low Hazard) ---
            Opt7: {
                Heading: "Sprinkler System Notes – Part 9 Group F3 Low Hazard Industrial (BCBC 9.10.14.4)",
                Content: `
<div class="sprinkler-notes">
    <h3>Unprotected Openings & Limiting Distance (BCBC 9.10.14.4)</h3>
    <ul>
        <li>When the limiting distance is 2 m or less, individual unprotected openings are limited to:</li>
            <ul>
                <li>the area stated in Table 9.10.14.4.-B, or</li>
                <li>for limiting distances equal to or greater than 1.2 m, the calculated area:</li>
                    <li><p class="displayed-formula">Area = 0.24 × (2 × LD - 1.2)²</p></li>
            </ul>
        </li>
        <li>Sprinklered buildings may double the maximum aggregate area of unprotected openings if all adjacent rooms (including closets and bathrooms) are sprinklered.</li>
    </ul>
    <h3>Water Supply Requirements (BCBC 3.2.5.7)</h3>
    <ul>
        <li>Every building must have an adequate firefighting water supply.</li>
        <li>Buildings sprinklered throughout per 3.2.5.12 or equipped with a standpipe system per 3.2.5.8–3.2.5.10 are deemed compliant.</li>
    </ul>
    <h3>Standpipe System Triggers (BCBC 3.2.5.8)</h3>
    <ul>
        <li>A standpipe system is required unless the building is sprinklered throughout when:
            <ul>
                <li>the building exceeds 3 storeys,</li>
                <li>the building height exceeds 14 m, or</li>
                <li>the building area exceeds the limits in Table 3.2.5.8 for its height.</li>
            </ul>
        </li>
    </ul>
    <h3>Sprinkler System Standards (BCBC 3.2.5.12)</h3>
    <ul>
        <li>Sprinkler systems must conform to NFPA 13 unless NFPA 13R or NFPA 13D is permitted based on occupancy and building height.</li>
        <li>NFPA 13R permitted in certain low-rise residential and care occupancies.</li>
        <li>NFPA 13D permitted in one- and two-family dwellings and small care occupancies.</li>
        <li>Buildings with fewer than 9 sprinklers may use the domestic water supply if flow requirements are met.</li>
        <li>Sprinklers cannot be omitted in any room or closet directly below a roof assembly.</li>
        <li>Fast-response sprinklers required in residential, care, treatment, and detention occupancies.</li>
        <li>Sprinklers required for balconies and decks deeper than 610 mm in certain building types.</li>
        <li>Sprinklers in elevator machine rooms must have intermediate-temperature ratings and be protected from damage.</li>
    </ul>
    <h3>Combustible Sprinkler Piping (BCBC 3.2.5.13)</h3>
    <ul>
        <li>Combustible piping permitted only in residential and light-hazard occupancies.</li>
        <li>Piping must comply with ULC/ORD-C199P.</li>
    </ul>
</div>`
            }
        };

        // Opt3 maps to Opt2
        notes.Opt3 = notes.Opt2;

        return notes[Opt] || { Heading: "", Content: "" };
    }

    // ============================
    // PART 6
    // ============================
    // ============================
    // 6.1 WALL FACE CAPTURE & REPORT
    // ============================

    function parseNumberFromString(v) {
        if (v === null || v === undefined) return NaN;
        if (typeof v === 'number') return v;
        const s = String(v).replace(/,/g, '').trim();
        const m = s.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }

    function formatNumberSmart(value, decimals) {
        if (value === null || value === undefined) return null;
        const n = Number(value);
        if (!isFinite(n)) return null;
        const fixed = n.toFixed(decimals);
        if (decimals === 0) return String(Math.round(n));
        if (fixed.indexOf('.') !== -1) {
            return fixed.replace(/\.?0+$/, '');
        }
        return fixed;
    }

    function formatMetricImperial(metricValOrStr, imperialValOrStr) {
        const mNum = parseNumberFromString(metricValOrStr);
        const fNum = parseNumberFromString(imperialValOrStr);
        const sqftPerM2 = (typeof SQFT_PER_M2 !== 'undefined') ? SQFT_PER_M2 : 10.7639;

        if (!isNaN(mNum)) {
            const mStr = (formatNumberSmart(mNum, 1) ?? mNum.toFixed(1)) + " m²";
            const ft = (!isNaN(fNum)) ? fNum : (mNum * sqftPerM2);
            const ftStr = (formatNumberSmart(ft, 2) ?? ft.toFixed(2)) + " ft²";
            return mStr + " / " + ftStr;
        }

        if (!isNaN(fNum)) {
            const ftStr = (formatNumberSmart(fNum, 2) ?? fNum.toFixed(2)) + " ft²";
            return ftStr;
        }

        const raw = (metricValOrStr || imperialValOrStr || "—");
        return String(raw);
    }
    function _wallFaceEquals(a, b) {
        if (!a || !b) return false;

        const keys = [
            'Name', 'Area_m2', 'Area_ft2', 'LimitDist_m', 'LimitDist_ft',
            'MaxOpen_m2', 'MaxPctAllowed', 'MaxIndivOpen_m2', 'ActualPct',
            'Openings_m2', 'Openings_ft2', 'Frr', 'Conreq', 'Clad',
            'PassFail', 'IsSprink',
            // ADDED: Ratio properties to ensure uniqueness
            'BuildingWidth_m', 'BuildingHeight_m'
        ];

        for (let k of keys) {
            const va = (a[k] === undefined || a[k] === null) ? "" : String(a[k]);
            const vb = (b[k] === undefined || b[k] === null) ? "" : String(b[k]);
            if (va !== vb) return false;
        }

        return true;
    }

    // ============================
    // 7.2 BUILD REPORT LINES (for PDF + Clipboard)
    // ============================
    function buildReportLines(forPdf = false) {
        if (typeof UpdateSprinklerStandard === 'function') UpdateSprinklerStandard();
        const lines = [];

        // A. Heading
        lines.push("INTERPOLATION CALCULATOR FOR SPATIAL SEPARATION RESULTS");
        lines.push("Gerwulf Systems ©2025");

        // B. Disclaimer - FIXED: Full text restored
        lines.push("NOTE: Code References are to the 2024 Edition of the BC Building Code. While every effort has been made to ensure accuracy, it is the responsibility of the user to confirm all references and calculations are correct before using any data, calculations, or references in real life application. Gerwulf Systems cannot be held responsible for any errors or omissions while this tool and information is used. All users should do their own due diligence to ensure spatial separations and all code requirements are being met for their own projects. This calculator is provided as tools to help determine the allowable area of unprotected openings according to the BC Building Code Requirements in 9.10.14. and 9.10.15. Please note that the BC Building Code does not give explicit permission to use interpolations of the tables to determine permitted unprotected openings. The final decision as to whether interpolations are permitted rests with the Authority Having Jurisdiction (AHJ). It is recommended that you consult the AHJ to confirm whether or not interpolations of the tables are acceptable.");
        lines.push("");

        // C. Data Capture
        const projName = safeEl('projName')?.value || "—";
        const projLocation = safeEl('projLocation')?.value || "—";
        const projClient = safeEl('projClient')?.value || "—";
        const projUser = safeEl('projUser')?.value || "—";
        const projDate = safeEl('projDate')?.value || "—";

        const tableSelect = safeEl('tableSelect');
        const buildingClass = tableSelect ? (tableSelect.options[tableSelect.selectedIndex]?.text || "—") : "—";
        const fireResp = safeEl('fireRespHigh')?.checked ? "Greater Than 10 min" : "10 min or Less";
        const isSprinklered = !!safeEl('sprinkYes')?.checked;
        const sprinkStr = isSprinklered ? "Sprinklered" : "Non-sprinklered";

        lines.push("SPATIAL SEPARATION CALCULATION RESULTS");
        lines.push("");

        // D. Project Information (Only push if hasData)
        lines.push("PROJECT INFORMATION");
        if (hasData(projName)) lines.push("Project Name: " + projName);
        if (hasData(projLocation)) lines.push("Project Location / Address: " + projLocation);
        if (hasData(projClient)) lines.push("Client Name: " + projClient);
        if (hasData(projUser)) lines.push("Designer / User Name: " + projUser);
        if (hasData(projDate)) lines.push("Date: " + projDate);
        lines.push("");

        // E. Building Classification
        lines.push("BUILDING CLASSIFICATION");
        if (hasData(buildingClass)) lines.push("Building Classification: " + buildingClass);
        lines.push("Fire Response Time: " + fireResp);
        lines.push("Sprinkler System: " + sprinkStr);

        // Modification: Only show Standard if Sprinklered
        if (isSprinklered) {
            const sprinkStandard = safeEl('sprinkStandard')?.textContent || "—";
            if (hasData(sprinkStandard)) {
                lines.push("Sprinkler System Design Standard: " + sprinkStandard);
            }
        }
        lines.push("");

        // F. Wall Faces 
        if (Array.isArray(window.WallFaces)) {
            window.WallFaces.forEach((wf, index) => {
                const name = wf.Name || ('Wall Face ' + (index + 1));
                const area_m2 = wf.Area_m2 || "—";
                const area_ft2 = wf.Area_ft2 || "—";
                const limitDist_m = wf.LimitDist_m || "—";
                const limitDist_ft = wf.LimitDist_ft || "—";

                // Use formatting helpers
                const maxOpen_display = formatMetricImperial(wf.MaxOpen_m2, wf.MaxOpen_ft2);
                const actualOpen_display = formatMetricImperial(wf.Openings_m2, wf.Openings_ft2);
                const indiv_display = formatMetricImperial(wf.MaxIndivOpen_m2, wf.MaxIndivOpen_ft2);

                lines.push("WALL FACE " + (index + 1) + ": " + name);
                lines.push("Wall Area: " + area_m2 + " m² / " + area_ft2 + " ft²");
                lines.push("Limiting Distance: " + limitDist_m + " m / " + limitDist_ft + " ft");
                lines.push("Maximum Area of Unprotected Openings Permitted: " + maxOpen_display);
                lines.push("Actual Area of Unprotected Openings: " + actualOpen_display);
                lines.push("Maximum Percentage of Openings Allowed: " + (wf.MaxPctAllowed || "—"));
                lines.push("Actual Percentage of Openings: " + (wf.ActualPct || "—"));

                // Modification: Use pre-calculated RatioDisplay from captureCurrentWallFace
                if (hasData(wf.RatioDisplay)) {
                    lines.push("Width to Height Ratio: " + wf.RatioDisplay + " (" + wf.BuildingWidth_m + "m / " + wf.BuildingHeight_m + "m)");
                }

                if (hasData(wf.MaxIndivOpen_m2)) {
                    lines.push("Maximum Area of Individual Unprotected Openings: " + indiv_display);
                }

                if (hasData(wf.Frr)) lines.push("Minimum Fire-Resistance Rating of Wall: " + wf.Frr);
                if (hasData(wf.Conreq)) lines.push("Type of Construction Required: " + wf.Conreq);
                if (hasData(wf.Clad)) lines.push("Type of Cladding Required: " + wf.Clad);

                if (hasData(wf.MaxFaceArea_m2)) {
                    lines.push("Maximum Area of Exposed Building Face for Combustible Cladding: " +
                        wf.MaxFaceArea_m2 + " m² / " +
                        (Math.round((wf.MaxFaceArea_ft2 || 0) * 100) / 100) + " ft²");
                }

                lines.push("Result: " + (wf.PassFail || "—"));
                if (wf.Comments && wf.Comments !== "") {
                    lines.push("Comments: " + wf.Comments);
                }

                lines.push("");
            });
        }

        // ============================
        // 7.3 SPRINKLER SYSTEM NOTES - FIXED ENCODING
        // ============================
        const sprinkYes = safeEl('sprinkYes')?.checked;
        if (sprinkYes) {
            const tableOpt = safeEl('tableSelect')?.value || "Opt1";
            const notes = getSprinklerNotesHtml(tableOpt);

            if (notes && (notes.Heading || notes.Content)) {
                lines.push("");
                lines.push("SPRINKLER SYSTEM NOTES");
                lines.push("----------------------");

                if (notes.Heading) {
                    lines.push(cleanUnicode(notes.Heading));  // ← Apply cleanUnicode
                    lines.push("");
                }

                if (notes.Content) {
                    const tempDiv = document.createElement("div");
                    tempDiv.innerHTML = notes.Content;

                    const elements = tempDiv.querySelectorAll("h3, li, p.displayed-formula");

                    elements.forEach(el => {
                        if (el.tagName === "LI" && el.querySelector('.displayed-formula')) {
                            return;
                        }

                        let text = el.textContent.trim();
                        if (!text) return;

                        // Clean Unicode BEFORE applying replacements
                        text = cleanUnicode(text);  // ← Apply cleanUnicode

                        text = text.replace(/≥/g, 'equal to or greater than')
                            .replace(/×/g, 'x')
                            .replace(/²/g, '^2');

                        if (el.tagName === "H3") {
                            lines.push(text);
                        }
                        else if (el.tagName === "LI") {
                            const isNested = el.parentElement.closest('li') !== null;
                            const prefix = isNested ? "      " : "• ";
                            lines.push(prefix + text.replace(/\s+/g, ' '));
                        }
                        else if (el.classList.contains('displayed-formula')) {
                            if (forPdf) {
                                lines.push("FORMULA_BLOCK:Area = 0.24 x (2 x LD - 1.2)2");
                            } else {
                                lines.push("    Area = 0.24 x (2 x LD - 1.2)²");
                            }
                        }
                    });
                }
                lines.push("");
            }
        }

        return lines;
    }

    // Expose buildReportLines globally for combined report system
    window.buildReportLines = buildReportLines;

    // ============================
    // 7.4 CLIPBOARD BUILDER
    // ============================
    function buildEmailBodyText() {
        const lines = buildReportLines();
        return lines.join("\r\n");
    }

    function CopyReportToClipboard() {
        const text = buildEmailBodyText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('emailResults') || document.getElementById('copyReportBtn');
                if (btn) {
                    const orig = btn.textContent;
                    btn.textContent = "Copied";
                    setTimeout(function () { btn.textContent = orig; }, 1500);
                }
            }).catch(function () {
                fallbackCopyText(text);
            });
        } else {
            fallbackCopyText(text);
        }
    }

    function fallbackCopyText(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            const btn = document.getElementById('emailResults') || document.getElementById('copyReportBtn');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = "Copied";
                setTimeout(function () { btn.textContent = orig; }, 1500);
            }
        } catch (e) { }
        document.body.removeChild(ta);
    }

    // ============================
    // PART 8
    // ============================
    // ========================================================
    // 8.1 PDF GENERATOR
    // ========================================================
    function SetupPDFButton() {
        const btn = document.getElementById('downloadPDF') || document.getElementById('btnDownloadPdf');
        if (!btn) {
            console.warn("PDF Button not found in DOM");
            return;
        }

        // REMOVE any existing listener first to prevent the "double-firing/dead button" bug
        btn.removeEventListener('click', handlePdfGeneration);
        // ATTACH the clean listener
        btn.addEventListener('click', handlePdfGeneration);
    }

    // Named function for reliable event handling
    async function handlePdfGeneration(e) {
        const btn = e.currentTarget;

        // 1. Check for library
        if (!window.jspdf) {
            alert("PDF library not loaded. Please ensure you have internet access.");
            return;
        }

        // 2. Prevent multiple clicks while generating
        if (btn.disabled) return;
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = "Generating PDF...";

        try {
            const { jsPDF } = window.jspdf;
            const lines = buildReportLines(true);
            const pdf = new jsPDF('p', 'mm', 'letter');

            // Styles & Config
            const fontFamily = 'helvetica';
            const fontSize = 10;
            const lineHeight = 6;
            const sectionSpacing = 5.6;
            const sectionPadding = 3.5;
            const marginLeft = 18;
            const marginRight = 18;
            const marginTop = 18;
            const marginBottom = 18;

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const usableWidth = pageWidth - marginLeft - marginRight;

            let y = marginTop;

            // --- PDF INTERNAL HELPERS ---
            function EnsureSpace(required = lineHeight) {
                if (y + required > pageHeight - marginBottom) {
                    pdf.addPage();
                    y = marginTop;
                    pdf.setFont(fontFamily, 'normal');
                    pdf.setFontSize(fontSize);
                }
            }

            function renderBlock(text, { fontStyle = 'normal', justify = false, indent = 0 } = {}) {
                if (!text) return;
                pdf.setFont(fontFamily, fontStyle);
                pdf.setFontSize(fontSize);
                const wrapped = pdf.splitTextToSize(String(text), usableWidth - indent);
                wrapped.forEach(line => {
                    EnsureSpace(lineHeight);
                    pdf.text(line, marginLeft + indent, y, { align: justify ? 'justify' : 'left' });
                    y += lineHeight;
                });
            }

            // --- RENDERING LOGIC ---
            if (lines.length > 0) renderBlock(lines[0], { fontStyle: 'bold' });
            if (lines.length > 1) renderBlock(lines[1]);
            y += sectionPadding;

            const sectionHeaders = [
                "PROJECT INFORMATION",
                "BUILDING CLASSIFICATION",
                "SPRINKLER SYSTEM NOTES",
                "SPATIAL SEPARATION CALCULATION RESULTS"
            ];

            for (let i = 2; i < lines.length; i++) {
                let text = lines[i];
                if (!text || text.trim() === "") continue;

                // --- WALL FACE PAGE BREAK LOGIC ---
                if (text.startsWith("WALL FACE ")) {
                    const estimatedBlockHeight = 90;
                    if (y + estimatedBlockHeight > pageHeight - marginBottom) {
                        pdf.addPage();
                        y = marginTop;
                        pdf.setFont(fontFamily, 'normal');
                        pdf.setFontSize(fontSize);
                    }
                    y += sectionSpacing;
                    renderBlock(text, { fontStyle: 'bold' });
                    continue;
                }

                // --- SPRINKLER NOTES PAGE BREAK LOGIC (NEW) ---
                if (text === "SPRINKLER SYSTEM NOTES") {
                    // Always start sprinkler notes on a new page
                    // Only add page if we're not already at the top
                    if (y > marginTop + lineHeight) {
                        pdf.addPage();
                        y = marginTop;
                        pdf.setFont(fontFamily, 'normal');
                        pdf.setFontSize(fontSize);
                    }
                    y += sectionSpacing;
                    renderBlock(text, { fontStyle: 'bold' });
                    continue;
                }

                const isMajorSection = sectionHeaders.includes(text);
                if (isMajorSection) {
                    EnsureSpace(sectionSpacing + (lineHeight * 2));
                    y += sectionSpacing;
                    renderBlock(text, { fontStyle: 'bold' });
                    continue;
                }

                // Subheaders (BCBC References)
                if (text.includes("(BCBC") && !isMajorSection) {
                    EnsureSpace(lineHeight * 2);
                    y += 2;
                    renderBlock(text, { fontStyle: 'bold' });
                    continue;
                }

                // Formula Logic
                if (text.startsWith("FORMULA_BLOCK:")) {
                    const formulaText = text.replace("FORMULA_BLOCK:", "");
                    const basePart = formulaText.substring(0, formulaText.length - 1);
                    const superPart = formulaText.slice(-1);
                    EnsureSpace(lineHeight + 6);
                    y += 3;
                    pdf.setFont(fontFamily, 'italic');
                    pdf.text(basePart, marginLeft + 15, y);
                    const baseWidth = pdf.getTextWidth(basePart);
                    pdf.setFontSize(fontSize * 0.6);
                    pdf.text(superPart, marginLeft + 15 + baseWidth + 0.4, y - 2.2);
                    pdf.setFontSize(fontSize);
                    pdf.setFont(fontFamily, 'normal');
                    y += lineHeight + 3;
                    continue;
                }

                // Bullet points
                if (text.trim().startsWith("•")) {
                    const isNested = text.startsWith("    ");
                    renderBlock(text.trim(), { indent: isNested ? 12 : 6 });
                    continue;
                }

                renderBlock(text);
            }

            // Page Numbers
            const pageCount = pdf.getNumberOfPages();
            for (let p = 1; p <= pageCount; p++) {
                pdf.setPage(p);
                pdf.setFontSize(8);
                pdf.text(`Page ${p} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            // Filename Logic
            const projectInput = document.getElementById('projName')?.value.trim();
            const cleanName = projectInput ? projectInput.replace(/[^a-z0-9]/gi, '_') : 'Project';
            const fileName = `${cleanName}-Spatial-Report.pdf`;

            pdf.save(fileName);

        } catch (err) {
            console.error("PDF Error:", err);
            alert("An error occurred while generating the PDF.");
        } finally {
            // RESET BUTTON STATE: This is the key to making the button clickable again
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }

    // ============================
    // 8.2 SPRINKLER HELPERS
    // ============================
    function UpdateSprinklerStandard() {
        const isSprink = !!safeEl('sprinkYes')?.checked;
        const tableOpt = safeEl('tableSelect')?.value;
        const sprinkLabel = safeEl('sprinkStandard');

        if (!sprinkLabel) return;

        let standard = "—";

        if (isSprink) {
            // Precise logic from your 2.3 version
            if (tableOpt === "Opt1") {
                standard = "NFPA 13D";
            } else if (tableOpt === "Opt2") {
                standard = "NFPA 13R";
            } else if (["Opt3", "Opt4", "Opt5", "Opt6", "Opt7"].includes(tableOpt)) {
                standard = "NFPA 13";
            }
        }

        // A. Update the UI
        sprinkLabel.textContent = standard;

        // B. Update Global State (Crucial for PDF/Bridge integrity)
        if (window.CurrentSprinklerState) {
            window.CurrentSprinklerState.SprinklerStandard = standard;
        }
    }

    // ============================
    // 8.3 TRAFFIC CONTROLLER (moved from 8.4)
    // ============================

    // ========================================================
    // 8.4 THE TRAFFIC CONTROLLER (The "Hard Gate")
    // ========================================================
    function SynchronizeResultsVisibility() {
        const isSprinkMode = document.getElementById('sprinkYes')?.checked;
        const nsTable = document.getElementById('sprinkResultsTable');
        const sTable = document.getElementById('sprinkResultsTable2');

        // A. Data checks (Looking specifically at Area results, ignoring Pass/Fail)
        const hasNsData = (document.getElementById('maxOpen_m2')?.textContent || "").trim() !== "—";
        const hasSprData = (document.getElementById('maxOpenSpr_m2')?.textContent || "").trim() !== "—";

        // B. Non-Sprinkler Table: Strict (Mode must be NO and must have data)
        if (nsTable) {
            nsTable.style.display = (!isSprinkMode && hasNsData) ? "block" : "none";
        }

        // C. Sprinkler Table: Strict (Mode must be YES and must have data)
        if (sTable) {
            sTable.style.display = (isSprinkMode && hasSprData) ? "block" : "none";
        }
    }

    // ========================================================
    // 8.5 THE RADIO TOGGLE FUNCTION
    // ========================================================
    function UpdateSprinklerMode() {
        const isSprink = document.getElementById('sprinkYes')?.checked;
        const sTable = document.getElementById('sprinkResultsTable2');
        const nsTable = document.getElementById('sprinkResultsTable');

        // A. DATA-DRIVEN TOGGLE (Ensures tables only show if they contain calculations)
        if (isSprink) {
            if (nsTable) nsTable.style.display = "none";

            // Only show Sprinkler table if it actually has calculated results
            const hasSprData = (document.getElementById('maxOpenSpr_m2')?.textContent || "").trim() !== "—";
            if (sTable) sTable.style.display = hasSprData ? "block" : "none";
        } else {
            if (sTable) sTable.style.display = "none";

            // Only show NS table if it actually has calculated results
            const hasNsData = (document.getElementById('maxOpen_m2')?.textContent || "").trim() !== "—";
            if (nsTable) nsTable.style.display = hasNsData ? "block" : "none";
        }

        // B. Standard UI Toggles (Notes)
        if (safeEl('sprinkNotesSection')) {
            safeEl('sprinkNotesSection').style.display = isSprink ? "block" : "none";
        }

        // C. Clean up notes if switching away
        if (!isSprink) {
            if (safeEl('sprinkNotes')) safeEl('sprinkNotes').checked = false;
            if (safeEl('sprinkNotesBox')) safeEl('sprinkNotesBox').style.display = "none";
        }

        // D. Trigger recalculation to fill the table with fresh numbers
        if (typeof UpdateSprinklerResults === "function") {
            UpdateSprinklerResults();
        }
    }

    // ============================
    // 8.6 SPRINKLER NOTES BOX (UI)
    // ============================
    function UpdateSprinklerNotes() {
        const tableOpt = document.getElementById('tableSelect').value;
        const headingEl = document.getElementById('sprinkNotesHeading');
        const contentEl = document.getElementById('sprinkNotesContent');
        const notesBox = document.getElementById('sprinkNotesBox');
        const notesCheck = document.getElementById('sprinkNotes').checked;

        if (!notesCheck) {
            if (notesBox) notesBox.style.display = "none";
            if (headingEl) headingEl.textContent = "";
            if (contentEl) contentEl.innerHTML = "";
            return;
        }

        if (notesBox) notesBox.style.display = "block";

        // Calling updated helper that returns PascalCase keys
        const notes = getSprinklerNotesHtml(tableOpt);

        if (headingEl) headingEl.textContent = notes.Heading || "";
        if (contentEl) contentEl.innerHTML = notes.Content || "";
    }

    // ============================
    // 8.7 CALCULATION METHOD DISCLAIMER (UI)
    // ============================
    function UpdateCalculationMethodDisclaimer() {
        const disclaimer = safeEl('interpolationDisclaimer');
        if (!disclaimer) return;

        const isInterpolation = safeEl('calcInterpolation')?.checked ?? true;
        disclaimer.style.display = isInterpolation ? 'block' : 'none';
    }


    // ============================
    // PART 9
    // ============================

    // ============================
    // 9.1 PROJECT RESET BUTTON - FIXED WITH SAVE BEFORE CLEAR
    // ============================
    function newProject() {
        console.log("🆕 Starting New Project...");

        try {
            // --- STEP 0: SAVE CURRENT PROJECT BEFORE CLEARING ---
            if (window.currentActiveProjectName && typeof window.SaveProject === 'function') {
                console.log("💾 Saving current project before creating new project");
                window.SaveProject();
            }

            // ----------------------------
            // 9.1.1 SCROLL TO TOP
            // ----------------------------
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // ----------------------------
            // 9.1.2 CLEAR ALL INPUT FIELDS
            // ----------------------------
            const fieldsToClear = [
                'projName', 'projLocation', 'projClient', 'projUser',
                'wallFaceName',
                'areaFace_m2', 'areaFace_ft2',
                'limitDist_m', 'limitDist_ft',
                'openings_m2', 'openings_ft2',
                'buildingWidth_m', 'buildingWidth_ft',
                'buildingHeight_m', 'buildingHeight_ft',
                // Opening-specific fields from Unprotected Openings tab
                'openingWidth_m', 'openingWidth_ft',
                'openingHeight_m', 'openingHeight_ft',
                'openingArea_m2', 'openingArea_ft2'
            ];

            fieldsToClear.forEach(id => {
                try {
                    const el = safeEl(id);
                    if (el) {
                        el.value = "";
                        // Clear dataset.full for imperial fields
                        if (el.dataset) delete el.dataset.full;
                    }
                } catch (e) {
                    console.warn('Error clearing field:', id, e);
                }
            });

            // B. RESET RADIO BUTTONS & CHECKBOXES
            try {
                const sprinkYes = safeEl('sprinkYes');
                const sprinkNo = safeEl('sprinkNo');
                const fireRespNormal = safeEl('fireRespNormal');
                const fireRespHigh = safeEl('fireRespHigh');
                const sprinkNotes = safeEl('sprinkNotes');

                if (sprinkYes) sprinkYes.checked = false;
                if (sprinkNo) sprinkNo.checked = true;
                if (fireRespHigh) fireRespHigh.checked = false;
                if (fireRespNormal) fireRespNormal.checked = true;
                if (sprinkNotes) sprinkNotes.checked = false;

                // Reset opening-specific radios
                const openingWindow = safeEl('openingWindow');
                const openingDoor = safeEl('openingDoor');
                const openingRough = safeEl('openingRough');
                const openingActual = safeEl('openingActual');

                if (openingWindow) openingWindow.checked = true;
                if (openingDoor) openingDoor.checked = false;
                if (openingRough) openingRough.checked = true;
                if (openingActual) openingActual.checked = false;

                // C. Reset table selector to Opt1
                const tableSel = safeEl('tableSelect');
                if (tableSel) tableSel.value = "Opt1";
            } catch (e) {
                console.warn('Error resetting radio buttons:', e);
            }

            // ----------------------------
            // 9.1.3 CLEAR ALL OUTPUT FIELDS
            // ----------------------------
            const outputsToClear = [
                'maxOpen_m2', 'maxOpen_ft2',
                'maxPctAllowed',
                'actualPct_m2', 'actualPct_ft2',
                'passFail',
                'nsCalcMaxOpen_m2', 'nsCalcMaxOpen_ft2',
                'frr', 'conreq', 'clad',
                'maxOpenSpr_m2', 'maxOpenSpr_ft2',
                'actualPctSpr_m2', 'actualPctSpr_ft2',
                'maxPctAllowedSpr', 'passFailSpr',
                'sprinkStandard',
                // Opening-specific outputs
                'aggregateWallFaceName',
                'aggregateTotalM2',
                'aggregateTotalFt2',
                'wallFaceNameDisplay',
                'totalAreaFace_m2',
                'totalAreaFace_ft2'
            ];

            outputsToClear.forEach(id => {
                try {
                    const el = safeEl(id);
                    if (el) el.textContent = "—";
                } catch (e) {
                    console.warn('Error clearing output:', id, e);
                }
            });

            // ----------------------------
            // 9.1.4 RESET INTERNAL STATE
            // ----------------------------
            window.WallFaces = [];
            window.currentActiveProjectName = null; // Clear the active project name
            window.LdOverrideActive = false;

            // Wipe both versions of the deleted array to be safe
            window.DeletedWallFaces = [];
            window.deletedWallFaces = [];

            // CRITICAL FIX: Clear UO wall faces from UnprotectedOpeningsCalculator.js
            try {
                if (window.__bcabd_debug && typeof window.__bcabd_debug.setWallFaces === 'function') {
                    window.__bcabd_debug.setWallFaces([]);
                    console.log("🧹 Cleared UO wall faces");
                }
            } catch (e) {
                console.error('❌ Error clearing UO wall faces:', e);
            }

            // Clear opening-specific lists and containers
            try {
                const currentOpeningsList = safeEl('currentOpeningsList');
                if (currentOpeningsList) {
                    currentOpeningsList.innerHTML = '<p class="placeholder">No openings added to this wall face yet.</p>';
                }

                const wallFacesList = safeEl('wallFacesList');
                if (wallFacesList) {
                    wallFacesList.innerHTML = '<p class="placeholder">Enter inputs above and click \'Add Wall Face\', then use the export buttons to copy or download the report.</p>';
                }

                const projectReportContent = safeEl('projectReportContent');
                if (projectReportContent) {
                    projectReportContent.innerHTML = '<p class="placeholder">Enter inputs above and click \'Add Wall Face\', then generate the report.</p>';
                }
            } catch (e) {
                console.error('❌ Error clearing containers:', e);
            }

            // Clear all cached reports (combined-app.js)
            try {
                if (window.cachedReports) {
                    window.cachedReports = {
                        combined: { html: '', text: '' },
                        unprotected: { html: '', text: '' },
                        spatial: { html: '', text: '' }
                    };
                }
            } catch (e) {
                console.warn('Error clearing cached reports:', e);
            }

            // Clear all report containers
            try {
                const combinedReportContent = safeEl('combinedReportContent');
                if (combinedReportContent) {
                    combinedReportContent.innerHTML = '<p class="placeholder">No data available yet.</p>';
                }

                const unprotectedReportContent = safeEl('unprotectedReportContent');
                if (unprotectedReportContent) {
                    unprotectedReportContent.innerHTML = '<p class="placeholder">No data available yet.</p>';
                }

                const spatialReportContainer = safeEl('spatialReportContainer');
                if (spatialReportContainer) {
                    const spatialReportContent = spatialReportContainer.querySelector('#projectReportContent');
                    if (spatialReportContent) {
                        spatialReportContent.innerHTML = '<p class="placeholder">No data available yet.</p>';
                    }
                }
            } catch (e) {
                console.warn('Error clearing report containers:', e);
            }

            // Clear wall face links
            try {
                if (window.spatialWallFaceLinks) {
                    window.spatialWallFaceLinks = {};
                }
            } catch (e) {
                console.warn('Error clearing wall face links:', e);
            }

            // ----------------------------
            // 9.1.5 RESET UI VISIBILITY
            // ----------------------------
            try {
                if (safeEl('widthBlock')) safeEl('widthBlock').style.display = "none";
                if (safeEl('heightBlock')) safeEl('heightBlock').style.display = "none";
                if (safeEl('sprinkNotesBox')) safeEl('sprinkNotesBox').style.display = "none";
            } catch (e) {
                console.warn('Error resetting UI visibility:', e);
            }

            // ----------------------------
            // 9.1.6 RE-RENDER (This will hide the Deleted Wall Face Table)
            // ----------------------------
            try {
                if (typeof RenderWallFacesListForReport === 'function') {
                    RenderWallFacesListForReport();
                }
            } catch (e) {
                console.error('❌ Error rendering wall faces list:', e);
            }

            // ----------------------------
            // 9.1.7 FINAL CLEANUP
            // ----------------------------
            try {
                if (typeof UpdateConstructionTableDisabledState === 'function') {
                    UpdateConstructionTableDisabledState();
                }
                if (typeof UnlockProjectControls === 'function') {
                    UnlockProjectControls();
                }

                // Refresh calculations
                if (typeof UpdateSprinklerResults === 'function') {
                    UpdateSprinklerResults();
                }
            } catch (e) {
                console.warn('Error during final cleanup:', e);
            }

            console.log("🆕 ✅ New project started successfully");
        } catch (e) {
            console.error("❌ CRITICAL ERROR in newProject():", e);
            alert("Error creating new project. Please refresh the page. Error: " + e.message);
        }
    }

    // Expose the function globally
    window.newProject = newProject;


    // ============================
    // 9.2 EVENT LISTENERS
    // ============================
    function AttachListeners() {

        // ============================
        // 9.2.1 AREA (m²)
        // ============================
        if (safeEl('areaFace_m2')) {
            safeEl('areaFace_m2').addEventListener('input', function () {
                if (window.isResettingUI) return;

                StoreRawMetricValue(this);
                SyncAreaFromM2();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('areaFace_m2').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                ApplyRoundedDisplayFromRaw(this);
                SyncAreaFromM2();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        if (safeEl('areaFace_ft2')) {
            safeEl('areaFace_ft2').addEventListener('input', function () {
                if (window.isResettingUI) return;

                SyncAreaFromFt2();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        // ============================
        // 9.2.2 OPENINGS (m²)
        // ============================
        if (safeEl('openings_m2')) {
            safeEl('openings_m2').addEventListener('input', function () {
                if (window.isResettingUI) return;

                StoreRawMetricValue(this);
                SyncAreaFromM2();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('openings_m2').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                ApplyRoundedDisplayFromRaw(this);
                SyncAreaFromM2();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        if (safeEl('openings_ft2')) {
            safeEl('openings_ft2').addEventListener('input', function () {
                if (window.isResettingUI) return;

                SyncAreaFromFt2();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        // ============================
        // 9.2.3 LIMITING DISTANCE (m)
        // ============================
        if (safeEl('limitDist_m')) {
            safeEl('limitDist_m').addEventListener('input', function () {
                if (window.isResettingUI) return;

                StoreRawMetricValue(this);

                requestAnimationFrame(() => {
                    SyncLimitDistFromMetricLive();
                    UpdateSprinklerResults();
                    ApplyFinalCladdingOverride();
                });
            });
            safeEl('limitDist_m').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                ApplyRoundedDisplayFromRaw(this);
                SyncLimitDistFromMetricBlur();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        if (safeEl('limitDist_ft')) {
            safeEl('limitDist_ft').addEventListener('input', function () {
                if (window.isResettingUI) return;

                SyncLimitDistFromImperialLive();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('limitDist_ft').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                SyncLimitDistFromImperialBlur();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        // ============================
        // 9.2.4 WIDTH (m)
        // ============================
        if (safeEl('buildingWidth_m')) {
            safeEl('buildingWidth_m').addEventListener('input', function () {
                if (window.isResettingUI) return;

                StoreRawMetricValue(this);
                SyncWidthFromMetricLive();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('buildingWidth_m').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                ApplyRoundedDisplayFromRaw(this);
                SyncWidthFromMetricBlur();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        if (safeEl('buildingWidth_ft')) {
            safeEl('buildingWidth_ft').addEventListener('input', function () {
                if (window.isResettingUI) return;

                SyncWidthFromImperialLive();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('buildingWidth_ft').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                SyncWidthFromImperialBlur();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        // ============================
        // 9.2.5 HEIGHT (m)
        // ============================
        if (safeEl('buildingHeight_m')) {
            safeEl('buildingHeight_m').addEventListener('input', function () {
                if (window.isResettingUI) return;

                StoreRawMetricValue(this);
                SyncHeightFromMetricLive();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('buildingHeight_m').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                ApplyRoundedDisplayFromRaw(this);
                SyncHeightFromMetricBlur();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        if (safeEl('buildingHeight_ft')) {
            safeEl('buildingHeight_ft').addEventListener('input', function () {
                if (window.isResettingUI) return;

                SyncHeightFromImperialLive();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
            safeEl('buildingHeight_ft').addEventListener('blur', function () {
                if (window.isResettingUI) return;

                SyncHeightFromImperialBlur();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });
        }

        // ============================
        // 9.2.6 FIRE RESPONSE
        // ============================
        if (safeEl('fireRespNormal'))
            safeEl('fireRespNormal').addEventListener('change', function () {
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });

        if (safeEl('fireRespHigh'))
            safeEl('fireRespHigh').addEventListener('change', function () {
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });

        // ============================
        // 9.2.7 SPRINKLER MODE
        // ============================
        if (safeEl('sprinkNo'))
            safeEl('sprinkNo').addEventListener('change', function () {
                UpdateSprinklerMode();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });

        if (safeEl('sprinkYes'))
            safeEl('sprinkYes').addEventListener('change', function () {
                UpdateSprinklerMode();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });

        if (safeEl('sprinkNotes'))
            safeEl('sprinkNotes').addEventListener('change', function () {
                UpdateSprinklerNotes();
                UpdateSprinklerResults();
                ApplyFinalCladdingOverride();
            });

        // ============================
        // 9.2.7 CALCULATION METHOD
        // ============================
        if (safeEl('calcInterpolation')) {
            safeEl('calcInterpolation').addEventListener('change', function () {
                UpdateCalculationMethodDisclaimer();
                UpdateSprinklerResults();
            });
        }

        if (safeEl('calcTabular')) {
            safeEl('calcTabular').addEventListener('change', function () {
                UpdateCalculationMethodDisclaimer();
                UpdateSprinklerResults();
            });
        }

        // ============================
        // 9.2.8 TABLE SELECT
        // ============================
        if (safeEl('tableSelect'))
            safeEl('tableSelect').addEventListener('change', function () {
                updateOpenAirStoreysVisibility();
                updateOpeningsLabels(this.value);
                UpdateSprinklerResults();
                UpdateSprinklerNotes();
                ApplyFinalCladdingOverride();
            });

        // ============================
        // 9.2.9 OPEN-AIR STOREYS
        // ============================
        if (safeEl('openAirYes'))
            safeEl('openAirYes').addEventListener('change', function () {
                UpdateSprinklerResults();
            });

        if (safeEl('openAirNo'))
            safeEl('openAirNo').addEventListener('change', function () {
                UpdateSprinklerResults();
            });
    }

    // ============================
    // PART 10
    // ============================
    // ============================
    // 10.1 ADD WALL FACE - ENHANCED AUTOSAVE
    // ============================
    window.ExecuteAddWallFace = function (shouldClear) {
        // 1. Force final bake of data
        if (typeof UpdateSprinklerResults === 'function') UpdateSprinklerResults(true);

        // 2. Capture the data
        var wf = typeof captureCurrentWallFace === 'function' ? captureCurrentWallFace() : null;

        if (!wf) {
            if (typeof RenderWallFacesListForReport === 'function') RenderWallFacesListForReport();
            return;
        }

        // 2.5. Check if this spatial wall face came from a UO wall face and remove the UO original
        console.log('🔍 [DEBUG] Checking for UO origin of spatial wall face:', wf.Name);
        console.log('🔍 [DEBUG] window.spatialWallFaceLinks exists:', !!window.spatialWallFaceLinks);
        if (window.spatialWallFaceLinks) {
            console.log('🔍 [DEBUG] spatialWallFaceLinks keys:', Object.keys(window.spatialWallFaceLinks));
            console.log('🔍 [DEBUG] Link for this name:', window.spatialWallFaceLinks[wf.Name]);
        }

        if (window.spatialWallFaceLinks && window.spatialWallFaceLinks[wf.Name]) {
            console.log('🔗 This spatial wall face originated from UO wall face:', wf.Name);
            console.log('🔍 [DEBUG] __bcabd_debug exists:', !!window.__bcabd_debug);
            console.log('🔍 [DEBUG] deleteWallFaceByName exists:', typeof window.__bcabd_debug?.deleteWallFaceByName);

            // Remove the UO wall face since it's now been added to spatial
            if (window.__bcabd_debug && typeof window.__bcabd_debug.deleteWallFaceByName === 'function') {
                console.log('🔍 [DEBUG] Calling deleteWallFaceByName for:', wf.Name);
                const deleted = window.__bcabd_debug.deleteWallFaceByName(wf.Name);
                if (deleted) {
                    console.log('✅ Removed UO wall face:', wf.Name);
                } else {
                    console.warn('⚠️ Could not find UO wall face to remove:', wf.Name);
                }
            } else {
                console.error('❌ deleteWallFaceByName function not available');
            }
        } else {
            console.log('ℹ️ No UO origin found for spatial wall face:', wf.Name);
        }

        // 3. Record the Wall
        window.WallFaces = window.WallFaces || [];
        window.WallFaces.push(wf);

        // 4. ACTIVATE LOCK & CLEAR UI (Only if shouldClear is true)
        if (shouldClear) {
            window.isResettingUI = true;

            const inputsToClear = [
                'wallFaceName', 'spatialWallFaceName', 'areaFace_m2', 'areaFace_ft2',
                'limitDist_m', 'limitDist_ft', 'openings_m2', 'openings_ft2',
                'buildingWidth_m', 'buildingWidth_ft', 'buildingHeight_m', 'buildingHeight_ft',
                'wallFaceComments'
            ];
            inputsToClear.forEach(id => {
                if (safeEl(id)) {
                    safeEl(id).value = "";
                    delete safeEl(id).dataset.raw;
                    if (id === 'wallFaceComments') safeEl(id).style.height = 'auto';
                }
            });

            // Clear imperial display spans
            ['limitDist_ftIn', 'buildingWidth_ftIn', 'buildingHeight_ftIn'].forEach(id => {
                if (safeEl(id)) safeEl(id).textContent = "";
            });

            // Clear all output/result fields
            const outputsToClear = [
                'maxOpen_m2', 'maxOpen_ft2', 'maxPctAllowed', 'nsCalcMaxOpen_m2', 'nsCalcMaxOpen_ft2',
                'actualPct_m2', 'actualPct_ft2', 'passFail', 'frr', 'conreq', 'clad',
                'maxOpenSpr_m2', 'maxOpenSpr_ft2', 'actualPctSpr_m2', 'actualPctSpr_ft2',
                'maxPctAllowedSpr', 'passFailSpr', 'sprinkStandard', 'maxFaceAreaCombustible'
            ];
            outputsToClear.forEach(id => {
                if (safeEl(id)) safeEl(id).textContent = "—";
            });

            // Reset pass/fail colors
            if (safeEl('passFail')) safeEl('passFail').style.color = "";
            if (safeEl('passFailSpr')) safeEl('passFailSpr').style.color = "";

            // Hide ALL result tables immediately
            if (safeEl('sprinkResultsTable')) safeEl('sprinkResultsTable').style.display = 'none';
            if (safeEl('sprinkResultsTable2')) safeEl('sprinkResultsTable2').style.display = 'none';
            if (safeEl('constructionReqTable')) {
                safeEl('constructionReqTable').style.display = "none";
                safeEl('constructionReqTable').classList.add("ns-disabled");
            }
        }

        // 5. REFRESH & SAVE (MOVED AUTOSAVE HERE TO ENSURE IT ALWAYS HAPPENS)
        if (typeof RenderWallFacesListForReport === 'function') RenderWallFacesListForReport();
        if (typeof LockProjectControls === 'function') LockProjectControls();

        // AUTOSAVE - Always save after adding a wall face
        if (typeof window.SaveProject === 'function') {
            const projName = document.getElementById('projName')?.value.trim();
            if (projName) {
                console.log("💾 Auto-saving project after adding wall face");
                window.SaveProject();
            } else {
                console.warn("⚠️ Cannot autosave - no project name entered");
            }
        }

        // 6. RELEASE LOCK & RECALCULATE WITH EMPTY DATA
        if (shouldClear) {
            setTimeout(() => {
                window.isResettingUI = false;

                // Force recalculation with empty inputs to get null results
                if (typeof UpdateSprinklerResults === 'function') {
                    UpdateSprinklerResults(true);
                }

                // Ensure construction table state is updated
                if (typeof UpdateConstructionTableDisabledState === 'function') {
                    UpdateConstructionTableDisabledState();
                }

                // Sync result visibility
                if (typeof SynchronizeResultsVisibility === "function") {
                    SynchronizeResultsVisibility();
                }
            }, 100);
        }
    };

    // ============================
    // 10.2 EMAIL / COPY
    // ============================
    const emailBtn = document.getElementById('emailResults') || document.getElementById('copyReportBtn');
    if (emailBtn) {
        emailBtn.addEventListener('click', function () {
            if (typeof CopyReportToClipboard === 'function') CopyReportToClipboard();
        });
    }

    // ============================
    // 10.3 NEW PROJECT
    // ============================
    if (safeEl('newProjectBtn')) {
        safeEl('newProjectBtn').addEventListener('click', function () {
            if (typeof newProject === 'function') newProject();
        });
    }

    if (typeof SetupPDFButton === 'function') SetupPDFButton();

    // ============================
    // 10.4 WALL FACE MANAGEMENT (State)
    // ============================
    // Wall face state management functions are defined in Part 1.7 and Part 2.1
    // - window.removeWallFace (Part 1.7)
    // - window.UndoLastWallFace (Part 2.1)
    // - window.UndoAllWallFaces (Part 2.1)
    // - window.ClearDeletedWallFaces (Part 2.1)
    // - _wallFaceEquals (Part 7.1)

    // ============================
    // 10.5 EDIT WALL FACE BUTTON FUNCTION - COMPLETE FIX
    // ============================
    window.editWallFace = function (index) {
        const wf = window.WallFaces[index];
        if (!wf) {
            console.error("❌ Wall face not found at index:", index);
            return;
        }

        console.log("🔧 EDIT WALL FACE STARTED - Index:", index);
        console.log("📦 Wall Face Data:", wf);

        // --- CRITICAL: CLEAR FLAG IMMEDIATELY ---
        window.isResettingUI = false;

        // --- STEP 1: DELETE FROM LIST ---
        window.WallFaces.splice(index, 1);

        if (window.currentActiveProjectName && window.savedProjects[window.currentActiveProjectName]) {
            window.savedProjects[window.currentActiveProjectName].walls = window.WallFaces;
        }

        RenderWallFacesListForReport();

        if (window.currentActiveProjectName && typeof window.SaveProject === "function") {
            window.SaveProject();
        }

        // --- STEP 2: POPULATE INPUTS WITH VALIDATION ---
        // Populate both name field types (combined and standalone layouts)
        if (safeEl('spatialWallFaceName')) safeEl('spatialWallFaceName').value = wf.Name || "";
        if (safeEl('wallFaceName')) safeEl('wallFaceName').value = wf.Name || "";

        // Helper to validate numbers
        const isValidNumber = (val) => {
            if (!val || val === "—" || val === "" || val === "null") return false;
            const num = parseFloat(val);
            return !isNaN(num) && isFinite(num);
        };

        // Populate all metric input fields
        const metricFields = [
            { id: 'areaFace_m2', value: wf.Area_m2, label: 'Area' },
            { id: 'limitDist_m', value: wf.LimitDist_m, label: 'Limiting Distance' },
            { id: 'openings_m2', value: wf.Openings_m2, label: 'Openings' },
            { id: 'buildingWidth_m', value: wf.BuildingWidth_m, label: 'Width' },
            { id: 'buildingHeight_m', value: wf.BuildingHeight_m, label: 'Height' }
        ];

        console.log("📝 Populating input fields:");
        metricFields.forEach(field => {
            const el = safeEl(field.id);
            if (el && isValidNumber(field.value)) {
                el.value = field.value;
                StoreRawMetricValue(el);
                console.log(`  ✓ ${field.label}: ${field.value}`);
            } else if (el) {
                el.value = "";
                delete el.dataset.raw;
                console.log(`  ⚠ ${field.label}: EMPTY (was ${field.value})`);
            }
        });

        // Populate comments
        if (safeEl('wallFaceComments')) {
            const commentEl = safeEl('wallFaceComments');
            commentEl.value = wf.Comments || "";
            commentEl.style.height = 'auto';
            commentEl.style.height = commentEl.scrollHeight + 'px';
        }

        // --- STEP 3: SYNC CONVERSIONS ---
        console.log("🔄 Syncing unit conversions...");
        if (typeof SyncAreaFromM2 === 'function') SyncAreaFromM2();
        if (typeof SyncLimitDistFromMetricBlur === 'function') SyncLimitDistFromMetricBlur();
        if (typeof SyncWidthFromMetricBlur === 'function') SyncWidthFromMetricBlur();
        if (typeof SyncHeightFromMetricBlur === 'function') SyncHeightFromMetricBlur();

        // --- STEP 4: SHOW RATIO BLOCKS IF APPLICABLE ---
        const hasWidthHeight = isValidNumber(wf.BuildingWidth_m) && isValidNumber(wf.BuildingHeight_m);
        if (hasWidthHeight) {
            if (safeEl('widthBlock')) safeEl('widthBlock').style.display = "block";
            if (safeEl('heightBlock')) safeEl('heightBlock').style.display = "block";
        }

        // --- STEP 5: FORCE CALCULATION ---
        setTimeout(() => {
            console.log("🧮 Triggering calculation with flag:", window.isResettingUI);
            console.log("📊 Current input values:");
            console.log("  Area:", safeEl('areaFace_m2')?.value);
            console.log("  LD:", safeEl('limitDist_m')?.value);
            console.log("  Openings:", safeEl('openings_m2')?.value);
            console.log("  Width:", safeEl('buildingWidth_m')?.value);
            console.log("  Height:", safeEl('buildingHeight_m')?.value);

            // Ensure flag is still false
            window.isResettingUI = false;

            // Trigger calculation
            if (typeof UpdateSprinklerResults === 'function') {
                UpdateSprinklerResults();
                console.log("✅ UpdateSprinklerResults called");
            } else {
                console.error("❌ UpdateSprinklerResults function not found!");
            }

            // --- STEP 6: FORCE RESULT TABLES TO SHOW ---
            setTimeout(() => {
                // Check if we have results
                const hasNsResults = safeEl('maxOpen_m2')?.textContent !== "—";
                const hasSprResults = safeEl('maxOpenSpr_m2')?.textContent !== "—";
                const isSprinkMode = safeEl('sprinkYes')?.checked;

                console.log("📈 Result table status:");
                console.log("  Has NS results:", hasNsResults);
                console.log("  Has Spr results:", hasSprResults);
                console.log("  Sprinkler mode:", isSprinkMode);

                // Force tables to show based on mode and data
                if (!isSprinkMode && hasNsResults) {
                    if (safeEl('sprinkResultsTable')) {
                        safeEl('sprinkResultsTable').style.display = 'block';
                        console.log("  ✓ Showing NS results table");
                    }
                }

                if (isSprinkMode && hasSprResults) {
                    if (safeEl('sprinkResultsTable2')) {
                        safeEl('sprinkResultsTable2').style.display = 'block';
                        console.log("  ✓ Showing Sprinkler results table");
                    }
                }

                // Apply secondary functions
                if (typeof ApplyFinalCladdingOverride === 'function') {
                    ApplyFinalCladdingOverride();
                }

                if (typeof UpdateConstructionTableDisabledState === 'function') {
                    UpdateConstructionTableDisabledState();
                }

                if (typeof SynchronizeResultsVisibility === 'function') {
                    SynchronizeResultsVisibility();
                }

                console.log("🎯 Edit Wall Face Complete");
            }, 500); // Wait for C# calculation to return

        }, 100); // Small delay to ensure DOM is ready

        // --- STEP 7: SCROLL TO INPUT ---
        setTimeout(() => {
            const nameInput = safeEl('wallFaceName');
            if (nameInput) {
                nameInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => {
                    nameInput.focus();
                }, 200);
            }
        }, 700); // After everything else completes
    };

    // ============================
    // 10.5.1 CLEAR COMMENTS HELPER
    // ============================
    window.clearComments = function () {
        const el = document.getElementById('wallFaceComments');
        if (el && el.value.trim() !== "") {
            // Only ask for confirmation if there is actually text to lose
            const confirmClear = confirm("Are you sure you want to clear all comments for this wall face?");
            if (!confirmClear) return;

            el.value = '';
            el.style.height = '40px'; // Resets height to original state

            // Trigger a calculation update so the report reflects the empty field
            if (typeof UpdateSprinklerResults === 'function') {
                UpdateSprinklerResults(false);
            }
        } else if (el) {
            // If it's already empty, just reset the height without asking
            el.style.height = '40px';
        }
    };

    // ============================
    // 10.5.2 RESET FORM HELPER - FIXED
    // ============================
    window.resetWallFaceForm = function () {
        const fields = [
            'wallFaceName', 'areaFace_m2', 'areaFace_ft2',
            'limitDist_m', 'limitDist_ft', 'openings_m2', 'openings_ft2',
            'buildingWidth_m', 'buildingWidth_ft', 'buildingHeight_m', 'buildingHeight_ft'
        ];

        // Clear all text and number inputs
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = "";
                // Critical: Clear ghost data
                delete el.dataset.raw;
            }
        });

        // Clear imperial display spans
        ['limitDist_ftIn', 'buildingWidth_ftIn', 'buildingHeight_ftIn'].forEach(id => {
            if (safeEl(id)) safeEl(id).textContent = "";
        });

        // Clear comments
        const commentEl = document.getElementById('wallFaceComments');
        if (commentEl) {
            commentEl.value = "";
            commentEl.style.height = '40px';
        }

        // Reset visual labels
        if (document.getElementById('maxPctAllowed')) document.getElementById('maxPctAllowed').textContent = "—";
        if (document.getElementById('clad')) document.getElementById('clad').textContent = "—";

        // Hide the calculation results table
        const mainTable = document.getElementById('constructionReqTable');
        if (mainTable) {
            mainTable.style.display = "none";
            mainTable.classList.add("ns-disabled");
        }

        // Hide result tables
        if (safeEl('sprinkResultsTable')) safeEl('sprinkResultsTable').style.display = 'none';
        if (safeEl('sprinkResultsTable2')) safeEl('sprinkResultsTable2').style.display = 'none';

        // Critical: Recalculate with empty data
        if (typeof UpdateSprinklerResults === 'function') UpdateSprinklerResults();

        console.log("🧹 Wall Face input form reset.");
    };

    // ============================
    // 10.5.3 DUPLICATE WALL FACE HELPER - CONFIRMED AUTOSAVE
    // ============================
    window.duplicateWallFace = function () {
        // 1. Check if we have a name (minimum requirement to duplicate)
        const nameEl = safeEl('wallFaceName');
        if (!nameEl || nameEl.value.trim() === "") {
            alert("Please enter a Wall Face Name before duplicating.");
            return;
        }

        // 2. Use the shared Add logic but set 'shouldClear' to false
        // This keeps the data in the form while adding it to the report
        // ExecuteAddWallFace will handle the autosave
        if (typeof ExecuteAddWallFace === 'function') {
            console.log("📋 Duplicating wall face - autosave will trigger");
            ExecuteAddWallFace(false);

            // 3. Visual Feedback: Briefly change the button text so the user knows it worked
            const dupBtn = document.getElementById('duplicateWallFaceBtn');
            if (dupBtn) {
                const originalText = dupBtn.innerText;
                dupBtn.innerText = "✓ Added to List";
                dupBtn.style.backgroundColor = "#5cb85c"; // Temporary Green

                setTimeout(() => {
                    dupBtn.innerText = originalText;
                    dupBtn.style.backgroundColor = ""; // Reset to CSS default
                }, 1000);
            }
        } else {
            console.error("ExecuteAddWallFace function not found. Ensure Section 10.1 is updated.");
        }
    };

    // ============================
    // 10.6 REPORT RENDERING
    // ============================
    function RenderWallFacesListForReport() {
        console.log('🔍 [DEBUG] RenderWallFacesListForReport() called');

        if (typeof UpdateSprinklerStandard === 'function') UpdateSprinklerStandard();

        const container = document.getElementById('projectReportContent');
        const wallFacesListContainer = document.getElementById('wallFacesList'); // Aggregate Openings tab
        const wallFacesListSpatialContainer = document.getElementById('wallFacesListSpatial'); // Spatial Results tab

        console.log('🔍 [DEBUG] Containers found:', {
            projectReportContent: !!container,
            wallFacesList: !!wallFacesListContainer,
            wallFacesListSpatial: !!wallFacesListSpatialContainer
        });

        // Check if we have ANY data from either system
        const hasSpatialWallFaces = Array.isArray(window.WallFaces) && window.WallFaces.length > 0;
        const hasUOWallFaces = window.__bcabd_debug && typeof window.__bcabd_debug.getWallFaces === 'function' && window.__bcabd_debug.getWallFaces().length > 0;

        console.log('🔍 [DEBUG] Data check:', {
            hasSpatialWallFaces,
            hasUOWallFaces,
            spatialCount: window.WallFaces?.length || 0,
            uoCount: window.__bcabd_debug?.getWallFaces?.()?.length || 0
        });

        if (!hasSpatialWallFaces && !hasUOWallFaces) {
            // No data from either system - show placeholders
            if (container) {
                container.innerHTML = '<p style="font-style:italic; color:#555;">No wall faces have been added yet.</p>';
            }
            if (wallFacesListContainer) {
                wallFacesListContainer.innerHTML = '<p class="placeholder">No wall faces yet. Add openings in Unprotected Openings tab OR enter data in Spatial Calculator.</p>';
            }
            if (wallFacesListSpatialContainer) {
                wallFacesListSpatialContainer.innerHTML = '<p class="placeholder">No wall faces calculated yet. Send wall face data from Unprotected Openings, then run Spatial calculations.</p>';
            }
        } else {
            // A. Uses global escapeHtml() from Part 2.2
            // B. Uses global hasData() from Part 2.2

            const projName = safeEl('projName')?.value || "—";
            const projLocation = safeEl('projLocation')?.value || "—";
            const projClient = safeEl('projClient')?.value || "—";
            const projUser = safeEl('projUser')?.value || "—";
            const projDate = safeEl('projDate')?.value || "—";
            const buildingClass = safeEl('tableSelect') ? (safeEl('tableSelect').options[safeEl('tableSelect').selectedIndex]?.text || "—") : "—";
            const fireResp = safeEl('fireRespHigh')?.checked ? "Greater Than 10 min" : "10 min or Less";
            const sprinkStr = safeEl('sprinkYes')?.checked ? "Sprinklered" : "Non-sprinklered";

            let html = '<h2 style="margin-bottom:6px;">Spatial Separation Calculation Results</h2>';
            html += '<div style="font-weight:bold; margin-bottom:15px;">Gerwulf Systems</div>';

            // B. Project Info Section
            html += '<div class="project-report-section" style="margin-bottom:20px;">';
            html += '<div class="section-heading">PROJECT INFORMATION</div>';
            html += '<div class="info-row"><div class="label">Project Name</div><div class="value">' + escapeHtml(projName) + '</div></div>';
            html += '<div class="info-row"><div class="label">Project Location / Address</div><div class="value">' + escapeHtml(projLocation) + '</div></div>';
            html += '<div class="info-row"><div class="label">Client Name</div><div class="value">' + escapeHtml(projClient) + '</div></div>';
            html += '<div class="info-row"><div class="label">Designer / User Name</div><div class="value">' + escapeHtml(projUser) + '</div></div>';
            html += '<div class="info-row"><div class="label">Date</div><div class="value">' + escapeHtml(projDate) + '</div></div>';
            html += '</div>';

            // C. Classification Section
            html += '<div class="project-report-section section-divider" style="margin-bottom:20px;">';
            html += '<div class="section-heading">BUILDING CLASSIFICATION</div>';
            html += '<div class="info-row"><div class="label">Building Classification</div><div class="value">' + escapeHtml(buildingClass) + '</div></div>';
            html += '<div class="info-row"><div class="label">Fire Response Time</div><div class="value">' + escapeHtml(fireResp) + '</div></div>';
            html += '<div class="info-row"><div class="label">Sprinkler System</div><div class="value">' + escapeHtml(sprinkStr) + '</div></div>';
            if (safeEl('sprinkYes')?.checked) {
                const standard = safeEl('sprinkStandard')?.textContent || "—";
                html += '<div class="info-row"><div class="label">Sprinkler System Design Standard</div><div class="value">' + escapeHtml(standard) + '</div></div>';
            }
            html += '</div>';

            // D. WALL FACE LOOP
            window.WallFaces.forEach((wf, index) => {
                const name = wf.Name || ('Wall Face ' + (index + 1));
                const pfColor = String(wf.PassFail).toUpperCase().includes("PASS") ? "green" : "red";

                // --- 2. MODIFICATION: Get ratio from the object (previously captured) ---
                const ratioDisplay = wf.RatioDisplay || "—";
                const hasDimensions = parseFloat(wf.BuildingWidth_m) > 0 && parseFloat(wf.BuildingHeight_m) > 0;

                html += '<div class="project-report-section wall-face-block" style="position:relative; border-top: 2px solid #eee; margin-top:20px; padding-top:10px; padding-bottom:15px;">';
                html += '<div class="section-heading">WALL FACE ' + (index + 1) + ': ' + escapeHtml(name) + '</div>';

                html += '<div style="position:absolute; top:10px; right:10px; height: 40px; width: 60px; display:flex; flex-direction:column; gap:8px; align-items:flex-end;">';
                html += '<button type="button" class="calc-button wall-action-btn" onclick="editWallFace(' + index + ')">Edit</button>';
                html += '<button type="button" class="calc-button new-project-btn wall-action-btn" onclick="removeWallFace(' + index + ')">Delete</button>';
                html += '</div>';

                html += '<div class="info-row"><div class="label">Wall Area</div><div class="value">' + escapeHtml(wf.Area_m2) + ' m² / ' + escapeHtml(wf.Area_ft2) + ' ft²</div></div>';
                html += '<div class="info-row"><div class="label">Limiting Distance</div><div class="value">' + escapeHtml(wf.LimitDist_m) + ' m / ' + escapeHtml(wf.LimitDist_ft) + '</div></div>';
                html += '<div class="info-row"><div class="label">Maximum Area of Unprotected Openings Permitted</div><div class="value">' + escapeHtml(wf.MaxOpen_m2) + ' m² / ' + escapeHtml(wf.MaxOpen_ft2) + ' ft²</div></div>';
                html += '<div class="info-row"><div class="label">Actual Area of Unprotected Openings</div><div class="value">' + escapeHtml(wf.Openings_m2) + ' m² / ' + escapeHtml(wf.Openings_ft2) + ' ft²</div></div>';
                html += '<div class="info-row"><div class="label">Maximum Percentage of Openings Allowed</div><div class="value">' + escapeHtml(wf.MaxPctAllowed) + '</div></div>';
                html += '<div class="info-row"><div class="label">Actual Percentage of Openings</div><div class="value">' + escapeHtml(wf.ActualPct) + '</div></div>';

                // --- 3. WIDTH TO HEIGHT ---
                if (hasDimensions && ratioDisplay !== "—") {
                    html += '<div class="info-row">';
                    html += '<div class="label">Width to Height Ratio</div>';
                    html += '<div class="value">' + ratioDisplay + ' (' + wf.BuildingWidth_m + 'm / ' + wf.BuildingHeight_m + 'm)</div>';
                    html += '</div>';
                }

                // E. CONDITIONAL ROWS
                if (hasData(wf.Frr)) {
                    html += '<div class="info-row"><div class="label">Min. Fire-Resistance Rating</div><div class="value">' + escapeHtml(wf.Frr) + '</div></div>';
                }
                if (hasData(wf.Conreq)) {
                    html += '<div class="info-row"><div class="label">Construction Required</div><div class="value">' + escapeHtml(wf.Conreq) + '</div></div>';
                }
                if (hasData(wf.Clad)) {
                    html += '<div class="info-row"><div class="label">Cladding Required</div><div class="value">' + escapeHtml(wf.Clad) + '</div></div>';
                }

                html += '<div class="info-row"><div class="label">Result</div><div class="value" style="font-weight:bold; color:' + pfColor + ';">' + escapeHtml(wf.PassFail) + '</div></div>';
                if (hasData(wf.Comments)) {
                    html += '<div class="info-row" style="margin-top:5px; border-top:1px dashed #ccc; padding-top:5px;">';
                    html += '<div class="label">Comments</div><div class="value" style="font-style:italic; white-space: pre-wrap;">' + escapeHtml(wf.Comments) + '</div></div>';
                }

                html += '</div>';
            });

            // Update old layout container
            if (container) {
                container.innerHTML = html;
            }

            // Update combined layout container with simplified wall face list
            // Build HTML that shows BOTH UO and Spatial wall faces together
            let simpleHtml = '';

            // SECTION 1: UNPROTECTED OPENINGS WALL FACES (if any)
            if (hasUOWallFaces) {
                const uoWallFaces = window.__bcabd_debug.getWallFaces();
                simpleHtml += '<div style="margin-bottom:20px;"><h4 style="color:#1c49c4; margin-bottom:10px; font-size:14px;">UNPROTECTED OPENINGS</h4>';

                uoWallFaces.forEach((wf, index) => {
                    const name = wf.name || ('UO Wall Face ' + (index + 1));

                    simpleHtml += '<div style="padding:12px; margin:8px 0; border:2px solid #1c49c4; border-radius:6px; background-color:#f8f9ff;">';
                    simpleHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
                    simpleHtml += '<strong style="font-size:16px; color:#1c49c4;">' + escapeHtml(name) + '</strong>';
                    simpleHtml += '<button class="btn-send-spatial" onclick="window.sendWallFaceToSpatial(' + index + ')" style="font-size:11px; padding:4px 8px;">📐 Send to Spatial</button>';
                    simpleHtml += '</div>';

                    simpleHtml += '<div style="font-size:13px; color:#666;">';
                    simpleHtml += '<div><strong>Openings:</strong> ' + wf.openings.length + ' opening(s)</div>';
                    simpleHtml += '<div><strong>Total Area:</strong> ' + (wf.totalAreaFace_m2 || 0).toFixed(2) + ' m² / ' + (wf.totalAreaFace_ft2 || 0).toFixed(2) + ' ft²</div>';

                    // Show opening details
                    if (wf.openings && wf.openings.length > 0) {
                        simpleHtml += '<div style="margin-top:8px; padding-left:10px; border-left:2px solid #1c49c4;">';
                        wf.openings.forEach((op, i) => {
                            const typeLabel = op.typeLabel || 'Opening';
                            const dims = (op.width_m && op.height_m) ? 
                                `${op.width_m.toFixed(2)} m × ${op.height_m.toFixed(2)} m` : 
                                'N/A';
                            const area = (op.area_m2_display || 0).toFixed(2) + ' m²';
                            simpleHtml += '<div style="font-size:12px; color:#888; margin-top:4px;">• ' + typeLabel + ': ' + dims + ' (' + area + ')</div>';
                        });
                        simpleHtml += '</div>';
                    }

                    simpleHtml += '</div>';
                    simpleHtml += '<div style="margin-top:8px; display:flex; gap:8px;">';
                    simpleHtml += '<button class="btn btn-red" onclick="window.deleteWallFace(' + index + ')" style="flex:1; font-size:12px; padding:5px 10px;">🗑️ Delete</button>';
                    simpleHtml += '</div>';
                    simpleHtml += '</div>';
                });

                simpleHtml += '</div>';
            }

            // SECTION 2: SPATIAL WALL FACES (if any)
            if (hasSpatialWallFaces) {
                simpleHtml += '<div style="margin-bottom:20px;"><h4 style="color:#3498db; margin-bottom:10px; font-size:14px;">SPATIAL SEPARATION ANALYSIS</h4>';

                window.WallFaces.forEach((wf, index) => {
                    const name = wf.Name || ('Wall Face ' + (index + 1));
                    const pfColor = String(wf.PassFail).toUpperCase().includes("PASS") ? "#27ae60" : "#e74c3c";
                    const passFailText = String(wf.PassFail).toUpperCase().includes("PASS") ? "✓ PASS" : "✗ FAIL";

                    simpleHtml += '<div style="padding:12px; margin:8px 0; border:2px solid ' + pfColor + '; border-radius:6px; background-color:#fff;">';
                    simpleHtml += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
                    simpleHtml += '<strong style="font-size:16px; color:' + pfColor + ';">' + escapeHtml(name) + '</strong>';
                    simpleHtml += '<span style="font-weight:bold; color:' + pfColor + ';">' + passFailText + '</span>';
                    simpleHtml += '</div>';
                    simpleHtml += '<div style="font-size:13px; color:#666;">';
                    simpleHtml += '<div>Wall Area: ' + escapeHtml(wf.Area_m2) + ' m² / ' + escapeHtml(wf.Area_ft2) + ' ft²</div>';
                    simpleHtml += '<div>Openings: ' + escapeHtml(wf.Openings_m2) + ' m² / ' + escapeHtml(wf.Openings_ft2) + ' ft² (' + escapeHtml(wf.ActualPct) + ')</div>';
                    simpleHtml += '<div>Limiting Distance: ' + escapeHtml(wf.LimitDist_m) + ' m / ' + escapeHtml(wf.LimitDist_ft) + '</div>';
                    simpleHtml += '</div>';
                    simpleHtml += '<div style="margin-top:8px; display:flex; gap:8px;">';
                    simpleHtml += '<button class="btn btn-send-spatial" onclick="editWallFace(' + index + ')" style="flex:1; font-size:12px;">Edit</button>';
                    simpleHtml += '<button class="btn btn-red" onclick="removeWallFace(' + index + ')" style="flex:1; font-size:12px; padding:5px 10px;">Delete</button>';
                    simpleHtml += '</div>';
                    simpleHtml += '</div>';
                });

                simpleHtml += '</div>';
            }

            // Populate Aggregate Openings tab
            if (wallFacesListContainer) {
                wallFacesListContainer.innerHTML = simpleHtml;
            }

            // Populate Spatial Results tab with identical content
            if (wallFacesListSpatialContainer) {
                wallFacesListSpatialContainer.innerHTML = simpleHtml;
            }
        }

        // 10.6.5 --- DELETED MANAGER LOGIC ---
        const delListDiv = document.getElementById('deletedWallFaceList');
        if (delListDiv) {
            let delHtml = "";
            if (window.DeletedWallFaces && window.DeletedWallFaces.length > 0) {
                window.DeletedWallFaces.forEach((entry, i) => {
                    const name = entry.Face.Name || ('Wall Face ' + (entry.Index + 1));
                    delHtml += '<div class="section-heading" style="color:#d9534f; margin-bottom:10px;">DELETED WALL FACE ' + (i + 1) + ': ' + name + '</div>';
                });
            } else {
                delHtml = '<p style="font-style:italic; color:#555;">No deleted wall faces.</p>';
            }
            delListDiv.innerHTML = delHtml;
        }

        if (safeEl('DeletedWallFaceTable')) {
            const hasDeleted = (window.DeletedWallFaces && window.DeletedWallFaces.length > 0);
            safeEl('DeletedWallFaceTable').style.display = hasDeleted ? "block" : "none";
        }

        if (window.WallFaces && window.WallFaces.length > 0) {
            if (typeof LockProjectControls === 'function') LockProjectControls();
        } else {
            if (typeof UnlockProjectControls === 'function') UnlockProjectControls();
        }
    }

        // ============================
        // 10.7 ADD WALL FACE BUTTON HANDLER - EVENT DELEGATION FIX
        // ============================
        // CRITICAL FIX: Use event delegation to handle dynamic button replacement
        // Attach listener to document body - won't be affected by button replacement
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🔍 [DEBUG] DOMContentLoaded fired - setting up event delegation for addWallFaceBtn...');

            // Use event delegation - attach to body, filter for our button
            document.body.addEventListener('click', function(e) {
                // Check if the clicked element is our button (or contains it)
                const target = e.target.closest('#addWallFaceBtn');
                if (!target) return; // Not our button, ignore

                console.log('🎯 [DEBUG] Add Wall Face button clicked via event delegation!');

                console.log('🔍 [DEBUG] Checking for captureCurrentWallFace function...');
                console.log('🔍 [DEBUG] captureCurrentWallFace exists:', typeof captureCurrentWallFace === 'function' ? 'YES' : 'NO');

                const wf = typeof captureCurrentWallFace === 'function' ? captureCurrentWallFace() : null;
                console.log('🔍 [DEBUG] Captured wall face data:', wf);

                if (!wf) {
                    console.error('❌ [DEBUG] No wall face data captured - aborting');
                    return;
                }

                window.WallFaces = window.WallFaces || [];
                console.log('🔍 [DEBUG] Current WallFaces array:', window.WallFaces);

                const isDup = window.WallFaces.some(existing => _wallFaceEquals(existing, wf));
                console.log('🔍 [DEBUG] Is duplicate?', isDup);

                if (!isDup) {
                    console.log('✅ [DEBUG] Adding wall face to array:', wf.Name);
                    window.WallFaces.push(wf);
                    console.log('✅ [DEBUG] Wall face added. New array length:', window.WallFaces.length);

                    // --- STEP 0: SET FLAG BEFORE CLEARING ---
                    window.isResettingUI = true;

                    // --- STEP 1: CLEAR PRECISION DATA FIRST ---
                    const fields = [
                        'wallFaceName', 'spatialWallFaceName', 'areaFace_m2', 'areaFace_ft2', 'limitDist_m', 'limitDist_ft',
                        'openings_m2', 'openings_ft2', 'buildingWidth_m', 'buildingWidth_ft',
                        'buildingHeight_m', 'buildingHeight_ft', 'wallFaceComments'
                    ];

                    fields.forEach(id => {
                        const el = safeEl(id);
                        if (el) {
                            delete el.dataset.raw;
                        }
                    });

                    // --- STEP 2: CLEAR VALUES ---
                    fields.forEach(id => {
                        const el = safeEl(id);
                        if (el) {
                            el.value = "";
                            if (id === 'wallFaceComments') el.style.height = '40px';
                        }
                    });

                    // --- STEP 3: CLEAR IMPERIAL SPANS ---
                    ['limitDist_ftIn', 'buildingWidth_ftIn', 'buildingHeight_ftIn'].forEach(id => {
                        if (safeEl(id)) safeEl(id).textContent = "";
                    });

                    // --- STEP 4: CLEAR OUTPUT FIELDS ---
                    const outputs = [
                        'maxOpen_m2', 'maxOpen_ft2', 'maxPctAllowed', 'nsCalcMaxOpen_m2', 'nsCalcMaxOpen_ft2',
                        'actualPct_m2', 'actualPct_ft2', 'passFail', 'frr', 'conreq', 'clad',
                        'maxOpenSpr_m2', 'maxOpenSpr_ft2', 'actualPctSpr_m2', 'actualPctSpr_ft2',
                        'maxPctAllowedSpr', 'passFailSpr', 'sprinkStandard', 'maxFaceAreaCombustible'
                    ];
                    outputs.forEach(id => { if (safeEl(id)) safeEl(id).textContent = "—"; });

                    if (safeEl('passFail')) safeEl('passFail').style.color = "";
                    if (safeEl('passFailSpr')) safeEl('passFailSpr').style.color = "";

                    // --- STEP 5: HIDE TABLES ---
                    if (safeEl('sprinkResultsTable')) safeEl('sprinkResultsTable').style.display = 'none';
                    if (safeEl('sprinkResultsTable2')) safeEl('sprinkResultsTable2').style.display = 'none';
                    if (safeEl('constructionReqTable')) safeEl('constructionReqTable').style.display = 'none';

                    console.log('🔍 [DEBUG] Calling RenderWallFacesListForReport...');
                    RenderWallFacesListForReport();

                    // Regenerate all reports to include the new wall face
                    if (typeof window.generateAllReports === 'function') {
                        console.log('🔍 [DEBUG] Regenerating reports with new wall face...');
                        window.generateAllReports();
                    }

                    if (window.currentActiveProjectName && typeof window.SaveProject === "function") {
                        console.log('🔍 [DEBUG] Saving project...');
                        window.SaveProject();
                    }

                    // --- STEP 6: RECALCULATE & RELEASE FLAG ---
                    console.log('🔍 [DEBUG] Recalculating and releasing UI flag...');
                    requestAnimationFrame(() => {
                        if (typeof UpdateSprinklerResults === 'function') UpdateSprinklerResults(true);
                        if (typeof UpdateConstructionTableDisabledState === 'function') {
                            UpdateConstructionTableDisabledState();
                        }

                        // Release flag after everything settles
                        setTimeout(() => {
                            window.isResettingUI = false;
                            console.log('✅ [DEBUG] Add Wall Face complete!');
                        }, 100);
                    });
                } else {
                    console.warn('⚠️ [DEBUG] Wall face is duplicate - not adding');
                }
            });

            console.log('✅ [DEBUG] Event delegation listener attached to document.body for addWallFaceBtn');
        }); // End DOMContentLoaded

    // ==========================================================
    // 11.0 PROJECT MANAGER LOGIC (SYNCED WITH PART 10)
    // ==========================================================

    window.SaveProject = function () {
        console.log("💾 ========== SAVE PROJECT CALLED ==========");

        const name = document.getElementById('projName')?.value.trim();
        if (!name) {
            alert("Please enter a Project Name to save.");
            return;
        }

        console.log("  📝 Project Name:", name);

        // Collect UO wall faces from UnprotectedOpeningsCalculator.js
        let uoWallFaces = [];
        if (window.__bcabd_debug && typeof window.__bcabd_debug.getWallFaces === 'function') {
            uoWallFaces = window.__bcabd_debug.getWallFaces() || [];
            console.log("  📊 UO Debug API exists: YES");
            console.log("  📊 UO wall faces raw:", uoWallFaces);
        } else {
            console.warn("  ⚠️ UO Debug API NOT AVAILABLE");
        }

        console.log("  📊 Spatial WallFaces raw:", window.WallFaces);

        const projectData = {
            command: "SAVE_PROJECT",
            payload: {
                info: {
                    name: name,
                    location: document.getElementById('projLocation')?.value || "",
                    client: document.getElementById('projClient')?.value || "",
                    user: document.getElementById('projUser')?.value || "",
                    date: document.getElementById('projDate')?.value || new Date().toISOString().split('T')[0]
                },
                settings: {
                    table: document.getElementById('tableSelect')?.value || "Opt1",
                    sprinklered: document.getElementById('sprinkYes')?.checked || false
                },
                // Save BOTH Spatial wall faces AND UO wall faces
                walls: window.WallFaces || [],
                uoWallFaces: uoWallFaces
            }
        };

        console.log("  📦 Complete Project Data:", JSON.stringify(projectData, null, 2));

        if (window.sendToCSharp) {
            console.log("  🚀 Sending to C#...");
            console.log("    - Spatial wall faces count:", projectData.payload.walls.length);
            console.log("    - UO wall faces count:", projectData.payload.uoWallFaces.length);

            if (projectData.payload.walls.length > 0) {
                console.log("    - Spatial wall faces:", projectData.payload.walls);
            } else {
                console.warn("    ⚠️ NO SPATIAL WALL FACES TO SAVE!");
            }

            if (projectData.payload.uoWallFaces.length > 0) {
                console.log("    - UO wall faces:", projectData.payload.uoWallFaces);
            } else {
                console.warn("    ⚠️ NO UO WALL FACES TO SAVE!");
            }

            window.sendToCSharp(projectData);
            window.currentActiveProjectName = name;

            // Update local memory so it appears in the list immediately
            window.savedProjects[name] = projectData.payload;
            window.RenderProjectList();

            console.log("  ✅ Project saved to local memory");
        } else {
            console.error("  ❌ window.sendToCSharp NOT AVAILABLE!");
        }

        console.log("💾 ========== SAVE PROJECT COMPLETE ==========");
    };

    window.RenderProjectList = function () {
        const container = document.getElementById('savedProjectList');
        if (!container) return;

        const projects = window.savedProjects || {};
        const keys = Object.keys(projects);

        if (keys.length === 0) {
            container.innerHTML = `<p style="font-style:italic; color:#555; padding:15px;">No projects found on disk.</p>`;
            return;
        }

        let html = "";
        keys.forEach(name => {
            // We use the CSS classes defined in your stylesheet (project-row, project-info-name, etc.)
            html += `
        <div class="project-row">
            <span class="project-info-name">${name}</span>
            <div class="project-actions">
                <button class="project-action-btn btn-load" onclick="window.LoadProject('${name}')">Load</button>
                <button class="project-action-btn btn-export" onclick="window.ExportProject('${name}')">Export</button>
                <button class="project-action-btn btn-delete" onclick="window.DeleteProject('${name}')">Delete</button>
            </div>
        </div>`;
        });

        container.innerHTML = html;
    };

    window.LoadProject = function (name) {
        const data = window.savedProjects[name];
        if (!data) return;

        console.log("📂 Loading Project:", name);

        // CRITICAL FIX: Clear ALL old project data BEFORE loading new project
        // This prevents data from mixing between projects

        // Step 1: Clear Spatial wall faces
        window.WallFaces = [];

        // Step 2: Clear UO wall faces from UnprotectedOpeningsCalculator.js
        if (window.__bcabd_debug && typeof window.__bcabd_debug.setWallFaces === 'function') {
            window.__bcabd_debug.setWallFaces([]);
            console.log("  🧹 Cleared old UO wall faces");
        }

        // Step 3: Clear cached reports
        if (window.cachedReports) {
            window.cachedReports = {
                combined: { html: '', text: '' },
                unprotected: { html: '', text: '' },
                spatial: { html: '', text: '' }
            };
        }

        // Step 4: Clear wall face links
        if (window.spatialWallFaceLinks) {
            window.spatialWallFaceLinks = {};
        }

        // Step 5: Clear deleted wall faces
        window.DeletedWallFaces = [];
        window.deletedWallFaces = [];

        // NOW load the new project data
        window.currentActiveProjectName = name;

        // Repopulate Project Info fields
        if (document.getElementById('projName')) document.getElementById('projName').value = data.info.name || "";
        if (document.getElementById('projLocation')) document.getElementById('projLocation').value = data.info.location || "";
        if (document.getElementById('projClient')) document.getElementById('projClient').value = data.info.client || "";
        if (document.getElementById('projUser')) document.getElementById('projUser').value = data.info.user || "";
        if (document.getElementById('projDate')) document.getElementById('projDate').value = data.info.date || "";

        // Repopulate Settings
        if (document.getElementById('tableSelect')) document.getElementById('tableSelect').value = data.settings.table || "Opt1";
        const isSprink = data.settings.sprinklered;
        if (document.getElementById('sprinkYes')) document.getElementById('sprinkYes').checked = isSprink;
        if (document.getElementById('sprinkNo')) document.getElementById('sprinkNo').checked = !isSprink;

        // Restore Spatial wall faces
        window.WallFaces = JSON.parse(JSON.stringify(data.walls || []));
        console.log("  ✅ Loaded Spatial wall faces:", window.WallFaces.length);

        // Restore UO wall faces
        if (data.uoWallFaces && window.__bcabd_debug && typeof window.__bcabd_debug.setWallFaces === 'function') {
            window.__bcabd_debug.setWallFaces(data.uoWallFaces);
            console.log("  ✅ Loaded UO wall faces:", data.uoWallFaces.length);
        }

        // Refresh the wall faces list display
        if (typeof RenderWallFacesListForReport === 'function') {
            RenderWallFacesListForReport();
        }

        // Lock controls if there are walls (as per your Part 10 logic)
        if (window.WallFaces.length > 0 && typeof LockProjectControls === 'function') {
            LockProjectControls();
        }

        console.log("📂 ✅ Project Loaded Successfully:", name);
    };

    window.DeleteProject = function (name) {
        if (confirm(`Are you sure you want to permanently delete "${name}"?`)) {
            if (window.sendToCSharp) {
                window.sendToCSharp({
                    command: "DELETE_PROJECT",
                    payload: { name: name }
                });
                // Update local UI immediately
                delete window.savedProjects[name];
                window.RenderProjectList();
            }
        }
    };

    window.ClearProjects = function () {
        if (confirm("Are you sure you want to delete ALL saved projects? This cannot be undone.")) {
            // 1. Tell C# to wipe the disk
            window.sendToCSharp({
                command: "DELETE_ALL_PROJECTS",
                payload: {}
            });

            // 2. Wipe local memory immediately
            window.savedProjects = {};
            window.currentActiveProjectName = "";

            // 3. Refresh the UI table
            window.RenderProjectList();

            console.log("🧹 Local project list cleared.");
        }
    };

    // ==========================================================
    // 11.1 DATA TRANSFER (SYNCED)
    // ==========================================================

    window.ExportProject = function (name) {
        const data = window.savedProjects[name];
        if (!data) return;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_')}_Project.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.ImportProject = function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const imported = JSON.parse(event.target.result);
                    const name = imported.info.name || "Imported Project";

                    if (window.sendToCSharp) {
                        // Save to disk via C#
                        window.sendToCSharp({ command: "SAVE_PROJECT", payload: imported });

                        // Update local list
                        window.savedProjects[name] = imported;
                        window.RenderProjectList();
                    }
                } catch (err) {
                    alert("Error: Invalid project file.");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // ============================
    // 11.2 REPORT BINDINGS
    // ============================
    function EnsureReportBindings() {
        function SafeRender() {
            try {
                if (typeof RenderWallFacesListForReport === 'function') RenderWallFacesListForReport();
            } catch (err) { }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', SafeRender);
        } else {
            SafeRender();
        }
        const addBtnIds = ['addWallFaceBtn', 'addFaceBtn', 'addWallBtn'];
        addBtnIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.removeEventListener('click', SafeRender);
                el.addEventListener('click', function () { setTimeout(SafeRender, 50); });
            }
        });
        if (typeof window.AddWallFace === 'function') {
            const origAdd = window.AddWallFace;
            window.AddWallFace = function () {
                const res = origAdd.apply(this, arguments);
                setTimeout(SafeRender, 50);
                return res;
            };
        }
        window.RebuildProjectReport = SafeRender;
    }
    EnsureReportBindings();

    // ============================
    // 11.3 FINAL RUNTIME WRAPPERS
    // ============================
    if (!Array.isArray(window.WallFaces)) window.WallFaces = [];

    if (typeof window.AddWallFace === 'function') {
        const _origAddWallFace = window.AddWallFace;
        window.AddWallFace = function () {
            const res = _origAddWallFace.apply(this, arguments);
            setTimeout(function () {
                if (typeof RenderWallFacesListForReport === 'function') {
                    try { RenderWallFacesListForReport(); } catch (e) { }
                }
            }, 50);
            return res;
        };
    }

    if (typeof window.RebuildProjectReport !== 'function') {
        window.RebuildProjectReport = function () {
            if (typeof RenderWallFacesListForReport === 'function') {
                try { RenderWallFacesListForReport(); } catch (e) { }
            }
        };
    }

    try {
        if (typeof RenderWallFacesListForReport === 'function') RenderWallFacesListForReport();
    } catch (e) { }

        // ==========================================================
        // 11.4 APP INITIALIZATION
        // ==========================================================

    let isAppInitialized = false;

    function InitApp() {
        // 1. Prevents the infinite loop spam
        if (isAppInitialized) return;
        isAppInitialized = true;

        console.log("🚀 Starting App Initialization...");

        try {
            // A. Attach Global Listeners (UI Buttons, etc.)
            if (typeof AttachListeners === 'function') {
                AttachListeners();
            }

            // B. Render the Project Manager List (Visual empty state)
            if (typeof RenderProjectList === 'function') {
                RenderProjectList();
            }

            // C. Setup Radio Button Listeners for Sprinklers
            const sprNo = document.getElementById('sprinkNo');
            const sprYes = document.getElementById('sprinkYes');
            if (sprNo) sprNo.addEventListener('change', () => {
                UpdateSprinklerMode();
                if (window.currentActiveProjectName) SaveProject();
            });
            if (sprYes) sprYes.addEventListener('change', () => {
                UpdateSprinklerMode();
                if (window.currentActiveProjectName) SaveProject();
            });

            // D. Set Default Date
            const dateInput = document.getElementById('projDate');
            if (dateInput && !dateInput.value) {
                dateInput.value = new Date().toISOString().slice(0, 10);
            }

            // E. Ask C# to send us saved projects
            if (typeof window.sendToCSharp === 'function') {
                console.log("📡 Requesting Project List from C#...");
                window.sendToCSharp({
                    command: "GET_PROJECT_LIST",
                    payload: {}
                });
            }

            // E.1 Setup Project Name Auto-Save (Creates new project when name is entered)
            const projNameInput = document.getElementById('projName');
            if (projNameInput) {
                projNameInput.addEventListener('blur', () => {
                    const name = projNameInput.value.trim();
                    if (name && name !== window.currentActiveProjectName) {
                        // New project name entered - save it
                        console.log("📝 New project name detected, auto-saving:", name);
                        SaveProject();
                    }
                });
            }

            // F. Setup Auto-Save for Fields
            ['projName', 'projLocation', 'projClient', 'projUser', 'projDate', 'tableSelect'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('change', () => {
                        if (window.currentActiveProjectName) SaveProject();
                    });
                }
            });

            // G. Physics/Distance Logic
            setupLimitingDistanceLogic();

            // H. Initial UI Refresh
            updateOpenAirStoreysVisibility();
            updateOpeningsLabels(safeEl('tableSelect')?.value || 'Opt1');
            if (typeof UpdateSprinklerMode === 'function') UpdateSprinklerMode();
            if (typeof UpdateSprinklerResults === 'function') UpdateSprinklerResults();
            if (typeof SetupPDFButton === 'function') SetupPDFButton();

            console.log("✅ System Kickstart Complete.");

        } catch (err) {
            console.error("Initialization Error:", err);
        }
    }

    // Helper to keep InitApp clean - FIXED CASE SENSITIVITY
    function setupLimitingDistanceLogic() {
        const ldFtInput = document.getElementById("limitDist_ft");
        const ldMInput = document.getElementById("limitDist_m");
        const ldFtInSpan = document.getElementById("limitDist_ftIn");

        if (!ldFtInput) return;

        ldFtInput.addEventListener("input", function () {
            if (typeof parseFeetInput !== 'function' || typeof FT_PER_M === 'undefined') return;  // ← Fixed: lowercase 'p'
            const feet = parseFeetInput(this.value);  // ← Fixed: lowercase 'p'
            if (!isNaN(feet)) {
                if (ldMInput) ldMInput.value = (feet / FT_PER_M).toFixed(2);
            }
        });

        ldFtInput.addEventListener("blur", function () {
            if (typeof parseFeetInput !== 'function') return;  // ← Fixed: lowercase 'p'
            const feet = parseFeetInput(this.value);  // ← Fixed: lowercase 'p'
            if (!isNaN(feet)) {
                if (typeof feetToFeetInches === 'function') {  // ← Fixed: lowercase 'f'
                    const formatted = feetToFeetInches(feet);  // ← Fixed: lowercase 'f'
                    this.value = formatted;
                    if (ldFtInSpan) ldFtInSpan.textContent = formatted;
                }
                if (typeof UpdateSprinklerResults === 'function') UpdateSprinklerResults();
            }
        });
    }

    // ==========================================================
    // 11.5 EXPOSE TO GLOBAL SCOPE
    // ==========================================================
    // This allows C# to call InitApp() directly
    window.InitApp = InitApp;
    window.onCalculationResultReceived = onCalculationResultReceived;
    window.ApplyApiResultToDom = onCalculationResultReceived;
    window.RenderWallFacesListForReport = RenderWallFacesListForReport; // Expose for combined-app.js

    // Note: We REMOVED the automatic triggers at the bottom.
    // C# will now call InitApp() when the WebView navigation is finished.

// ==========================================================
// 11.6 SYSTEM KICKSTART
// ==========================================================
    if (typeof AttachListeners === 'function') {
        AttachListeners();
    }

    if (typeof SendToCSharp === 'function') {
        SendToCSharp();
    }

    console.log("✅ System Kickstart Complete. UI Wired to C#.");

})(); 