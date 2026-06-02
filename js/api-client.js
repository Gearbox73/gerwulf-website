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
        BuildingHeight_m: getNum('buildingHeight_m')
    };

    if (req.FaceArea_m2 === null || req.LimitDistance_m === null) {
        return;
    }

    // This matches the interception logic we built in MainPage.xaml.cs
    if (typeof window.sendToCSharp === 'function') {
        window.sendToCSharp(req);
    } else {
        // Fallback for debugging if the bridge isn't injected yet
        console.error("C# Bridge 'sendToCSharp' not found.");
    }