/**
 * Combined Calculator - JavaScript UI Logic
 * Handles tab switching, project management, and UI coordination
 * 
 * NOTE: This file does NOT perform calculations or unit conversions.
 * All calculations are handled by:
 *   - app.js (Spatial Separation calculations)
 *   - UnprotectedOpeningsCalculator.js (Opening calculations)
 */

// ========================================
// Utility Functions
// ========================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';

    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12',
        info: '#3498db'
    };

    toast.style.cssText = `
        background-color: ${colors[type] || colors.info};
        color: white;
        padding: 16px 20px;
        margin-bottom: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        font-weight: bold;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;

    toast.textContent = message;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, 3000);
}

/**
 * Export current project to JSON file
 */
function exportProjectToJson() {
    if (!currentProject.info.name) {
        showToast('⚠️ Please enter a project name first', 'warning');
        return;
    }

    const json = JSON.stringify(currentProject, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.info.name.replace(/\s+/g, '_')}_project.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('📥 Project exported to JSON');
    showToast('📥 Project exported successfully', 'success');
}

/**
 * Import project from JSON file
 */
function importProjectFromJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedProject = JSON.parse(event.target.result);

                // Validate project structure
                if (!importedProject.info || !importedProject.settings) {
                    throw new Error('Invalid project file format');
                }

                // Load imported project
                currentProject = importedProject;

                // Populate UI
                loadProjectIntoUI(currentProject);

                console.log('📤 Project imported:', currentProject.info.name);
                showToast(`📤 "${currentProject.info.name}" imported successfully`, 'success');

            } catch (error) {
                console.error('❌ Import failed:', error);
                showToast('❌ Failed to import project: Invalid file', 'error');
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

/**
 * Load project data into UI fields
 */
function loadProjectIntoUI(project) {
    // Project Info
    if (document.getElementById('projName')) {
        document.getElementById('projName').value = project.info.name || '';
    }
    if (document.getElementById('projLocation')) {
        document.getElementById('projLocation').value = project.info.location || '';
    }
    if (document.getElementById('projClient')) {
        document.getElementById('projClient').value = project.info.client || '';
    }
    if (document.getElementById('projUser')) {
        document.getElementById('projUser').value = project.info.designer || '';
    }
    if (document.getElementById('projDate')) {
        document.getElementById('projDate').value = project.info.date || '';
    }

    // Building Settings
    if (document.getElementById('tableSelect')) {
        document.getElementById('tableSelect').value = project.settings.buildingClass || 'Opt1';
    }

    // Fire Response
    const fireResponseValue = project.settings.fireResponse || '10min';
    const fireResponseRadio = document.querySelector(`input[name="fireResponse"][value="${fireResponseValue}"]`);
    if (fireResponseRadio) {
        fireResponseRadio.checked = true;
    }

    // Sprinkler
    const sprinklerValue = project.settings.sprinklered ? 'yes' : 'no';
    const sprinklerRadio = document.querySelector(`input[name="sprinkMode"][value="${sprinklerValue}"]`);
    if (sprinklerRadio) {
        sprinklerRadio.checked = true;
    }

    // CRITICAL FIX: Restore wall faces to BOTH calculators

    // 1. Restore UO wall faces
    if (window.__bcabd_debug && typeof window.__bcabd_debug.setWallFaces === 'function') {
        const uoWallFaces = project.wallFaces || [];
        console.log('  📊 Restoring UO wall faces:', uoWallFaces.length, 'wall faces');
        window.__bcabd_debug.setWallFaces(uoWallFaces);
        console.log('  ✅ UO wall faces restored');
    } else {
        console.warn('  ⚠️ UO Calculator setWallFaces API not available');
    }

    // 2. Restore Spatial wall faces
    if (window.WallFaces !== undefined) {
        const spatialWalls = project.spatialWalls || [];
        console.log('  📐 Restoring Spatial wall faces:', spatialWalls.length, 'wall faces');
        window.WallFaces = spatialWalls.slice(); // Deep copy to trigger any watchers
        console.log('  ✅ Spatial wall faces restored');
    } else {
        console.warn('  ⚠️ window.WallFaces not available (app.js may not be loaded)');
    }

    // 3. Trigger re-render of wall faces lists in Column 3
    if (typeof window.updateWallFacesList === 'function') {
        const allWallFaces = [...(project.wallFaces || []), ...(project.spatialWalls || [])];
        window.updateWallFacesList(allWallFaces);
    }

    // 4. Regenerate all reports with loaded data
    if (typeof generateAllReports === 'function') {
        console.log('  📄 Regenerating reports with loaded data...');
        setTimeout(() => {
            generateAllReports();
            console.log('  ✅ Reports regenerated');
        }, 100); // Small delay to ensure DOM is updated
    }

    console.log('✅ Project data loaded into UI');
}

// ========================================
// Tab Management
// ========================================

/**
 * Initialize tab switching for all three columns
 */
function initializeTabs() {
    // Get all tab headers
    const tabHeaders = document.querySelectorAll('.tab-header');

    tabHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const targetTabId = header.getAttribute('data-tab');
            const column = header.closest('.column');

            // Deactivate all tabs in this column
            column.querySelectorAll('.tab-header').forEach(th => th.classList.remove('active'));
            column.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            // Activate clicked tab
            header.classList.add('active');
            const targetContent = column.querySelector(`#${targetTabId}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            console.log(`✅ Switched to tab: ${targetTabId}`);

            // AUTO-SWITCH COLUMN 3 TABS BASED ON CALCULATOR TYPE
            // When Unprotected Openings is clicked → open Aggregate Openings
            // When Spatial Calculator is clicked → open Spatial Results
            const columnRight = document.querySelector('.column-right');
            if (columnRight) {
                let column3TargetTab = null;

                if (targetTabId === 'unprotected-openings') {
                    column3TargetTab = 'aggregate-openings';
                    console.log('🔗 Auto-switching to Aggregate Openings tab');
                } else if (targetTabId === 'spatial-calc') {
                    column3TargetTab = 'spatial-results';
                    console.log('🔗 Auto-switching to Spatial Results tab');
                }

                if (column3TargetTab) {
                    // Find and activate the corresponding Column 3 tab
                    const column3TabHeader = columnRight.querySelector(`.tab-header[data-tab="${column3TargetTab}"]`);
                    const column3TabContent = columnRight.querySelector(`#${column3TargetTab}`);

                    if (column3TabHeader && column3TabContent) {
                        // Deactivate all Column 3 tabs
                        columnRight.querySelectorAll('.tab-header').forEach(th => th.classList.remove('active'));
                        columnRight.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

                        // Activate target Column 3 tab
                        column3TabHeader.classList.add('active');
                        column3TabContent.classList.add('active');

                        console.log(`✅ Column 3 auto-switched to: ${column3TargetTab}`);
                    }
                }
            }
        });
    });

    console.log('✅ Tab system initialized');
}

// ========================================
// Project Management (C# Bridge Pattern - NO localStorage)
// ========================================

// In-memory cache of projects (populated by C# via receiveFromCSharp)
window.savedProjects = window.savedProjects || {};
window.currentActiveProjectName = window.currentActiveProjectName || '';

let currentProject = {
    info: {
        name: '',
        location: '',
        client: '',
        designer: '',
        date: ''
    },
    settings: {
        buildingClass: 'Opt1',
        fireResponse: '10min',
        sprinklered: false
    },
    wallFaces: []
};

/**
 * Save current project via C# bridge (NO localStorage)
 */
window.SaveProject = function () {
    // Validate project name
    const projectName = document.getElementById('projName')?.value?.trim();
    if (!projectName) {
        alert('⚠️ Please enter a project name before saving.');
        document.getElementById('projName')?.focus();
        return;
    }

    // Collect project info
    currentProject.info.name = projectName;
    currentProject.info.location = document.getElementById('projLocation')?.value || '';
    currentProject.info.client = document.getElementById('projClient')?.value || '';
    currentProject.info.designer = document.getElementById('projUser')?.value || '';
    currentProject.info.date = document.getElementById('projDate')?.value || '';

    // Collect settings
    currentProject.settings.buildingClass = document.getElementById('tableSelect')?.value || 'Opt1';
    currentProject.settings.fireResponse = document.querySelector('input[name="fireResponse"]:checked')?.value || '10min';
    currentProject.settings.sprinklered = document.querySelector('input[name="sprinkMode"]:checked')?.value === 'yes';

    // CRITICAL FIX: Read wall faces from BOTH calculators BEFORE saving

    // 1. Unprotected Openings wall faces
    if (window.__bcabd_debug && typeof window.__bcabd_debug.getWallFaces === 'function') {
        currentProject.wallFaces = window.__bcabd_debug.getWallFaces() || [];
        console.log('  📊 Read UO wall faces:', currentProject.wallFaces.length, 'wall faces');
    } else {
        console.warn('  ⚠️ UO Calculator debug API not available');
        currentProject.wallFaces = [];
    }

    // 2. Spatial Separation wall faces
    if (window.WallFaces && Array.isArray(window.WallFaces)) {
        currentProject.spatialWalls = window.WallFaces.slice(); // Deep copy
        console.log('  📐 Read Spatial wall faces:', currentProject.spatialWalls.length, 'wall faces');
    } else {
        console.log('  ⚠️ No Spatial wall faces available');
        currentProject.spatialWalls = [];
    }

    // Add metadata
    const totalWallFaceCount = (currentProject.wallFaces?.length || 0) + (currentProject.spatialWalls?.length || 0);
    currentProject.metadata = {
        lastModified: new Date().toISOString(),
        wallFaceCount: currentProject.wallFaces.length,
        spatialWallCount: currentProject.spatialWalls.length,
        totalWallCount: totalWallFaceCount,
        version: '1.1'
    };

    // Build C# bridge payload
    const projectData = {
        command: "SAVE_PROJECT",
        payload: {
            info: currentProject.info,
            settings: currentProject.settings,
            metadata: currentProject.metadata,
            wallFaces: currentProject.wallFaces,
            spatialWalls: currentProject.spatialWalls
        }
    };

    // Send to C# (saves to disk)
    if (window.sendToCSharp) {
        console.log('🚀 Saving Project to C#:', projectName);
        window.sendToCSharp(projectData);
        window.currentActiveProjectName = projectName;

        // Update local memory cache immediately
        window.savedProjects[projectName] = projectData.payload;
        window.RenderProjectList();

        // Visual feedback
        showToast(`✅ Project "${projectName}" saved successfully!`, 'success');
    } else {
        console.error('❌ C# Bridge not available');
        showToast('❌ Unable to save project', 'error');
    }
};

// Alias for compatibility
const saveProject = window.SaveProject;

/**
 * Auto-save project if a project name exists
 * Called automatically when wall faces are added
 */
window.AutoSaveProject = function() {
    const projectName = document.getElementById('projName')?.value?.trim();

    // Only auto-save if a project name exists
    if (!projectName) {
        console.log('⏸️ Auto-save skipped: No project name');
        return;
    }

    console.log('💾 Auto-saving project:', projectName);
    window.SaveProject();
};

// Alias for compatibility
const autoSaveProject = window.AutoSaveProject;

/**
 * Load project from in-memory cache (populated by C#, NO localStorage)
 */
window.LoadProject = function (projectName) {
    const data = window.savedProjects[projectName];
    if (!data) {
        console.error('❌ Project not found:', projectName);
        showToast('❌ Project not found', 'error');
        return;
    }

    try {
        window.currentActiveProjectName = projectName;

        // Update currentProject object
        currentProject = {
            info: data.info || {},
            settings: data.settings || {},
            metadata: data.metadata || {},
            wallFaces: data.wallFaces || [],
            spatialWalls: data.spatialWalls || []
        };

        console.log('📂 Loading project data:', {
            name: currentProject.info.name,
            uoWallFaces: currentProject.wallFaces.length,
            spatialWalls: currentProject.spatialWalls.length
        });

        // Populate UI with loaded data
        loadProjectIntoUI(currentProject);

        console.log('✅ Project loaded:', currentProject.info.name);
        showToast(`✅ "${currentProject.info.name}" loaded successfully`, 'success');

    } catch (error) {
        console.error('❌ Failed to load project:', error);
        showToast('❌ Failed to load project', 'error');
    }
};

// Alias for compatibility
const loadProject = window.LoadProject;

/**
 * Refresh the saved projects list from in-memory cache (NO localStorage)
 */
window.RenderProjectList = function () {
    const projectsList = document.getElementById('savedProjectList');
    if (!projectsList) return;

    // Get projects from in-memory cache (populated by C#)
    const projectNames = Object.keys(window.savedProjects);

    // Clear list
    projectsList.innerHTML = '';

    if (projectNames.length === 0) {
        projectsList.innerHTML = '<p class="placeholder">[No saved projects]</p>';
        return;
    }

    // Build array for sorting
    const projects = projectNames.map(name => ({
        name,
        data: window.savedProjects[name]
    }));

    // Sort by last modified (newest first)
    projects.sort((a, b) => {
        const dateA = new Date(a.data.metadata?.lastModified || 0);
        const dateB = new Date(b.data.metadata?.lastModified || 0);
        return dateB - dateA;
    });

    // Populate list
    projects.forEach(({ name, data }) => {
        // DEFENSIVE: Handle both old and new project formats
        // Old format might not have `info` object, or might use different property names
        let displayName = 'Untitled';
        let displayDate = 'No date';
        let lastModified = 'Unknown';
        let wallFaceCount = 0;

        // Try to extract name from various possible locations
        if (data.info && data.info.name) {
            displayName = data.info.name;
        } else if (data.ProjName) {
            displayName = data.ProjName;  // Old format
        } else if (name) {
            displayName = name;  // Use key as fallback
        }

        // Try to extract date
        if (data.info && data.info.date) {
            displayDate = data.info.date;
        } else if (data.ProjDate) {
            displayDate = data.ProjDate;  // Old format
        }

        // Try to extract last modified
        if (data.metadata && data.metadata.lastModified) {
            lastModified = new Date(data.metadata.lastModified).toLocaleString();
        } else if (data.SavedDate) {
            lastModified = new Date(data.SavedDate).toLocaleString();  // Old format
        }

        // Try to extract wall face count
        if (data.metadata && data.metadata.wallFaceCount !== undefined) {
            wallFaceCount = data.metadata.wallFaceCount;
        } else if (data.wallFaces && Array.isArray(data.wallFaces)) {
            wallFaceCount = data.wallFaces.length;
        } else if (data.walls && Array.isArray(data.walls)) {
            wallFaceCount = data.walls.length;  // Old Spatial format
        }

        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        projectItem.style.cssText = `
            padding: 12px;
            margin: 8px 0;
            border: 2px solid #e67e22;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background-color: white;
        `;

        projectItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <strong style="font-size: 16px; color: #e67e22;">${escapeHtml(displayName)}</strong><br>
                    <small style="color: #666;">
                        📅 ${escapeHtml(displayDate)} | 
                        📊 ${wallFaceCount} wall face(s) | 
                        🕒 ${lastModified}
                    </small>
                </div>
                <button class="delete-project-btn" data-name="${escapeHtml(name)}" 
                        style="background: #e74c3c; color: white; border: none; 
                               padding: 4px 8px; border-radius: 4px; cursor: pointer;
                               font-size: 12px; font-weight: bold;">
                    ✕
                </button>
            </div>
        `;

        // Load project on click
        projectItem.addEventListener('click', (e) => {
            if (!e.target.classList.contains('delete-project-btn')) {
                window.LoadProject(name);
            }
        });

        // Delete project button
        projectItem.querySelector('.delete-project-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            window.DeleteProject(name);
        });

        // Hover effect
        projectItem.addEventListener('mouseenter', () => {
            projectItem.style.backgroundColor = '#fef9f5';
            projectItem.style.transform = 'translateX(4px)';
        });
        projectItem.addEventListener('mouseleave', () => {
            projectItem.style.backgroundColor = 'white';
            projectItem.style.transform = 'translateX(0)';
        });

        projectsList.appendChild(projectItem);
    });

    console.log(`✅ Loaded ${projectNames.length} project(s)`);
};

// Alias for compatibility
const refreshProjectList = window.RenderProjectList;

/**
 * Delete a single project via C# bridge (NO localStorage)
 */
window.DeleteProject = function (projectName) {
    if (!window.savedProjects[projectName]) {
        console.warn('⚠️ Project not found:', projectName);
        return;
    }

    if (!confirm(`Delete project "${projectName}"? This cannot be undone.`)) {
        return;
    }

    // Send delete command to C#
    if (window.sendToCSharp) {
        window.sendToCSharp({
            command: "DELETE_PROJECT",
            payload: { name: projectName }
        });

        // Update local cache immediately
        delete window.savedProjects[projectName];
        window.RenderProjectList();

        console.log('🗑️ Project deleted:', projectName);
        showToast(`🗑️ Project "${projectName}" deleted`, 'error');
    }
};

// Alias for compatibility
const deleteProject = window.DeleteProject;

/**
 * Clear all saved projects via C# bridge (NO localStorage)
 */
window.ClearProjects = function () {
    if (!confirm('Are you sure you want to clear all saved projects? This cannot be undone.')) {
        return;
    }

    // Send clear command to C#
    if (window.sendToCSharp) {
        window.sendToCSharp({
            command: "DELETE_ALL_PROJECTS",
            payload: {}
        });

        // Wipe local cache immediately
        window.savedProjects = {};
        window.currentActiveProjectName = '';

        // Refresh UI
        window.RenderProjectList();

        console.log('🧹 All projects cleared');
        showToast('✅ All projects have been cleared', 'success');
    }
};

// Alias for compatibility
const clearAllProjects = window.ClearProjects;

// ========================================
// Wall Face Management
// ========================================

/**
 * Add a wall face - calls existing calculation function
 */
function addWallFace() {
    if (typeof callSpatialApi === 'function') {
        callSpatialApi();
    }
}

// ========================================
// Event Listeners
// ========================================

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
    // Save Current Project buttons (both tabs)
    const saveProjectBtns = document.querySelectorAll('#saveCurrentProjectBtn, #saveProjectBtn');
    saveProjectBtns.forEach(btn => {
        btn?.addEventListener('click', saveProject);
    });
    
    // Import Project button
    document.getElementById('importProjectBtn')?.addEventListener('click', () => {
        console.log('📥 Importing project from file...');
        importProjectFromJson();
    });

    // Clear Projects button
    document.getElementById('clearProjectBtn')?.addEventListener('click', clearAllProjects);

    // New Project buttons (Spatial Calculator tab only)
    // NOTE: UnprotectedOpeningsCalculator.js handles its own newProjectBtnUO
    const newProjectBtns = ['newProjectBtn', 'newProjectBtnReport'];
    newProjectBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof window.newProject === 'function') {
                    window.newProject();
                } else {
                    console.warn('⚠️ window.newProject function not found');
                }
            });
        }
    });

    // NOTE: UnprotectedOpeningsCalculator.js handles addOpeningToWallFaceBtn

    // Add Wall Face Button - DIFFERENT behavior depending on which tab/column it's in
    // In Column 2 (Spatial Calculator): #addWallFaceBtn calls addWallFace() → callSpatialApi()
    // In Column 3 (Aggregate Openings): #addAnotherWallFaceBtn calls UnprotectedOpeningsCalculator's finalizeCurrentWallFace()

    // Column 2 Spatial Calculator: "Add Wall Face" button
    const addWallFaceBtnSpatial = document.getElementById('addWallFaceBtn');
    if (addWallFaceBtnSpatial) {
        addWallFaceBtnSpatial.addEventListener('click', () => {
            console.log('🔵 [SPATIAL] Add Wall Face button clicked');
            addWallFace();
        });
        console.log('✅ Wired #addWallFaceBtn for Spatial Calculator');
    } else {
        console.warn('⚠️ #addWallFaceBtn not found in DOM');
    }

    // Column 3 Aggregate Openings: "Add Wall Face" button
    document.getElementById('addAnotherWallFaceBtn')?.addEventListener('click', () => {
        // Call UnprotectedOpeningsCalculator's finalizeCurrentWallFace function
        // This is exposed via the __bcabd_debug object or we can trigger the existing button
        const existingBtn = document.getElementById('addWallFaceBtn');
        if (existingBtn) {
            existingBtn.click(); // Trigger the already-wired button from UnprotectedOpeningsCalculator.js
        } else {
            console.warn('⚠️ addWallFaceBtn not found - UnprotectedOpeningsCalculator.js may not be loaded');
        }
    });

    // Column 3: Wall Face Report button (Aggregate Openings)
    document.getElementById('wallFaceReportBtn')?.addEventListener('click', () => {
        // Trigger the generate report button and switch to project report tab
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.click();
        }

        // Switch to Project Report tab in Column 3
        const columnRight = document.querySelector('.column-right');
        if (columnRight) {
            const reportTabHeader = columnRight.querySelector('[data-tab="project-report"]');
            const reportTabContent = columnRight.querySelector('#project-report');
            if (reportTabHeader && reportTabContent) {
                // Deactivate other tabs
                columnRight.querySelectorAll('.tab-header').forEach(th => th.classList.remove('active'));
                columnRight.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                // Activate report tab
                reportTabHeader.classList.add('active');
                reportTabContent.classList.add('active');
                // Scroll to report section
                if (document.getElementById('projectReportSection')) {
                    document.getElementById('projectReportSection').scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    });

    // Column 3: Wall Face Report button (Spatial Results)
    document.getElementById('wallFaceReportBtnSpatial')?.addEventListener('click', () => {
        // Trigger the generate report button and switch to project report tab
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.click();
        }

        // Switch to Project Report tab in Column 3
        const columnRight = document.querySelector('.column-right');
        if (columnRight) {
            const reportTabHeader = columnRight.querySelector('[data-tab="project-report"]');
            const reportTabContent = columnRight.querySelector('#project-report');
            if (reportTabHeader && reportTabContent) {
                // Deactivate other tabs
                columnRight.querySelectorAll('.tab-header').forEach(th => th.classList.remove('active'));
                columnRight.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                // Activate report tab
                reportTabHeader.classList.add('active');
                reportTabContent.classList.add('active');
                // Scroll to report section
                if (document.getElementById('projectReportSection')) {
                    document.getElementById('projectReportSection').scrollIntoView({ behavior: 'smooth' });
                }
            }
        }
    });

    // Duplicate Wall Face button
    document.getElementById('duplicateWallFaceBtn')?.addEventListener('click', () => {
        if (typeof duplicateWallFace === 'function') {
            duplicateWallFace();
        }
    });

    // Reset Form button
    document.getElementById('resetWallFaceBtn')?.addEventListener('click', () => {
        if (typeof resetWallFaceForm === 'function') {
            resetWallFaceForm();
        }
    });

    // NOTE: UnprotectedOpeningsCalculator.js handles emailResultsUO, downloadPDFUO, and newProjectBtnUO

    // Export buttons for Spatial Results & Project Report (standard IDs)
    document.getElementById('emailResults')?.addEventListener('click', () => {
        console.log('📋 Copy spatial report to clipboard');
        // Functionality handled by app.js CopyReportToClipboard()
        if (typeof CopyReportToClipboard === 'function') {
            CopyReportToClipboard();
        }
    });

    document.getElementById('downloadPDF')?.addEventListener('click', () => {
        console.log('📄 Download spatial PDF');
        // Functionality handled by app.js handlePdfGeneration()
        // The button is already wired in app.js via SetupPDFButton()
    });

    document.getElementById('newProjectBtn')?.addEventListener('click', () => {
        if (confirm('Start a new project? Unsaved changes will be lost.')) {
            // Reset currentProject in memory
            currentProject = {
                info: { name: '', location: '', client: '', designer: '', date: '' },
                settings: { buildingClass: 'Opt1', fireResponse: '10min', sprinklered: false },
                wallFaces: [],
                spatialWalls: []
            };

            // Clear UI fields
            if (document.getElementById('projName')) document.getElementById('projName').value = '';
            if (document.getElementById('projLocation')) document.getElementById('projLocation').value = '';
            if (document.getElementById('projClient')) document.getElementById('projClient').value = '';
            if (document.getElementById('projUser')) document.getElementById('projUser').value = '';
            if (document.getElementById('projDate')) {
                document.getElementById('projDate').valueAsDate = new Date();
            }

            // Reset building settings to defaults
            if (document.getElementById('tableSelect')) {
                document.getElementById('tableSelect').value = 'Opt1';
            }
            const fireResponseLow = document.querySelector('input[name="fireResponse"][value="10min"]');
            if (fireResponseLow) fireResponseLow.checked = true;

            const sprinklerNo = document.querySelector('input[name="sprinkMode"][value="no"]');
            if (sprinklerNo) sprinklerNo.checked = true;

            // Clear UO wall faces
            if (window.__bcabd_debug && typeof window.__bcabd_debug.setWallFaces === 'function') {
                window.__bcabd_debug.setWallFaces([]);
            }

            // Clear Spatial wall faces
            if (window.WallFaces !== undefined) {
                window.WallFaces = [];
            }

            // Clear results displays
            if (typeof clearResults === 'function') {
                clearResults();
            }

            // Regenerate empty reports
            if (typeof generateAllReports === 'function') {
                generateAllReports();
            }

            console.log('✅ New project started - UI reset without page reload');
            showToast('✅ New project started', 'success');
        }
    });
    
    console.log('✅ Event listeners initialized');
}

// ========================================
// Column 3: Aggregate Openings Display Updates
// ========================================

/**
 * Update Column 3 aggregate display with current wall face data
 * Called by UnprotectedOpeningsCalculator.js when openings change
 */
window.updateAggregateDisplay = function() {
    // Get wall face name from Column 2
    const wallFaceNameInput = document.getElementById('wallFaceName');
    const wallFaceName = wallFaceNameInput ? wallFaceNameInput.value : '';

    // Update wall face name display in Column 3
    const aggregateWallFaceEl = document.getElementById('aggregateWallFaceName');
    if (aggregateWallFaceEl) {
        aggregateWallFaceEl.textContent = wallFaceName || '—';
    }

    // Get totals from UnprotectedOpeningsCalculator.js's DOM elements
    const totalM2El = document.getElementById('totalAreaFace_m2');
    const totalFt2El = document.getElementById('totalAreaFace_ft2');

    const totalM2Text = totalM2El ? totalM2El.textContent : '—';
    const totalFt2Text = totalFt2El ? totalFt2El.textContent : '—';

    // Update aggregate totals in Column 3
    const aggregateM2El = document.getElementById('aggregateTotalM2');
    const aggregateFt2El = document.getElementById('aggregateTotalFt2');

    if (aggregateM2El) {
        aggregateM2El.textContent = totalM2Text;
    }
    if (aggregateFt2El) {
        aggregateFt2El.textContent = totalFt2Text;
    }

    console.log('📊 Aggregate display updated:', wallFaceName, totalM2Text, totalFt2Text);
};

/**
 * Update the wall faces list in Column 3
 * Shows all finalized wall faces from BOTH systems in both Aggregate Openings and Spatial Results tabs
 */
window.updateWallFacesList = function(wallFaces) {
    // This function is called by UnprotectedOpeningsCalculator.js when UO wall faces change
    // But we also need to show Spatial wall faces, so we trigger the unified render
    if (typeof RenderWallFacesListForReport === 'function') {
        RenderWallFacesListForReport();
    }

    console.log('📋 Wall faces lists updated (delegated to RenderWallFacesListForReport)');

    // Regenerate reports when wall faces change
    generateAllReports();

    // AUTO-SAVE: Save project automatically when wall faces are added
    setTimeout(() => {
        window.AutoSaveProject();
    }, 500); // Small delay to ensure all updates complete
};

/**
 * Send wall face data to Spatial Calculator
 * Transfers aggregate opening area data for spatial separation calculations
 */
window.sendWallFaceToSpatial = function(index) {
    // Get wall face data
    const wallFaces = window.__bcabd_debug.getWallFaces();
    if (!wallFaces || index >= wallFaces.length) {
        console.error('❌ Invalid wall face index:', index);
        return;
    }

    const wf = wallFaces[index];
    console.log('📐 Sending wall face to Spatial Calculator:', wf.name);

    // Check if Spatial Calculator has existing data
    const spatialNameEl = document.getElementById('spatialWallFaceName');
    const spatialOpeningsEl = document.getElementById('openings_m2');

    const existingName = spatialNameEl ? spatialNameEl.value.trim() : '';
    const existingOpenings = spatialOpeningsEl ? spatialOpeningsEl.value.trim() : '';

    if (existingName || existingOpenings) {
        const displayName = existingName || 'unnamed wall face';
        const msg = `This will overwrite existing Spatial Calculator data for "${displayName}". Continue?`;
        if (!confirm(msg)) {
            console.log('⏹️ Transfer cancelled by user');
            return;
        }
    }

    // Track the link
    window.spatialWallFaceLinks[wf.name] = {
        unprotectedWallFaceData: wf,
        spatialWallFaceData: null, // Will be filled when Calculate is clicked
        linkedTimestamp: new Date().toISOString()
    };

    // Transfer data to Spatial Calculator
    if (spatialNameEl) spatialNameEl.value = wf.name || '';
    if (spatialOpeningsEl) spatialOpeningsEl.value = (wf.totalAreaFace_m2 || 0).toFixed(2);

    const spatialOpeningsFt2El = document.getElementById('openings_ft2');
    if (spatialOpeningsFt2El) spatialOpeningsFt2El.value = (wf.totalAreaFace_ft2 || 0).toFixed(2);

    // Switch to Spatial Calculator tab
    switchToSpatialTab();

    // Highlight transferred fields
    highlightTransferredFields();

    console.log(`✅ "${wf.name}" data sent to Spatial Calculator and link tracked`);
    showToast(`📐 "${wf.name}" sent to Spatial Calculator`, 'success');
};

/**
 * Send current wall face data to Spatial Calculator
 * Transfers aggregate opening area from current (unsaved) wall face
 */
window.sendCurrentWallFaceToSpatial = function() {
    console.log('📐 sendCurrentWallFaceToSpatial() called');

    // Check if Spatial Calculator has existing data first
    const spatialNameEl = document.getElementById('spatialWallFaceName');
    const spatialOpeningsEl = document.getElementById('openings_m2');

    const existingName = spatialNameEl ? spatialNameEl.value.trim() : '';
    const existingOpenings = spatialOpeningsEl ? spatialOpeningsEl.value.trim() : '';

    if (existingName || existingOpenings) {
        const displayName = existingName || 'unnamed wall face';
        const msg = `This will overwrite existing Spatial Calculator data for "${displayName}". Continue?`;
        if (!confirm(msg)) {
            console.log('⏹️ Transfer cancelled by user');
            return;
        }
    }

    // CRITICAL FIX: First finalize the current wall face to add it to the permanent list
    // This ensures the openings are saved and will show in the spatial results
    console.log('🏗️ Finalizing current wall face before sending to Spatial...');

    // Get wall face name before finalizing (it gets cleared during finalize)
    const wallFaceNameEl = document.getElementById('wallFaceName');
    const wallFaceName = wallFaceNameEl ? wallFaceNameEl.value.trim() : '';

    if (!wallFaceName) {
        alert('⚠️ Please enter a wall face name before sending to Spatial.');
        return;
    }

    // Check if there are openings in the current wall face
    const wallFaceNameDisplay = document.getElementById('wallFaceNameDisplay');
    const totalAreaM2Display = document.getElementById('totalAreaFace_m2');

    if (!wallFaceNameDisplay || !totalAreaM2Display) {
        console.error('❌ Cannot find current wall face display elements');
        return;
    }

    const displayedName = wallFaceNameDisplay.textContent.trim();
    const displayedArea = totalAreaM2Display.textContent.trim();

    if (displayedName === '—' || displayedArea === '—' || displayedArea === '— m²') {
        alert('⚠️ No openings in current wall face. Add openings first.');
        return;
    }

    // Call the actual finalizeCurrentWallFace function through the button click
    const addWallFaceBtn = document.getElementById('addWallFaceBtnUnprotected');
    if (addWallFaceBtn) {
        console.log('✅ Triggering Add Wall Face to finalize current openings...');
        addWallFaceBtn.click();
    } else {
        console.error('❌ Cannot find Add Wall Face button');
        alert('⚠️ Error: Cannot finalize wall face. Please use "Add Wall Face" button first.');
        return;
    }

    // Now get the wall faces array to find the newly added wall face
    const wallFaces = window.__bcabd_debug ? window.__bcabd_debug.getWallFaces() : [];
    console.log('📋 Retrieved wall faces:', wallFaces.length);

    // Find the wall face we just added (should be the last one with matching name)
    const wf = wallFaces.find(face => face.name === wallFaceName);

    if (!wf) {
        console.error('❌ Could not find finalized wall face:', wallFaceName);
        alert('⚠️ Error: Wall face was not properly finalized.');
        return;
    }

    console.log('✅ Found finalized wall face with', wf.openings.length, 'openings');

    // Track the link with the complete wall face data including openings
    window.spatialWallFaceLinks[wallFaceName] = {
        unprotectedWallFaceData: {
            name: wf.name,
            totalAreaFace_m2: wf.totalAreaFace_m2,
            totalAreaFace_ft2: wf.totalAreaFace_ft2,
            openings: wf.openings // Now includes the actual openings array
        },
        spatialWallFaceData: null,
        linkedTimestamp: new Date().toISOString()
    };

    // Transfer data to Spatial Calculator
    if (spatialNameEl) spatialNameEl.value = wf.name;
    if (spatialOpeningsEl) {
        // Store precise value in dataset, display rounded value
        spatialOpeningsEl.dataset.precise = wf.totalAreaFace_m2_precise || wf.totalAreaFace_m2;
        spatialOpeningsEl.value = wf.totalAreaFace_m2.toFixed(2);
    }

    const spatialOpeningsFt2El = document.getElementById('openings_ft2');
    if (spatialOpeningsFt2El) {
        // Calculate imperial from precise metric value
        const preciseM2 = wf.totalAreaFace_m2_precise || wf.totalAreaFace_m2;
        const preciseFt2 = preciseM2 * 10.7639; // SQFT_PER_M2
        spatialOpeningsFt2El.dataset.precise = preciseFt2;
        spatialOpeningsFt2El.value = preciseFt2.toFixed(2);
    }

    // Switch to Spatial Calculator tab
    switchToSpatialTab();

    // Highlight transferred fields
    highlightTransferredFields();

    console.log(`✅ "${wf.name}" finalized and sent to Spatial Calculator with ${wf.openings.length} openings`);
    showToast(`📐 "${wf.name}" sent to Spatial Calculator`, 'success');
};

/**
 * Switch Column 2 (Middle) to Spatial Calculator tab AND Column 3 (Right) to Spatial Results tab
 */
function switchToSpatialTab() {
    // Switch Column 2 to Spatial Calculator
    const middleColumn = document.querySelector('.column-middle');
    if (!middleColumn) {
        console.error('❌ Cannot find middle column');
        return;
    }

    // Find the Spatial Calculator tab button
    const spatialTabButton = middleColumn.querySelector('.tab-header[data-tab="spatial-calc"]');
    if (!spatialTabButton) {
        console.error('❌ Cannot find Spatial Calculator tab button');
        return;
    }

    // Deactivate all tabs in middle column
    middleColumn.querySelectorAll('.tab-header').forEach(th => th.classList.remove('active'));
    middleColumn.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    // Activate Spatial Calculator tab
    spatialTabButton.classList.add('active');
    const spatialContent = middleColumn.querySelector('#spatial-calc');
    if (spatialContent) {
        spatialContent.classList.add('active');
    }

    console.log('✅ Switched to Spatial Calculator tab');

    // Switch Column 3 to Spatial Results
    const rightColumn = document.querySelector('.column-right');
    if (rightColumn) {
        const spatialResultsTabButton = rightColumn.querySelector('.tab-header[data-tab="spatial-results"]');
        const spatialResultsContent = rightColumn.querySelector('#spatial-results');

        if (spatialResultsTabButton && spatialResultsContent) {
            // Deactivate all tabs in right column
            rightColumn.querySelectorAll('.tab-header').forEach(th => th.classList.remove('active'));
            rightColumn.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            // Activate Spatial Results tab
            spatialResultsTabButton.classList.add('active');
            spatialResultsContent.classList.add('active');

            console.log('✅ Switched to Spatial Results tab');
        } else {
            console.warn('⚠️ Spatial Results tab not found in Column 3');
        }
    } else {
        console.warn('⚠️ Cannot find right column');
    }
}

/**
 * Highlight transferred fields briefly with green border
 */
function highlightTransferredFields() {
    const fieldsToHighlight = [
        'spatialWallFaceName',
        'openings_m2',
        'openings_ft2'
    ];

    fieldsToHighlight.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.add('field-highlight');
            setTimeout(() => {
                field.classList.remove('field-highlight');
            }, 2000); // Remove after 2 seconds
        }
    });
}

/**
 * Delete a wall face from the list
 * Uses UnprotectedOpeningsCalculator.js's exposed debug function
 */
window.deleteWallFace = function(index) {
    if (!confirm('Delete this wall face and all its openings?')) return;

    // Call UnprotectedOpeningsCalculator.js's deleteWallFaceByIndex function
    if (window.__bcabd_debug && typeof window.__bcabd_debug.deleteWallFaceByIndex === 'function') {
        const success = window.__bcabd_debug.deleteWallFaceByIndex(index);
        if (success) {
            showToast('✅ Wall face deleted successfully', 'success');
            console.log('🗑️ Wall face deleted:', index);
        } else {
            showToast('❌ Failed to delete wall face', 'error');
            console.error('❌ Delete failed - invalid index:', index);
        }
    } else {
        showToast('⚠️ Delete function not available - UnprotectedOpeningsCalculator.js may not be loaded', 'warning');
        console.warn('⚠️ window.__bcabd_debug.deleteWallFaceByIndex not found');
    }
};

// ========================================
// Report Generation System
// ========================================

/**
 * Global storage for wall face links between Unprotected Openings and Spatial Calculator
 * Key = wall face name, Value = { unprotectedData, spatialData, linkedTimestamp }
 */
window.spatialWallFaceLinks = window.spatialWallFaceLinks || {};

/**
 * Cached report content (HTML and text)
 */
let cachedReports = {
    combined: { html: '', text: '' },
    unprotected: { html: '', text: '' },
    spatial: { html: '', text: '' }
};

/**
 * Standard disclaimer text for all reports
 */
const REPORT_DISCLAIMER_HTML = '<div style="margin-top:20px; background-color:whitesmoke; color:#000000; padding:20px 30px; border:1px solid #000000; font-size:14px; line-height:1.4; text-align: justify;">NOTE: Code References are to the 2024 Edition of the BC Building Code. While every effort has been made to ensure accuracy, it is the responsibility of the user to confirm all references and calculations are correct before using any data, calculations, or references in real life application. Gerwulf Systems cannot be held responsible for any errors or omissions while this tool and information is used. All users should do their own due diligence to ensure spatial separations and all code requirements are being met for their own projects. This calculator is provided as tools to help determine the allowable area of unprotected openings according to the BC Building Code Requirements in 9.10.14. and 9.10.15. Please note that the BC Building Code does not give explicit permission to use interpolations of the tables to determine permitted unprotected openings. The final decision as to whether interpolations are permitted rests with the Authority Having Jurisdiction (AHJ). It is recommended that you consult the AHJ to confirm whether or not interpolations of the tables are acceptable.</div>';

const REPORT_DISCLAIMER_TEXT = '\n\nNOTE: Code References are to the 2024 Edition of the BC Building Code. While every effort has been made to ensure accuracy, it is the responsibility of the user to confirm all references and calculations are correct before using any data, calculations, or references in real life application. Gerwulf Systems cannot be held responsible for any errors or omissions while this tool and information is used. All users should do their own due diligence to ensure spatial separations and all code requirements are being met for their own projects. This calculator is provided as tools to help determine the allowable area of unprotected openings according to the BC Building Code Requirements in 9.10.14. and 9.10.15. Please note that the BC Building Code does not give explicit permission to use interpolations of the tables to determine permitted unprotected openings. The final decision as to whether interpolations are permitted rests with the Authority Having Jurisdiction (AHJ). It is recommended that you consult the AHJ to confirm whether or not interpolations of the tables are acceptable.\n\n';

/**
 * Generate all three reports and cache them
 * Called whenever calculator data changes
 */
function generateAllReports() {
    console.log('📄 Generating all reports...');

    // Generate each report type
    cachedReports.combined = generateCombinedReport();
    cachedReports.unprotected = generateUnprotectedReport();
    cachedReports.spatial = generateSpatialReport();

    // Update visible report
    updateVisibleReport();

    console.log('✅ All reports generated');
}

/**
 * Generate Combined Report (merges UO and Spatial data by wall face)
 * Shows ALL wall faces from both systems
 */
function generateCombinedReport() {
    const html = [];
    const text = [];

    // Header
    html.push('<div style="font-weight:bold; margin-bottom:8px;">COMBINED PROJECT REPORT: SPATIAL SEPARATION & UNPROTECTED OPENINGS</div>');
    html.push('<div>Gerwulf Systems & BCABD ©2025</div>');
    text.push('COMBINED PROJECT REPORT: SPATIAL SEPARATION & UNPROTECTED OPENINGS');
    text.push('Gerwulf Systems & BCABD ©2025');
    text.push('');

    // Project Information (unified)
    html.push('<hr>');
    html.push('<div class="project-report-section">');
    html.push('<div class="section-heading">PROJECT INFORMATION</div>');
    text.push('PROJECT INFORMATION');

    const projName = document.getElementById('projName')?.value || '—';
    const projLocation = document.getElementById('projLocation')?.value || '—';
    const projClient = document.getElementById('projClient')?.value || '—';
    const projUser = document.getElementById('projUser')?.value || '—';
    const projDate = document.getElementById('projDate')?.value || '—';

    html.push(`<div class="info-row"><div class="label">Project Name:</div><div class="value">${escapeHtml(projName)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Project Location:</div><div class="value">${escapeHtml(projLocation)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Client Name:</div><div class="value">${escapeHtml(projClient)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Designer:</div><div class="value">${escapeHtml(projUser)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Date:</div><div class="value">${escapeHtml(projDate)}</div></div>`);
    html.push('</div>');

    text.push(`Project Name: ${projName}`);
    text.push(`Project Location: ${projLocation}`);
    text.push(`Client Name: ${projClient}`);
    text.push(`Designer: ${projUser}`);
    text.push(`Date: ${projDate}`);
    text.push('');

    // Building Classification (unified)
    html.push('<div class="project-report-section">');
    html.push('<div class="section-heading">BUILDING CLASSIFICATION</div>');
    text.push('BUILDING CLASSIFICATION');

    const tableSelect = document.getElementById('tableSelect');
    const buildingClass = tableSelect ? (tableSelect.options[tableSelect.selectedIndex]?.text || '—') : '—';
    const fireResp = document.getElementById('fireRespHigh')?.checked ? 'Greater Than 10 min' : '10 min or Less';
    const sprinklered = document.getElementById('sprinkYes')?.checked ? 'Sprinklered' : 'Non-sprinklered';

    html.push(`<div class="info-row"><div class="label">Building Classification:</div><div class="value">${escapeHtml(buildingClass)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Fire Response Time:</div><div class="value">${fireResp}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Sprinkler System:</div><div class="value">${sprinklered}</div></div>`);
    html.push('</div>');

    text.push(`Building Classification: ${buildingClass}`);
    text.push(`Fire Response Time: ${fireResp}`);
    text.push(`Sprinkler System: ${sprinklered}`);
    text.push('');

    // Add disclaimer
    html.push(REPORT_DISCLAIMER_HTML);
    text.push(REPORT_DISCLAIMER_TEXT);

    // Collect ALL wall faces from BOTH systems
    const wallFaceMap = {}; // Key = wall face name, Value = { uoData, spatialData }

    // 1. Collect all Unprotected Openings wall faces
    if (window.__bcabd_debug && typeof window.__bcabd_debug.getWallFaces === 'function') {
        const uoWallFaces = window.__bcabd_debug.getWallFaces();
        if (uoWallFaces && Array.isArray(uoWallFaces)) {
            uoWallFaces.forEach(wf => {
                const name = wf.name || 'Untitled';
                if (!wallFaceMap[name]) {
                    wallFaceMap[name] = { uoData: null, spatialData: null };
                }
                wallFaceMap[name].uoData = wf;
            });
        }
    }

    // 2. Collect all Spatial Calculator wall faces
    if (window.WallFaces && Array.isArray(window.WallFaces)) {
        window.WallFaces.forEach(wf => {
            const name = wf.Name || 'Untitled';
            if (!wallFaceMap[name]) {
                wallFaceMap[name] = { uoData: null, spatialData: null };
            }
            wallFaceMap[name].spatialData = wf;
        });
    }

    // 3. For linked wall faces, ensure we have UO data from links if the main collection missed it
    // This handles edge cases where link exists but UO wall face was deleted/renamed
    const linkedNames = Object.keys(window.spatialWallFaceLinks || {});
    linkedNames.forEach(name => {
        const link = window.spatialWallFaceLinks[name];
        // Only use link UO data if we don't already have UO data from the main collection
        if (!wallFaceMap[name]?.uoData && link.unprotectedWallFaceData) {
            if (!wallFaceMap[name]) {
                wallFaceMap[name] = { uoData: null, spatialData: null };
            }
            wallFaceMap[name].uoData = link.unprotectedWallFaceData;
        }
    });

    // Get all wall face names (merged list)
    const allWallFaceNames = Object.keys(wallFaceMap);

    if (allWallFaceNames.length === 0) {
        html.push('<div style="margin-top:20px;"><p class="placeholder">No wall faces calculated yet. Use either Unprotected Openings or Spatial Calculator to add wall faces.</p></div>');
        text.push('No wall faces calculated yet.');
    } else {
        allWallFaceNames.forEach((wallFaceName, index) => {
            const { uoData, spatialData } = wallFaceMap[wallFaceName];

            html.push('<hr style="margin: 20px 0; border: 2px solid #e67e22;">');
            html.push(`<div class="project-report-section"><h3 style="color: #e67e22; margin-bottom:15px;">WALL FACE ${index + 1}: ${escapeHtml(wallFaceName)}</h3>`);
            text.push('========================');
            text.push(`WALL FACE ${index + 1}: ${wallFaceName}`);
            text.push('========================');
            text.push('');

            // Unprotected Openings section (if exists)
            if (uoData) {
                html.push('<div style="margin-bottom:20px;"><h4 style="color: #1c49c4; margin-bottom:10px;">UNPROTECTED OPENINGS CALCULATION</h4>');
                text.push('UNPROTECTED OPENINGS CALCULATION');

                if (uoData.openings && uoData.openings.length > 0) {
                    uoData.openings.forEach((op, i) => {
                        const dimsMetric = op.width_m ? `${op.width_m.toFixed(4)} m x ${op.height_m.toFixed(4)} m` : 'N/A';
                        const dimsImperial = (op.width_ft_display && op.height_ft_display) ? `${op.width_ft_display} x ${op.height_ft_display}` : 'N/A';
                        const roMetric = (op.widthRO_m_display && op.heightRO_m_display) ? `${op.widthRO_m_display.toFixed(4)} m x ${op.heightRO_m_display.toFixed(4)} m` : 'N/A';
                        const roImperial = (op.widthRO_ft_display && op.heightRO_ft_display) ? `${op.widthRO_ft_display} x ${op.heightRO_ft_display}` : 'N/A';

                        html.push(`<div style="margin-left:15px;">Opening ${i + 1}: ${op.typeLabel} ${dimsMetric} / ${dimsImperial} (RO ${roMetric} / ${roImperial}) Area: ${(op.area_m2_display || 0).toFixed(2)} m² / ${(op.area_ft2_display || 0).toFixed(2)} ft²</div>`);
                        text.push(`  Opening ${i + 1}: ${op.typeLabel} ${dimsMetric} / ${dimsImperial} (RO ${roMetric} / ${roImperial}) Area: ${(op.area_m2_display || 0).toFixed(2)} m² / ${(op.area_ft2_display || 0).toFixed(2)} ft²`);
                    });

                    html.push(`<div style="margin-left:15px; margin-top:10px; font-weight:bold;">Total Area of Openings: ${uoData.totalAreaFace_m2.toFixed(2)} m² / ${uoData.totalAreaFace_ft2.toFixed(2)} ft²</div>`);
                    text.push(`Total Area of Openings: ${uoData.totalAreaFace_m2.toFixed(2)} m² / ${uoData.totalAreaFace_ft2.toFixed(2)} ft²`);
                } else {
                    html.push('<div style="margin-left:15px; font-style:italic; color:#666;">No openings data available</div>');
                    text.push('No openings data available');
                }
                html.push('</div>');
                text.push('');
            }

            // Spatial Separation section (if exists)
            if (spatialData) {
                html.push('<div style="margin-bottom:20px;"><h4 style="color: #3498db; margin-bottom:10px;">SPATIAL SEPARATION ANALYSIS</h4>');
                text.push('SPATIAL SEPARATION ANALYSIS');

                // Only show non-null/non-empty values
                if (spatialData.Area_m2 && spatialData.Area_ft2) {
                    html.push(`<div style="margin-left:15px;">Wall Area: ${spatialData.Area_m2} m² / ${spatialData.Area_ft2} ft²</div>`);
                    text.push(`WALL AREA: ${spatialData.Area_m2} m² / ${spatialData.Area_ft2} ft²`);
                }

                if (spatialData.LimitDist_m && spatialData.LimitDist_ft) {
                    html.push(`<div style="margin-left:15px;">Limiting Distance: ${spatialData.LimitDist_m} m / ${spatialData.LimitDist_ft} ft</div>`);
                    text.push(`LIMITING DISTANCE: ${spatialData.LimitDist_m} m / ${spatialData.LimitDist_ft} ft`);
                }

                if (spatialData.MaxOpen_m2 && spatialData.MaxOpen_ft2) {
                    html.push(`<div style="margin-left:15px;">Maximum Area of Unprotected Openings Permitted: ${spatialData.MaxOpen_m2} m² / ${spatialData.MaxOpen_ft2} ft²</div>`);
                    text.push(`MAXIMUM AREA OF UNPROTECTED OPENINGS PERMITTED: ${spatialData.MaxOpen_m2} m² / ${spatialData.MaxOpen_ft2} ft²`);
                }

                // Highlight if UO data is present (linked)
                const openingsStyle = uoData ? 'color: #27ae60; font-weight:bold;' : '';
                const linkIndicator = uoData ? ' ⬅️ FROM ABOVE' : '';
                if (spatialData.Openings_m2 && spatialData.Openings_ft2) {
                    html.push(`<div style="margin-left:15px; ${openingsStyle}">Actual Area of Unprotected Openings: ${spatialData.Openings_m2} m² / ${spatialData.Openings_ft2} ft²${linkIndicator}</div>`);
                    text.push(`ACTUAL AREA OF UNPROTECTED OPENINGS: ${spatialData.Openings_m2} m² / ${spatialData.Openings_ft2} ft²${linkIndicator}`);
                }

                if (spatialData.MaxPctAllowed) {
                    html.push(`<div style="margin-left:15px;">Maximum Percentage Allowed: ${spatialData.MaxPctAllowed}</div>`);
                    text.push(`MAXIMUM PERCENTAGE ALLOWED: ${spatialData.MaxPctAllowed}`);
                }

                if (spatialData.ActualPct) {
                    html.push(`<div style="margin-left:15px;">Actual Percentage: ${spatialData.ActualPct}</div>`);
                    text.push(`ACTUAL PERCENTAGE: ${spatialData.ActualPct}`);
                }

                if (spatialData.RatioDisplay && spatialData.RatioDisplay !== '—') {
                    html.push(`<div style="margin-left:15px;">Width to Height Ratio: ${spatialData.RatioDisplay}</div>`);
                    text.push(`WIDTH TO HEIGHT RATIO: ${spatialData.RatioDisplay}`);
                }

                if (spatialData.MaxIndivOpen_m2 && spatialData.MaxIndivOpen_ft2 && 
                    spatialData.MaxIndivOpen_m2 !== '—' && spatialData.MaxIndivOpen_ft2 !== '—') {
                    html.push(`<div style="margin-left:15px;">Maximum Area of Individual Openings: ${spatialData.MaxIndivOpen_m2} m² / ${spatialData.MaxIndivOpen_ft2} ft²</div>`);
                    text.push(`MAXIMUM AREA OF INDIVIDUAL OPENINGS: ${spatialData.MaxIndivOpen_m2} m² / ${spatialData.MaxIndivOpen_ft2} ft²`);
                }

                if (spatialData.SprinklerStandard && spatialData.SprinklerStandard !== '—' && spatialData.SprinklerStandard !== null) {
                    html.push(`<div style="margin-left:15px;">Sprinkler System Design Standard: ${spatialData.SprinklerStandard}</div>`);
                    text.push(`SPRINKLER SYSTEM DESIGN STANDARD: ${spatialData.SprinklerStandard}`);
                }

                if (spatialData.Frr && spatialData.Frr !== '—') {
                    html.push(`<div style="margin-left:15px;">Minimum Fire-Resistance Rating: ${spatialData.Frr}</div>`);
                    text.push(`MINIMUM FIRE-RESISTANCE RATING: ${spatialData.Frr}`);
                }

                if (spatialData.Conreq && spatialData.Conreq !== '—') {
                    html.push(`<div style="margin-left:15px;">Type of Construction Required: ${spatialData.Conreq}</div>`);
                    text.push(`TYPE OF CONSTRUCTION REQUIRED: ${spatialData.Conreq}`);
                }

                if (spatialData.Clad && spatialData.Clad !== '—') {
                    html.push(`<div style="margin-left:15px;">Type of Cladding Required: ${spatialData.Clad}</div>`);
                    text.push(`TYPE OF CLADDING REQUIRED: ${spatialData.Clad}`);
                }

                if (spatialData.PassFail) {
                    const passFailColor = spatialData.PassFail === 'PASS' ? '#27ae60' : '#e74c3c';
                    html.push(`<div style="margin-left:15px; margin-top:10px; font-weight:bold; color:${passFailColor}; font-size:18px;">Result: ${spatialData.PassFail}</div>`);
                    text.push(`RESULT: ${spatialData.PassFail}`);
                }

                html.push('</div>');
                text.push('');
            }

            // Show message if wall face has no data from either system (shouldn't happen, but defensive)
            if (!uoData && !spatialData) {
                html.push('<div style="margin-left:15px; font-style:italic; color:#999;">No calculation data available for this wall face</div>');
                text.push('No calculation data available for this wall face');
            }

            html.push('</div>');
        });
    }

    return {
        html: html.join(''),
        text: text.join('\n')
    };
}

/**
 * Generate Unprotected Openings Report (formatted HTML for display + plain text for export)
 */
function generateUnprotectedReport() {
    const html = [];
    const text = [];

    // Header
    html.push('<div style="font-weight:bold; margin-bottom:8px;">UNPROTECTED AND GLAZED OPENINGS CALCULATIONS</div>');
    html.push('<div>BCABD BC Association of Building Designers ©2025</div>');
    text.push('UNPROTECTED AND GLAZED OPENINGS CALCULATIONS');
    text.push('BCABD BC Association of Building Designers ©2025');
    text.push('');

    // Project Information
    html.push('<hr>');
    html.push('<div class="project-report-section">');
    html.push('<div class="section-heading">PROJECT INFORMATION</div>');
    text.push('PROJECT INFORMATION');

    const projName = document.getElementById('projName')?.value || '—';
    const projLocation = document.getElementById('projLocation')?.value || '—';
    const projClient = document.getElementById('projClient')?.value || '—';
    const projUser = document.getElementById('projUser')?.value || '—';
    const projDate = document.getElementById('projDate')?.value || '—';

    html.push(`<div class="info-row"><div class="label">Project Name:</div><div class="value">${escapeHtml(projName)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Project Location:</div><div class="value">${escapeHtml(projLocation)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Client Name:</div><div class="value">${escapeHtml(projClient)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Designer:</div><div class="value">${escapeHtml(projUser)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Date:</div><div class="value">${escapeHtml(projDate)}</div></div>`);
    html.push('</div>');

    text.push(`Project Name: ${projName}`);
    text.push(`Project Location: ${projLocation}`);
    text.push(`Client Name: ${projClient}`);
    text.push(`Designer: ${projUser}`);
    text.push(`Date: ${projDate}`);
    text.push('');

    // Building Classification
    html.push('<div class="project-report-section">');
    html.push('<div class="section-heading">BUILDING CLASSIFICATION</div>');
    text.push('BUILDING CLASSIFICATION');

    const tableSelect = document.getElementById('tableSelect');
    const buildingClass = tableSelect ? (tableSelect.options[tableSelect.selectedIndex]?.text || '—') : '—';
    const fireResp = document.getElementById('fireRespHigh')?.checked ? 'Greater Than 10 min' : '10 min or Less';
    const sprinklered = document.getElementById('sprinkYes')?.checked ? 'Sprinklered' : 'Non-sprinklered';

    html.push(`<div class="info-row"><div class="label">Building Classification:</div><div class="value">${escapeHtml(buildingClass)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Fire Response Time:</div><div class="value">${fireResp}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Sprinkler System:</div><div class="value">${sprinklered}</div></div>`);
    html.push('</div>');

    text.push(`Building Classification: ${buildingClass}`);
    text.push(`Fire Response Time: ${fireResp}`);
    text.push(`Sprinkler System: ${sprinklered}`);
    text.push('');

    // Add disclaimer
    html.push(REPORT_DISCLAIMER_HTML);
    text.push(REPORT_DISCLAIMER_TEXT);

    // Get Unprotected Openings wall faces
    if (window.__bcabd_debug && typeof window.__bcabd_debug.getWallFaces === 'function') {
        try {
            const wallFaces = window.__bcabd_debug.getWallFaces();

            if (!wallFaces || wallFaces.length === 0) {
                html.push('<div style="margin-top:20px;"><p class="placeholder">No wall faces with openings added yet.</p></div>');
                text.push('No wall faces with openings added yet.');
            } else {
                // Loop through each wall face
                wallFaces.forEach((wf, index) => {
                    html.push('<hr style="margin: 20px 0; border: 2px solid #3498db;">');
                    html.push(`<div class="project-report-section"><h3 style="color: #3498db; margin-bottom:15px;">WALL FACE ${index + 1}: ${escapeHtml(wf.name || 'Untitled')}</h3>`);
                    text.push('');
                    text.push(`WALL FACE ${index + 1}: ${wf.name || 'Untitled'}`);
                    text.push('-------------------');

                    // Display openings
                    if (wf.openings && wf.openings.length > 0) {
                        html.push('<div style="margin-top:10px; margin-bottom:10px;"><strong>Openings:</strong></div>');
                        text.push('Openings:');

                        wf.openings.forEach((op, opIndex) => {
                            const dimsMetric = op.width_m ? `${op.width_m.toFixed(4)} m × ${op.height_m.toFixed(4)} m` : 'N/A';
                            const dimsImperial = (op.width_ft_display && op.height_ft_display) ? `${op.width_ft_display} × ${op.height_ft_display}` : 'N/A';
                            const roMetric = (op.widthRO_m_display && op.heightRO_m_display) ? `${op.widthRO_m_display.toFixed(4)} m × ${op.heightRO_m_display.toFixed(4)} m` : 'N/A';
                            const roImperial = (op.widthRO_ft_display && op.heightRO_ft_display) ? `${op.widthRO_ft_display} × ${op.heightRO_ft_display}` : 'N/A';
                            const areaDisplay = `${(op.area_m2_display || 0).toFixed(2)} m² / ${(op.area_ft2_display || 0).toFixed(2)} ft²`;

                            html.push(`<div style="margin-left:15px; margin-bottom:8px;">`);
                            html.push(`<strong>Opening ${opIndex + 1}:</strong> ${escapeHtml(op.typeLabel || 'Opening')}<br>`);
                            html.push(`<span style="margin-left:15px;">Dimensions: ${dimsMetric} / ${dimsImperial}</span><br>`);
                            html.push(`<span style="margin-left:15px;">Rough Opening: ${roMetric} / ${roImperial}</span><br>`);
                            html.push(`<span style="margin-left:15px;">Area: ${areaDisplay}</span>`);
                            html.push('</div>');

                            text.push(`  Opening ${opIndex + 1}: ${op.typeLabel || 'Opening'}`);
                            text.push(`    Dimensions: ${dimsMetric} / ${dimsImperial}`);
                            text.push(`    Rough Opening: ${roMetric} / ${roImperial}`);
                            text.push(`    Area: ${areaDisplay}`);
                        });
                    } else {
                        html.push('<div style="margin-left:15px; font-style:italic; color:#666;">No openings recorded</div>');
                        text.push('  No openings recorded');
                    }

                    // Total area
                    const totalM2 = wf.totalAreaFace_m2 ?? '—';
                    const totalFt2 = wf.totalAreaFace_ft2 ?? '—';
                    html.push(`<div style="margin-top:15px;"><strong>Total Area of Openings:</strong> ${totalM2} m² / ${totalFt2} ft²</div>`);
                    text.push(`Total Area of Openings: ${totalM2} m² / ${totalFt2} ft²`);

                    html.push('</div>');
                });
            }

            return {
                html: html.join(''),
                text: text.join('\n')
            };

        } catch (error) {
            console.error('❌ UO Report generation failed:', error);
            return {
                html: '<p class="placeholder">Error generating Unprotected Openings report.</p>',
                text: 'Error generating Unprotected Openings report.'
            };
        }
    }

    console.warn('⚠️ UO Report: getWallFaces function not available');
    return {
        html: '<p class="placeholder">Unprotected Openings Calculator not loaded.</p>',
        text: 'Unprotected Openings Calculator not loaded.'
    };
}

/**
 * Generate Spatial Results Report (formatted HTML for display + plain text for export)
 */
function generateSpatialReport() {
    console.log('🔍 generateSpatialReport called');
    console.log('🔍 window.WallFaces exists?', !!window.WallFaces);
    console.log('🔍 window.WallFaces is array?', Array.isArray(window.WallFaces));
    console.log('🔍 window.WallFaces length:', window.WallFaces?.length);

    const html = [];
    const text = [];

    // Header
    html.push('<div style="font-weight:bold; margin-bottom:8px;">INTERPOLATION CALCULATOR FOR SPATIAL SEPARATION RESULTS</div>');
    html.push('<div>Gerwulf Systems ©2025</div>');
    text.push('INTERPOLATION CALCULATOR FOR SPATIAL SEPARATION RESULTS');
    text.push('Gerwulf Systems ©2025');
    text.push('');

    // Project Information
    html.push('<hr>');
    html.push('<div class="project-report-section">');
    html.push('<div class="section-heading">PROJECT INFORMATION</div>');
    text.push('PROJECT INFORMATION');

    const projName = document.getElementById('projName')?.value || '—';
    const projLocation = document.getElementById('projLocation')?.value || '—';
    const projClient = document.getElementById('projClient')?.value || '—';
    const projUser = document.getElementById('projUser')?.value || '—';
    const projDate = document.getElementById('projDate')?.value || '—';

    html.push(`<div class="info-row"><div class="label">Project Name:</div><div class="value">${escapeHtml(projName)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Project Location:</div><div class="value">${escapeHtml(projLocation)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Client Name:</div><div class="value">${escapeHtml(projClient)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Designer:</div><div class="value">${escapeHtml(projUser)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Date:</div><div class="value">${escapeHtml(projDate)}</div></div>`);
    html.push('</div>');

    text.push(`Project Name: ${projName}`);
    text.push(`Project Location: ${projLocation}`);
    text.push(`Client Name: ${projClient}`);
    text.push(`Designer: ${projUser}`);
    text.push(`Date: ${projDate}`);
    text.push('');

    // Building Classification
    html.push('<div class="project-report-section">');
    html.push('<div class="section-heading">BUILDING CLASSIFICATION</div>');
    text.push('BUILDING CLASSIFICATION');

    const tableSelect = document.getElementById('tableSelect');
    const buildingClass = tableSelect ? (tableSelect.options[tableSelect.selectedIndex]?.text || '—') : '—';
    const fireResp = document.getElementById('fireRespHigh')?.checked ? 'Greater Than 10 min' : '10 min or Less';
    const sprinklered = document.getElementById('sprinkYes')?.checked ? 'Sprinklered' : 'Non-sprinklered';

    html.push(`<div class="info-row"><div class="label">Building Classification:</div><div class="value">${escapeHtml(buildingClass)}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Fire Response Time:</div><div class="value">${fireResp}</div></div>`);
    html.push(`<div class="info-row"><div class="label">Sprinkler System:</div><div class="value">${sprinklered}</div></div>`);
    html.push('</div>');

    text.push(`Building Classification: ${buildingClass}`);
    text.push(`Fire Response Time: ${fireResp}`);
    text.push(`Sprinkler System: ${sprinklered}`);
    text.push('');

    // Add disclaimer
    html.push(REPORT_DISCLAIMER_HTML);
    text.push(REPORT_DISCLAIMER_TEXT);

    // Get Spatial Calculator wall faces
    if (window.WallFaces && Array.isArray(window.WallFaces)) {
        try {
            if (window.WallFaces.length === 0) {
                html.push('<div style="margin-top:20px;"><p class="placeholder">No spatial calculations performed yet.</p></div>');
                text.push('No spatial calculations performed yet.');
            } else {
                // Loop through each wall face
                window.WallFaces.forEach((wf, index) => {
                    html.push('<hr style="margin: 20px 0; border: 2px solid #27ae60;">');
                    html.push(`<div class="project-report-section"><h3 style="color: #27ae60; margin-bottom:15px;">WALL FACE ${index + 1}: ${escapeHtml(wf.Name || 'Untitled')}</h3>`);
                    text.push('');
                    text.push(`WALL FACE ${index + 1}: ${wf.Name || 'Untitled'}`);
                    text.push('-------------------');

                    // Wall Area
                    if (wf.Area_m2 && wf.Area_ft2) {
                        html.push(`<div style="margin-left:15px;">Wall Area: ${wf.Area_m2} m² / ${wf.Area_ft2} ft²</div>`);
                        text.push(`WALL AREA: ${wf.Area_m2} m² / ${wf.Area_ft2} ft²`);
                    }

                    // Limiting Distance
                    if (wf.LimitDist_m && wf.LimitDist_ft) {
                        html.push(`<div style="margin-left:15px;">Limiting Distance: ${wf.LimitDist_m} m / ${wf.LimitDist_ft} ft</div>`);
                        text.push(`LIMITING DISTANCE: ${wf.LimitDist_m} m / ${wf.LimitDist_ft} ft`);
                    }

                    // Maximum Permitted Openings
                    if (wf.MaxOpen_m2 && wf.MaxOpen_ft2) {
                        html.push(`<div style="margin-left:15px;">Maximum Area of Unprotected Openings Permitted: ${wf.MaxOpen_m2} m² / ${wf.MaxOpen_ft2} ft²</div>`);
                        text.push(`MAXIMUM AREA OF UNPROTECTED OPENINGS PERMITTED: ${wf.MaxOpen_m2} m² / ${wf.MaxOpen_ft2} ft²`);
                    }

                    // Actual Openings
                    if (wf.Openings_m2 && wf.Openings_ft2) {
                        html.push(`<div style="margin-left:15px;">Actual Area of Unprotected Openings: ${wf.Openings_m2} m² / ${wf.Openings_ft2} ft²</div>`);
                        text.push(`ACTUAL AREA OF UNPROTECTED OPENINGS: ${wf.Openings_m2} m² / ${wf.Openings_ft2} ft²`);
                    }

                    // Percentages
                    if (wf.MaxPctAllowed) {
                        html.push(`<div style="margin-left:15px;">Maximum Percentage Allowed: ${wf.MaxPctAllowed}</div>`);
                        text.push(`MAXIMUM PERCENTAGE ALLOWED: ${wf.MaxPctAllowed}`);
                    }

                    if (wf.ActualPct) {
                        html.push(`<div style="margin-left:15px;">Actual Percentage: ${wf.ActualPct}</div>`);
                        text.push(`ACTUAL PERCENTAGE: ${wf.ActualPct}`);
                    }

                    // Width to Height Ratio
                    if (wf.RatioDisplay && wf.RatioDisplay !== '—') {
                        html.push(`<div style="margin-left:15px;">Width to Height Ratio: ${wf.RatioDisplay}</div>`);
                        text.push(`WIDTH TO HEIGHT RATIO: ${wf.RatioDisplay}`);
                    }

                    // Maximum Individual Opening
                    if (wf.MaxIndivOpen_m2 && wf.MaxIndivOpen_ft2 && 
                        wf.MaxIndivOpen_m2 !== '—' && wf.MaxIndivOpen_ft2 !== '—') {
                        html.push(`<div style="margin-left:15px;">Maximum Area of Individual Openings: ${wf.MaxIndivOpen_m2} m² / ${wf.MaxIndivOpen_ft2} ft²</div>`);
                        text.push(`MAXIMUM AREA OF INDIVIDUAL OPENINGS: ${wf.MaxIndivOpen_m2} m² / ${wf.MaxIndivOpen_ft2} ft²`);
                    }

                    // Sprinkler System Design Standard (only for sprinklered buildings)
                    if (wf.SprinklerStandard && wf.SprinklerStandard !== '—' && wf.SprinklerStandard !== null) {
                        html.push(`<div style="margin-left:15px;">Sprinkler System Design Standard: ${wf.SprinklerStandard}</div>`);
                        text.push(`SPRINKLER SYSTEM DESIGN STANDARD: ${wf.SprinklerStandard}`);
                    }

                    // Fire Resistance Rating
                    console.log('🔍 [DEBUG] Wall Face FRR value:', wf.Frr, 'type:', typeof wf.Frr);
                    if (wf.Frr && wf.Frr !== '—') {
                        html.push(`<div style="margin-left:15px;">Minimum Fire-Resistance Rating: ${wf.Frr}</div>`);
                        text.push(`MINIMUM FIRE-RESISTANCE RATING: ${wf.Frr}`);
                    }

                    // Construction Type
                    if (wf.Conreq && wf.Conreq !== '—') {
                        html.push(`<div style="margin-left:15px;">Type of Construction Required: ${wf.Conreq}</div>`);
                        text.push(`TYPE OF CONSTRUCTION REQUIRED: ${wf.Conreq}`);
                    }

                    // Cladding Type
                    if (wf.Clad && wf.Clad !== '—') {
                        html.push(`<div style="margin-left:15px;">Type of Cladding Required: ${wf.Clad}</div>`);
                        text.push(`TYPE OF CLADDING REQUIRED: ${wf.Clad}`);
                    }

                    // Pass/Fail Result
                    if (wf.PassFail) {
                        const passFailColor = wf.PassFail === 'PASS' ? '#27ae60' : '#e74c3c';
                        html.push(`<div style="margin-left:15px; margin-top:10px; font-weight:bold; color:${passFailColor}; font-size:18px;">Result: ${wf.PassFail}</div>`);
                        text.push(`RESULT: ${wf.PassFail}`);
                    }

                    // Comments
                    if (wf.Comments && wf.Comments.trim() !== '') {
                        html.push(`<div style="margin-left:15px; margin-top:10px;"><strong>Comments:</strong> ${escapeHtml(wf.Comments)}</div>`);
                        text.push(`COMMENTS: ${wf.Comments}`);
                    }

                    html.push('</div>');
                });
            }

            return {
                html: html.join(''),
                text: text.join('\n')
            };

        } catch (error) {
            console.error('❌ Spatial Report generation failed:', error);
            return {
                html: '<p class="placeholder">Error generating Spatial report.</p>',
                text: 'Error generating Spatial report.'
            };
        }
    }

    console.warn('⚠️ Spatial Report: WallFaces array not available');
    return {
        html: '<p class="placeholder">Spatial Calculator not loaded.</p>',
        text: 'Spatial Calculator not loaded.'
    };
}

/**
 * Update visible report based on radio button selection
 */
function updateVisibleReport() {
    const selectedType = document.querySelector('input[name="reportType"]:checked')?.value || 'combined';
    console.log(`📄 updateVisibleReport called, selectedType: ${selectedType}`);

    // Hide all report containers
    const combinedContainer = document.getElementById('combinedReportContainer');
    const unprotectedContainer = document.getElementById('unprotectedReportContainer');
    const spatialContainer = document.getElementById('spatialReportContainer');

    if (combinedContainer) combinedContainer.style.display = 'none';
    if (unprotectedContainer) unprotectedContainer.style.display = 'none';
    if (spatialContainer) spatialContainer.style.display = 'none';

    // Show selected report and update content
    if (selectedType === 'combined') {
        if (combinedContainer) {
            combinedContainer.style.display = 'block';
            const contentEl = document.getElementById('combinedReportContent');
            if (contentEl) {
                contentEl.innerHTML = cachedReports.combined.html || '<p class="placeholder">No data available yet.</p>';
                console.log('✅ Combined report content updated, length:', cachedReports.combined.html.length);
            }
        }
    } else if (selectedType === 'unprotected') {
        if (unprotectedContainer) {
            unprotectedContainer.style.display = 'block';
            const contentEl = document.getElementById('unprotectedReportContent');
            if (contentEl) {
                contentEl.innerHTML = cachedReports.unprotected.html || '<p class="placeholder">No data available yet.</p>';
                console.log('✅ Unprotected report content updated, length:', cachedReports.unprotected.html.length);
            }
        }
    } else if (selectedType === 'spatial') {
        if (spatialContainer) {
            spatialContainer.style.display = 'block';
            const contentEl = document.getElementById('projectReportContent');
            if (contentEl) {
                console.log('📊 Cached spatial report length:', cachedReports.spatial.html.length);
                console.log('📊 First 200 chars:', cachedReports.spatial.html.substring(0, 200));
                contentEl.innerHTML = cachedReports.spatial.html || '<p class="placeholder">No data available yet.</p>';
                console.log('✅ Spatial report content updated from cache');
            } else {
                console.warn('⚠️ projectReportContent element not found for spatial report');
            }
        }
    }

    console.log(`📄 Report switched to: ${selectedType}`);
}

/**
 * Initialize report system (wire radio buttons and export buttons)
 */
function initializeReportSystem() {
    // Wire radio buttons
    document.querySelectorAll('input[name="reportType"]').forEach(radio => {
        radio.addEventListener('change', updateVisibleReport);
    });

    // Wire Copy to Clipboard button
    const copyBtn = document.getElementById('copyReportBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const selectedType = document.querySelector('input[name="reportType"]:checked')?.value || 'combined';
            const reportText = cachedReports[selectedType]?.text || '';

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(reportText).then(() => {
                    showToast('📋 Report copied to clipboard', 'success');
                    console.log('✅ Report copied to clipboard');
                }).catch(() => {
                    fallbackCopyText(reportText);
                });
            } else {
                fallbackCopyText(reportText);
            }
        });
    }

    // Wire Download PDF button
    const pdfBtn = document.getElementById('downloadReportPdfBtn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', () => {
            const selectedType = document.querySelector('input[name="reportType"]:checked')?.value || 'combined';
            const reportText = cachedReports[selectedType]?.text || '';
            const projName = document.getElementById('projName')?.value || 'Project';

            // Delegate to existing PDF generation functions
            if (selectedType === 'unprotected' && window.__bcabd_debug && typeof window.__bcabd_debug.generatePDF === 'function') {
                window.__bcabd_debug.generatePDF();
            } else if (selectedType === 'spatial' && typeof window.generatePDF === 'function') {
                window.generatePDF();
            } else {
                // Generate generic PDF for combined report
                generateGenericPDF(reportText, `${projName}_${selectedType}_Report.pdf`);
            }
        });
    }

    console.log('✅ Report system initialized');
}

/**
 * Fallback text copy method
 */
function fallbackCopyText(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        showToast('📋 Report copied to clipboard', 'success');
    } catch (e) {
        showToast('❌ Failed to copy report', 'error');
    }
    document.body.removeChild(ta);
}

/**
 * Generate generic PDF (fallback for combined report)
 */
function generateGenericPDF(text, filename) {
    // Check if jsPDF is available
    if (!window.jspdf) {
        showToast('⚠️ PDF library not loaded', 'warning');
        console.warn('⚠️ jsPDF not available');
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'letter');
    const lines = text.split('\n');
    const marginLeft = 18;
    const marginRight = 18;
    const marginTop = 18;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const usableWidth = pageWidth - marginLeft - marginRight;
    let y = marginTop;

    lines.forEach(line => {
        const wrapped = pdf.splitTextToSize(line, usableWidth);
        wrapped.forEach(wrappedLine => {
            if (y > 250) {
                pdf.addPage();
                y = marginTop;
            }
            pdf.text(wrappedLine, marginLeft, y);
            y += 6;
        });
    });

    pdf.save(filename);
    showToast('📥 PDF downloaded', 'success');
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Hook into spatial calculator to capture calculation results
 * Updates the link and regenerates reports
 */
function hookSpatialCalculation() {
    // Intercept when wall faces are added to window.WallFaces
    const originalPush = Array.prototype.push;

    // Create a custom observer for window.WallFaces
    let wallFacesProxy = window.WallFaces || [];

    Object.defineProperty(window, 'WallFaces', {
        get: function() {
            return wallFacesProxy;
        },
        set: function(val) {
            wallFacesProxy = val;
            // When WallFaces is updated, check if we need to update links
            updateSpatialLinks();
            generateAllReports();

            // AUTO-SAVE: Save when spatial wall faces change
            setTimeout(() => {
                window.AutoSaveProject();
            }, 500);
        },
        configurable: true
    });

    // Also watch for array mutations
    if (window.WallFaces) {
        const handler = {
            get(target, property) {
                if (property === 'push') {
                    return function(...items) {
                        const result = originalPush.apply(target, items);
                        // After push, update links and regenerate reports
                        setTimeout(() => {
                            updateSpatialLinks();
                            generateAllReports();

                            // AUTO-SAVE: Save when wall face is added via push
                            window.AutoSaveProject();
                        }, 100);
                        return result;
                    };
                }
                return target[property];
            }
        };

        window.WallFaces = new Proxy(window.WallFaces, handler);
    }

    console.log('✅ Spatial calculation hook installed');
}

/**
 * Update spatial links after calculation
 */
function updateSpatialLinks() {
    if (!window.WallFaces || window.WallFaces.length === 0) return;

    // Get the most recent wall face (just added)
    const latestWallFace = window.WallFaces[window.WallFaces.length - 1];
    const wallFaceName = latestWallFace.Name;

    // Check if this wall face has a link
    if (window.spatialWallFaceLinks[wallFaceName]) {
        // Update the spatial data in the link
        window.spatialWallFaceLinks[wallFaceName].spatialWallFaceData = latestWallFace;
        console.log(`✅ Updated spatial link for "${wallFaceName}"`);
    }
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the Combined Calculator on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Combined Calculator initializing...');

    // Initialize tabs
    initializeTabs();

    // Initialize event listeners
    initializeEventListeners();

    // Initialize report system
    initializeReportSystem();

    // Hook into spatial calculator's wall face addition
    hookSpatialCalculation();

    // Set today's date as default
    const todayInput = document.getElementById('projDate');
    if (todayInput) {
        todayInput.valueAsDate = new Date();
    }

    // NOTE: Unit conversion is handled by UnprotectedOpeningsCalculator.js and app.js
    // No dual-unit setup needed in combined-app.js

    // Request project list from C# (will populate window.savedProjects)
    if (typeof window.sendToCSharp === 'function') {
        console.log('📡 Requesting Project List from C#...');
        window.sendToCSharp({
            command: "GET_PROJECT_LIST",
            payload: {}
        });
    } else {
        // If bridge not ready, just show empty list
        window.RenderProjectList();
    }

    console.log('✅ Combined Calculator ready!');
});

// ========================================
// C# Bridge Interface (Works alongside app.js)
// ========================================

/**
 * Extend app.js's receiveFromCSharp to handle PROJECT_LIST updates
 * (app.js already handles CALC_RESULT, this adds project management)
 */
(function() {
    // Save reference to app.js's receiveFromCSharp if it exists
    const originalReceive = window.receiveFromCSharp;

    window.receiveFromCSharp = function(envelope) {
        console.log('📥 C# → JS (combined-app):', envelope.command);

        // Handle PROJECT_LIST command (from C# WebViewBridge)
        if (envelope.command === "PROJECT_LIST") {
            console.log('📂 Received project list from C#');
            window.savedProjects = envelope.payload || {};
            window.RenderProjectList();
            return;
        }

        // Pass all other commands to app.js handler
        if (typeof originalReceive === 'function') {
            originalReceive(envelope);
        }
    };
})();
