// Web API Client for gerwulf.co Calculator
// This file handles API calls to your Azure backend

let API_BASE_URL = 'https://spatial-separation-calculator-hagnbnewfbdnh5bq.canadacentral-01.azurewebsites.net'; // Will be set by parent window
let SESSION_ID = null;

// Listen for session info from parent window
window.addEventListener('message', (event) => {
    if (event.data.type === 'session') {
        SESSION_ID = event.data.sessionId;
        API_BASE_URL = event.data.apiBaseUrl;
        console.log('✅ Session initialized:', SESSION_ID);
    }
});

async function callSpatialApi() {
    // Helper to handle empty inputs
    const getNum = (id) => {
        const val = parseFloat(document.getElementById(id)?.value);
        return isNaN(val) ? null : val;
    };

    // Matches C# SpatialRequest Record exactly
    const req = {
        Table: document.getElementById('tableSelect').value,
        IsSprinklered: document.getElementById('sprinkYes').checked,
        IsHighResp: document.getElementById('fireRespHigh').checked,
        FaceArea_m2: getNum('areaFace_m2'),
        Openings_m2: getNum('openings_m2'),
        LimitDistance_m: getNum('limitDist_m'),
        BuildingWidth_m: getNum('buildingWidth_m'),
        BuildingHeight_m: getNum('buildingHeight_m')
    };

    if (req.FaceArea_m2 === null || req.LimitDistance_m === null) {
        console.warn("Missing required fields");
        return;
    }

    try {
        // Show loading indicator
        showLoadingIndicator(true);

        // Call the backend API directly
        const response = await fetch(`${API_BASE_URL}/spatial/calculate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': SESSION_ID || '' // Optional: track which session made the request
            },
            body: JSON.stringify(req)
        });

        if (!response.ok) {
            console.error('API call failed:', response.status);
            showError('Calculation failed. Please try again.');
            return;
        }

        const result = await response.json();

        // Update UI with results (uses existing displayResults function)
        displayResults(result);

    } catch (error) {
        console.error('Error calling API:', error);
        showError('Unable to connect to calculation server. Please check your internet connection.');
    } finally {
        showLoadingIndicator(false);
    }
}

function displayResults(result) {
    // Update non-sprinklered results
    if (result.maxAreaOfOpenings_m2 !== null && result.maxAreaOfOpenings_m2 !== undefined) {
        document.getElementById('maxOpen_m2').textContent = result.maxAreaOfOpenings_m2.toFixed(2) + ' m²';
        document.getElementById('maxOpen_ft2').textContent = result.maxAreaOfOpenings_ft2.toFixed(2) + ' ft²';
    }

    if (result.maxPercOfOpeningsAllowed !== null && result.maxPercOfOpeningsAllowed !== undefined) {
        document.getElementById('maxPercAllowed').textContent = result.maxPercOfOpeningsAllowed.toFixed(2) + '%';
    }

    if (result.percOfOpeningsProvided !== null && result.percOfOpeningsProvided !== undefined) {
        document.getElementById('percProvided').textContent = result.percOfOpeningsProvided.toFixed(2) + '%';
    }

    // Compliance status
    if (result.compliance !== null && result.compliance !== undefined) {
        const complianceEl = document.getElementById('complianceStatus');
        if (complianceEl) {
            complianceEl.textContent = result.compliance;
            complianceEl.className = result.compliance === 'Compliant' ? 'status-pass' : 'status-fail';
        }
    }

    // Update sprinklered results if available
    if (result.maxAreaOfOpeningsSprink_m2 !== null && result.maxAreaOfOpeningsSprink_m2 !== undefined) {
        document.getElementById('maxOpenSprink_m2').textContent = result.maxAreaOfOpeningsSprink_m2.toFixed(2) + ' m²';
        document.getElementById('maxOpenSprink_ft2').textContent = result.maxAreaOfOpeningsSprink_ft2.toFixed(2) + ' ft²';
    }

    if (result.maxPercOfOpeningsAllowedSprink !== null && result.maxPercOfOpeningsAllowedSprink !== undefined) {
        document.getElementById('maxPercAllowedSprink').textContent = result.maxPercOfOpeningsAllowedSprink.toFixed(2) + '%';
    }

    if (result.complianceSprink !== null && result.complianceSprink !== undefined) {
        const complianceSprinkEl = document.getElementById('complianceStatusSprink');
        if (complianceSprinkEl) {
            complianceSprinkEl.textContent = result.complianceSprink;
            complianceSprinkEl.className = result.complianceSprink === 'Compliant' ? 'status-pass' : 'status-fail';
        }
    }

    console.log('✅ Results displayed successfully');

    // Show success message briefly
    showSuccess('Calculation complete!');
}

function showLoadingIndicator(show) {
    // You can implement a loading spinner here
    const calculateBtn = document.querySelector('button[onclick*="callSpatialApi"]');
    if (calculateBtn) {
        calculateBtn.disabled = show;
        calculateBtn.textContent = show ? 'Calculating...' : 'Calculate';
    }
}

function showError(message) {
    // Simple error display - you can make this more sophisticated
    alert(message);
}

function showSuccess(message) {
    // Simple success display
    console.log('✅', message);
}

// Make sure the function is globally accessible
window.callSpatialApi = callSpatialApi;

