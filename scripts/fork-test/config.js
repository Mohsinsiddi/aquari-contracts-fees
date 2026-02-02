/**
 * =============================================================================
 * AQUARI Fork Test - Configuration
 * =============================================================================
 *
 * This config is SEPARATE from scripts/config.js.
 * Used only by the fork-test automated test suite (run-all.js).
 *
 * MODES:
 *   --mainnet   Test real AQUARI contract on fork (requires owner key)
 *   --simulate  Deploy fresh AquariTest contract for isolated testing
 *
 * =============================================================================
 */

// Mainnet AQUARI Token (UUPS Proxy Pattern)
const MAINNET = {
    proxy: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
    token: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
    implementation: "0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05",
    pair: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",
    foundationWallet: "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235",
};

// Base network
const BASE = {
    chainId: 8453,
    name: "Base Mainnet",
    weth: "0x4200000000000000000000000000000000000006",
    uniswapV2Router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    uniswapV2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
};

// =============================================================================
// TEST SCENARIOS
// =============================================================================

const SCENARIOS = {
    // Production config - what we'll actually use on mainnet
    production: {
        name: "Production",
        description: "Target mainnet configuration (2.5% total)",
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
        total: 250,
    },

    // Zero fees - verify no fees when both are 0
    zero: {
        name: "Zero Fees",
        description: "Both fees at 0% - no tax should apply",
        burnTax: 0,
        foundationFee: 0,
        total: 0,
    },

    // High fees - stress test
    high: {
        name: "High Fees",
        description: "10% total fees - high but valid",
        burnTax: 500,        // 5%
        foundationFee: 500,  // 5%
        total: 1000,
    },

    // Extreme fees - maximum stress test
    extreme: {
        name: "Extreme Fees",
        description: "50% total fees - maximum stress",
        burnTax: 2500,       // 25%
        foundationFee: 2500, // 25%
        total: 5000,
    },

    // Burn only
    burnOnly: {
        name: "Burn Only",
        description: "Only burn tax, no foundation fee",
        burnTax: 250,        // 2.5%
        foundationFee: 0,
        total: 250,
    },

    // Foundation only
    foundationOnly: {
        name: "Foundation Only",
        description: "Only foundation fee, no burn",
        burnTax: 0,
        foundationFee: 250,  // 2.5%
        total: 250,
    },
};

// Default scenario for tests
const TARGET_FEES = SCENARIOS.production;

// Test parameters
const TEST_PARAMS = {
    buyAmount: "0.001",          // ETH to spend on buy test
    sellAmount: "100",           // Tokens to sell on sell test
    transferAmount: "1000",      // Tokens for transfer tests
    lpTokenAmount: "10000",      // Tokens for LP (simulation)
    lpEthAmount: "0.01",         // ETH for LP (simulation)
    feeTolerance: 5,             // 5 bps (0.05%) tolerance for fee accuracy
    minEthBalance: "0.01",       // Minimum ETH balance required
};

// ABIs
const ABIS = {
    token: [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function owner() view returns (address)",
        "function burnTax() view returns (uint256)",
        "function foundationFee() view returns (uint256)",
        "function foundationWallet() view returns (address)",
        "function uniswapV2Pair() view returns (address)",
        "function pairIsSet() view returns (bool)",
        "function tradingEnabled() view returns (bool)",
        "function paused() view returns (bool)",
        "function isExcludedFromTax(address) view returns (bool)",
        "function getExcludedAddresses() view returns (address[])",
        "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee)",
        "function setUniswapV2Pair(address newPairAddress)",
        "function setFoundationWallet(address newWallet)",
        "function excludeFromTax(address account)",
        "function includeInTax(address account)",
        "function approve(address spender, uint256 amount) returns (bool)",
        "function transfer(address to, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
    ],
    router: [
        "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
        "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
        "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
        "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
        "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
    ],
    factory: [
        "function getPair(address tokenA, address tokenB) view returns (address)",
        "function createPair(address tokenA, address tokenB) returns (address)",
    ],
    pair: [
        "function getReserves() view returns (uint112, uint112, uint32)",
        "function token0() view returns (address)",
        "function token1() view returns (address)",
    ],
};

// =============================================================================
// TEST DEFINITIONS
// =============================================================================

const TESTS = {
    // Pre-flight checks
    PF01: { id: "PF01", name: "Fork is running", category: "preflight", severity: "CRITICAL" },
    PF02: { id: "PF02", name: "Network is Base fork", category: "preflight", severity: "CRITICAL" },
    PF03: { id: "PF03", name: "Signer has sufficient ETH", category: "preflight", severity: "CRITICAL" },
    PF04: { id: "PF04", name: "Contract is not paused", category: "preflight", severity: "HIGH" },
    PF05: { id: "PF05", name: "Trading is enabled", category: "preflight", severity: "HIGH" },

    // Owner & Access Control
    T01: { id: "T01", name: "Owner validation", category: "access", severity: "CRITICAL" },
    T02: { id: "T02", name: "pairIsSet is false initially", category: "state", severity: "CRITICAL" },
    T03: { id: "T03", name: "Pair address matches factory", category: "state", severity: "CRITICAL" },

    // Security - Non-owner access
    S01: { id: "S01", name: "Non-owner cannot setTaxConfig", category: "security", severity: "CRITICAL" },
    S02: { id: "S02", name: "Non-owner cannot setUniswapV2Pair", category: "security", severity: "CRITICAL" },
    S03: { id: "S03", name: "Non-owner cannot setFoundationWallet", category: "security", severity: "CRITICAL" },

    // Fee Configuration
    T04: { id: "T04", name: "setTaxConfig succeeds", category: "config", severity: "HIGH" },
    T05: { id: "T05", name: "setUniswapV2Pair is one-time", category: "config", severity: "CRITICAL" },
    T05b: { id: "T05b", name: "Second setUniswapV2Pair reverts", category: "config", severity: "CRITICAL" },

    // Trading Tests
    T06: { id: "T06", name: "Buy applies fees", category: "trading", severity: "HIGH" },
    T07: { id: "T07", name: "Sell applies fees", category: "trading", severity: "HIGH" },
    T08: { id: "T08", name: "Fee math accuracy (buy)", category: "trading", severity: "HIGH" },
    T08b: { id: "T08b", name: "Fee math accuracy (sell)", category: "trading", severity: "HIGH" },
    T09: { id: "T09", name: "Regular swap fails for sell", category: "trading", severity: "MEDIUM" },

    // State Verification
    T10: { id: "T10", name: "Total supply decreases (burn)", category: "state", severity: "MEDIUM" },
    T11: { id: "T11", name: "Foundation wallet receives tokens", category: "state", severity: "HIGH" },

    // Exclusion Tests
    T12: { id: "T12", name: "Excluded address skips fees", category: "exclusion", severity: "MEDIUM" },
    T13: { id: "T13", name: "Owner transfer skips fees", category: "exclusion", severity: "MEDIUM" },

    // Edge Cases - Zero Fees
    E01: { id: "E01", name: "Zero fees - no tax applied", category: "edge", severity: "MEDIUM" },
    E02: { id: "E02", name: "Zero fees - full amount received", category: "edge", severity: "MEDIUM" },

    // Edge Cases - High Fees
    E03: { id: "E03", name: "High fees - correctly applied", category: "edge", severity: "MEDIUM" },
    E04: { id: "E04", name: "Extreme fees - correctly applied", category: "edge", severity: "LOW" },

    // Admin Functions After Enable
    A01: { id: "A01", name: "Can change tax config after enable", category: "admin", severity: "HIGH" },
    A02: { id: "A02", name: "Can change foundation wallet after enable", category: "admin", severity: "HIGH" },

    // Gas Tracking
    G01: { id: "G01", name: "Gas cost - setTaxConfig", category: "gas", severity: "INFO" },
    G02: { id: "G02", name: "Gas cost - setUniswapV2Pair", category: "gas", severity: "INFO" },
    G03: { id: "G03", name: "Gas cost - buy swap", category: "gas", severity: "INFO" },
    G04: { id: "G04", name: "Gas cost - sell swap", category: "gas", severity: "INFO" },
};

// Test categories for grouping
const TEST_CATEGORIES = {
    preflight: "Pre-Flight Checks",
    access: "Owner & Access Control",
    security: "Security Validations",
    config: "Fee Configuration",
    trading: "Trading Tests",
    state: "State Verification",
    exclusion: "Exclusion Tests",
    edge: "Edge Cases",
    admin: "Admin Functions",
    gas: "Gas Tracking",
};

module.exports = {
    MAINNET,
    BASE,
    SCENARIOS,
    TARGET_FEES,
    TEST_PARAMS,
    ABIS,
    TESTS,
    TEST_CATEGORIES,
};
