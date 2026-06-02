// API Client - Works for both MAUI (C# bridge) and Web (HTTP)
const API_BASE_URL = 'https://spatial-separation-calculator-hagnbnewfbdnh5bq.canadacentral-01.azurewebsites.net';

async function callSpatialApi() {
    console.log('🚀 [API-CLIENT] callSpatialApi() invoked');

    // Helper to handle empty inputs
    const getNum = (id) => {
        const val = parseFloat(document.getElementById(id)?.value);
        return isNaN(val) ? null : val;
    };

    // Helper to convert Table string to integer enum value
    const getTableValue = () => {
        const val = document.getElementById('tableSelect')?.value;
        // Convert "Opt1" -> 0, "Opt2" -> 1, "Opt3" -> 2
        if (val === "Opt1") return 0;
        if (val === "Opt2") return 1;
        if (val === "Opt3") return 2;
        return parseInt(val) || 0; // Fallback to parsing or default to 0
    };

    // Audit Fix: Property names now match C# SpatialRequest Record exactly
    const req = {
        Table: getTableValue(),
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

    console.log('📦 [API-CLIENT] Request payload:', JSON.stringify(req, null, 2));

    if (req.FaceArea_m2 === null || req.LimitDistance_m === null) {
        console.warn('⚠️ [API-CLIENT] Missing required fields - FaceArea or LimitDistance is null');
        return;
    }

    // Check if C# bridge is available (MAUI app)
    if (typeof window.sendToCSharp === 'function') {
        // MAUI: Use C# bridge
        console.log('📱 [API-CLIENT] Using MAUI C# bridge');
        window.sendToCSharp(req);
    } else {
        // WEB: Call API directly via HTTP
        console.log('🌐 [API-CLIENT] Using Web HTTP mode - calling Azure API');
        console.log('🔗 [API-CLIENT] API URL:', `${API_BASE_URL}/spatial/calculate`);
        try {
            const response = await fetch(`${API_BASE_URL}/spatial/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(req)
            });

            console.log('📡 [API-CLIENT] Response status:', response.status);

            if (!response.ok) {
                let errorText = '';
                try {
                    errorText = await response.text();
                } catch (e) {
                    errorText = 'Could not read error response';
                }
                console.error('❌ [API-CLIENT] API call failed:', response.status, errorText);
                console.error('❌ [API-CLIENT] Request that failed:', JSON.stringify(req, null, 2));
                return;
            }

            const result = await response.json();
            console.log('✅ [API-CLIENT] API result:', JSON.stringify(result, null, 2));

            // Call the existing result handler from app.js
            if (typeof window.receiveFromCSharp === 'function') {
                console.log('📥 [API-CLIENT] Passing result to receiveFromCSharp()');
                window.receiveFromCSharp(result);
            } else {
                console.error('❌ [API-CLIENT] receiveFromCSharp function not found!');
            }
        } catch (error) {
            console.error('💥 [API-CLIENT] API call error:', error);
        }
    }
}