// API Client - Works for both MAUI (C# bridge) and Web (HTTP)
const API_BASE_URL = 'https://spatial-separation-calculator-hagnbnewfbdnh5bq.canadacentral-01.azurewebsites.net';

async function callSpatialApi() {
    console.log('[API-CLIENT] callSpatialApi() invoked');

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
        BuildingHeight_m: getNum('buildingHeight_m')
    };

    console.log('[API-CLIENT] Request payload:', req);

    if (req.FaceArea_m2 === null || req.LimitDistance_m === null) {
        console.warn('[API-CLIENT] Missing required fields - FaceArea or LimitDistance is null');
        return;
    }

    // Check if C# bridge is available (MAUI app)
    if (typeof window.sendToCSharp === 'function') {
        // MAUI: Use C# bridge
        console.log('[API-CLIENT] Using MAUI C# bridge');
        window.sendToCSharp(req);
    } else {
        // WEB: Call API directly via HTTP
        console.log('[API-CLIENT] Using Web HTTP mode - calling Azure API');
        try {
            const response = await fetch(`${API_BASE_URL}/spatial/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req)
            });

            console.log('[API-CLIENT] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[API-CLIENT] API call failed:', response.status, errorText);
                return;
            }

            const result = await response.json();
            console.log('[API-CLIENT] API result:', result);

            // Call the existing result handler from app.js
            if (typeof window.receiveFromCSharp === 'function') {
                console.log('[API-CLIENT] Passing result to receiveFromCSharp');
                window.receiveFromCSharp(result);
            } else {
                console.error('[API-CLIENT] receiveFromCSharp function not found!');
            }
        } catch (error) {
            console.error('[API-CLIENT] API call error:', error);
        }
    }
}