/**
 * =============================================================================
 * AQUARI TEST TOKEN - CONFIGURATION
 * =============================================================================
 */

const fs = require("fs");
const path = require("path");

// =============================================================================
// BASE MAINNET ADDRESSES
// =============================================================================
const BASE = {
    chainId: 8453,
    weth: "0x4200000000000000000000000000000000000006",
    uniswapV2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    uniswapV2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
};

// =============================================================================
// TEST TOKEN CONFIGURATION
// =============================================================================
const CONFIG = {
    // Liquidity settings
    liquidityETH: "0.01",           // 0.01 ETH
    liquidityTokens: "1000000",     // 1 Million tokens

    // New foundation wallet (user provided)
    newFoundationWallet: "0x802D8097eC1D49808F3c2c866020442891adde57",

    // Tax config (same as mainnet AQUARI)
    taxConfig: {
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
};

// =============================================================================
// STATE FILE
// =============================================================================
const STATE_FILE = path.join(__dirname, "state.json");

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
        proxy: null,
        implementation: null,
        owner: null,
        pair: null,
        lpAdded: false,
        feesEnabled: false,
        deployedAt: null,
    };
}

function saveState(state) {
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`\n  State saved to: ${STATE_FILE}`);
}

// =============================================================================
// COLORS
// =============================================================================
const c = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

const fmt = {
    success: (s) => `${c.bright}${c.green}${s}${c.reset}`,
    fail: (s) => `${c.bright}${c.red}${s}${c.reset}`,
    warn: (s) => `${c.bright}${c.yellow}${s}${c.reset}`,
    info: (s) => `${c.blue}${s}${c.reset}`,
    num: (s) => `${c.bright}${c.yellow}${s}${c.reset}`,
    addr: (s) => `${c.dim}${s}${c.reset}`,
};

function printBox(title, color = c.cyan) {
    const line = "═".repeat(70);
    console.log(`\n${color}╔${line}╗${c.reset}`);
    console.log(`${color}║${c.reset}${c.bright} ${title.padEnd(68)} ${color}║${c.reset}`);
    console.log(`${color}╚${line}╝${c.reset}`);
}

function printSection(title) {
    console.log(`\n${c.bright}${c.cyan}▶ ${title}${c.reset}`);
    console.log(`${c.dim}${"─".repeat(50)}${c.reset}`);
}

module.exports = {
    BASE,
    CONFIG,
    loadState,
    saveState,
    c,
    fmt,
    printBox,
    printSection,
};
