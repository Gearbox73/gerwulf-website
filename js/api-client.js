// API Client - Works for both MAUI (C# bridge) and Web (HTTP)
const API_BASE_URL = 'https://spatial-separation-calculator-hagnbnewfbdnh5bq.canadacentral-01.azurewebsites.net';

async function callSpatialApi() {
    // Helper to handle empty inputs
    const getNum = (id) => {
        const val = parseFloat(document.getElementById(id)?.value);
        return isNaN(val) ? null : val;
    };

    // Audit Fix: Property names now match C# SpatialRequest Record exactly
    const req = {
        Table: document.getElementById('tableSelect').value,
        IsSprinklered: document.getElementById('sprinkYes').checked,
        IsHighResp: document.getElementById('fireRespHigh').checked, // Matches C# IsHighResp
        FaceArea_m2: getNum('areaFace_m2'),          // Matches C# FaceArea_m2
        Openings_m2: getNum('openings_m2'),          // Matches C# Openings_m2
        LimitDistance_m: getNum('limitDist_m'),      // Matches C# LimitDistance_m
        BuildingWidth_m: getNum('buildingWidth_m'),
        BuildingHeight_m: getNum('buildingHeight_m'),
        UseInterpolation: document.getElementById('calcInterpolation')?.checked ?? true,  // Defaults to true
        IsOpenAirStoreys: document.getElementById('openAirYes')?.checked ?? true         // Defaults to true
    };

    if (req.FaceArea_m2 === null || req.LimitDistance_m === null) {
        return;
    }

    // Check if C# bridge is available (MAUI app)
    if (typeof window.sendToCSharp === 'function') {
        // MAUI: Use C# bridge
        window.sendToCSharp(req);
    } else {
        // WEB: Call API directly via HTTP
        try {
            const response = await fetch(`${API_BASE_URL}/spatial/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req)
            });

            if (!response.ok) {
                console.error('API call failed:', response.status);
                return;
            }

            const result = await response.json();

            // Call the existing result handler from app.js
            if (typeof window.receiveFromCSharp === 'function') {
                window.receiveFromCSharp(result);
            }
        } catch (error) {
            console.error('API call error:', error);
        }
    }
}