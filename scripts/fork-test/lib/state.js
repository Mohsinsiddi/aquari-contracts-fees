/**
 * =============================================================================
 * State Management for Simulation Mode
 * =============================================================================
 */

const fs = require("fs");
const path = require("path");

const STATE_FILE = path.join(__dirname, "../simulation-state.json");

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        }
    } catch (e) {
        console.log("Warning: Could not load state file");
    }
    return {
        deployed: false,
        token: null,
        pair: null,
        foundationWallet: null,
        feesEnabled: false,
    };
}

function saveState(updates) {
    const current = loadState();
    const newState = { ...current, ...updates, lastUpdated: new Date().toISOString() };

    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));
    return newState;
}

function clearState() {
    if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
    }
}

module.exports = {
    loadState,
    saveState,
    clearState,
};
