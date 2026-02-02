/**
 * =============================================================================
 * AQUARI FEE ENABLEMENT - CONFIGURATION
 * =============================================================================
 *
 * FOLDER STRUCTURE:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   scripts/
 *   ├── config.js              # THIS FILE - config for simulation & mainnet
 *   ├── simulation/            # Step-by-step SCRIPTED testing (isolated)
 *   │   └── 0_deploy → 6_verify (run in order, scripted trades)
 *   ├── mainnet-execution/     # PRODUCTION scripts (real mainnet!)
 *   │   └── 1_verify → 4_verify (run in order, careful!)
 *   └── fork-test/             # AUTOMATED test suite (separate config)
 *       └── run-all.js --mainnet | --simulate
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️  DISCLAIMER ⚠️
 * ─────────────────────────────────────────────────────────────────────────────
 * These scripts interact with smart contracts on blockchain.
 *
 * BEFORE RUNNING ANY SCRIPT:
 * 1. Make sure you are the CONTRACT OWNER or have ADMIN ACCESS
 * 2. Verify you have the correct private key in .env file
 * 3. For MAINNET: Triple-verify all addresses before executing
 * 4. setUniswapV2Pair() is IRREVERSIBLE - cannot be undone!
 *
 * If you are NOT the owner, transactions will FAIL.
 * If you set WRONG pair address, fees will NEVER work.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

// =============================================================================
// MODE SELECTION - Change this to switch between simulation and mainnet
// =============================================================================

const MODE = "simulation";  // Options: "simulation" | "mainnet"

// =============================================================================
// SIMULATION SELECTION - Which test scenario to run (1-5)
// =============================================================================

const ACTIVE_SIMULATION = 1;  // Options: 1, 2, 3, 4, 5

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

const NETWORKS = {
    base: {
        chainId: 8453,
        name: "Base Mainnet",
        rpc: "https://base-mainnet.public.blastapi.io",
        explorer: "https://basescan.org",
        weth: "0x4200000000000000000000000000000000000006",
        uniswapV2: {
            factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
            router: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
        }
    }
};

// =============================================================================
// MAINNET CONFIGURATION (Real AQUARI Token)
// =============================================================================

const MAINNET = {
    token: {
        address: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
        name: "Aquari",
        symbol: "AQUARI",
        implementation: "0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05",
    },
    pair: {
        address: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",
    },
    owner: "0x187ED96248Bbbbf4D5b059187e030B7511b67801",
    foundationWallet: "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235",
    taxConfig: {
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
};

// =============================================================================
// SIMULATION SCENARIOS
// =============================================================================

const SIMULATIONS = {
    1: {
        name: "AquariSim1",
        symbol: "AQSIM1",
        purpose: "Baseline - correct setup",
        description: "Test the correct workflow: deploy → LP → set fees → set pair → trade",
        taxConfig: { burnTax: 125, foundationFee: 125 },  // 2.5% total
    },
    2: {
        name: "AquariSim2",
        symbol: "AQSIM2",
        purpose: "Wrong pair address test",
        description: "Set a WRONG pair address to see what happens (fees won't apply)",
        taxConfig: { burnTax: 125, foundationFee: 125 },
        useWrongPair: true,  // Flag to use wrong pair in script
    },
    3: {
        name: "AquariSim3",
        symbol: "AQSIM3",
        purpose: "Wrong order test (pair before fees)",
        description: "Set pair FIRST, then configure fees - verify it still works",
        taxConfig: { burnTax: 125, foundationFee: 125 },
    },
    4: {
        name: "AquariSim4",
        symbol: "AQSIM4",
        purpose: "High fees test (50%)",
        description: "Test with extreme 50% fees to verify slippage handling",
        taxConfig: { burnTax: 2500, foundationFee: 2500 },  // 50% total!
    },
    5: {
        name: "AquariSim5",
        symbol: "AQSIM5",
        purpose: "Final rehearsal",
        description: "Exact replica of mainnet AQUARI fee enablement",
        taxConfig: { burnTax: 125, foundationFee: 125 },
    },
};

// =============================================================================
// STATE FILE - Stores deployed addresses per simulation
// =============================================================================

const STATE_FILE = path.join(__dirname, "../deployments/simulation_state.json");

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        }
    } catch (e) {
        console.log("Warning: Could not load state file, starting fresh");
    }
    return {
        simulations: {
            1: { token: "", pair: "", deployed: false, lpAdded: false, feesEnabled: false },
            2: { token: "", pair: "", deployed: false, lpAdded: false, feesEnabled: false },
            3: { token: "", pair: "", deployed: false, lpAdded: false, feesEnabled: false },
            4: { token: "", pair: "", deployed: false, lpAdded: false, feesEnabled: false },
            5: { token: "", pair: "", deployed: false, lpAdded: false, feesEnabled: false },
        },
        lastUpdated: null,
    };
}

function saveState(state) {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getSimulationState(simId) {
    const state = loadState();
    return state.simulations[simId] || {};
}

function updateSimulationState(simId, updates) {
    const state = loadState();
    state.simulations[simId] = { ...state.simulations[simId], ...updates };
    saveState(state);
    return state.simulations[simId];
}

// =============================================================================
// GET ACTIVE CONFIGURATION
// =============================================================================

function getConfig() {
    const network = NETWORKS.base;

    if (MODE === "mainnet") {
        return {
            mode: "mainnet",
            network,
            token: MAINNET.token.address,
            tokenName: MAINNET.token.name,
            tokenSymbol: MAINNET.token.symbol,
            pair: MAINNET.pair.address,
            foundationWallet: MAINNET.foundationWallet,
            taxConfig: MAINNET.taxConfig,
            isMainnet: true,
        };
    } else {
        const simId = ACTIVE_SIMULATION;
        const simConfig = SIMULATIONS[simId];
        const simState = getSimulationState(simId);

        return {
            mode: "simulation",
            simId,
            network,
            contractName: simConfig.name,
            tokenName: simConfig.name,
            tokenSymbol: simConfig.symbol,
            purpose: simConfig.purpose,
            description: simConfig.description,
            token: simState.token || "",
            pair: simState.pair || "",
            deployed: simState.deployed || false,
            lpAdded: simState.lpAdded || false,
            feesEnabled: simState.feesEnabled || false,
            foundationWallet: "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235",
            taxConfig: simConfig.taxConfig,
            useWrongPair: simConfig.useWrongPair || false,
            isMainnet: false,
        };
    }
}

// =============================================================================
// LIQUIDITY CONFIGURATION
// =============================================================================

const LIQUIDITY = {
    tokenAmount: "10000",  // 10,000 tokens
    ethAmount: "0.01",     // 0.01 ETH
};

// =============================================================================
// HELPERS
// =============================================================================

function printDisclaimer() {
    console.log("");
    console.log("═".repeat(70));
    console.log("⚠️  DISCLAIMER");
    console.log("═".repeat(70));
    console.log("");
    console.log("  Before running this script, ensure:");
    console.log("  1. You are the CONTRACT OWNER or have ADMIN ACCESS");
    console.log("  2. Your private key is correctly set in .env file");
    console.log("  3. You have verified all addresses");
    console.log("");
    if (MODE === "mainnet") {
        console.log("  🔴 MODE: MAINNET - Real transactions, real money!");
        console.log("  🔴 setUniswapV2Pair() is IRREVERSIBLE!");
    } else {
        console.log("  🟢 MODE: SIMULATION #" + ACTIVE_SIMULATION);
        console.log("  🟢 " + SIMULATIONS[ACTIVE_SIMULATION].purpose);
    }
    console.log("");
    console.log("═".repeat(70));
    console.log("");
}

function printConfig() {
    const config = getConfig();
    console.log("─".repeat(70));
    console.log("CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Mode:              ${config.mode.toUpperCase()}`);
    if (!config.isMainnet) {
        console.log(`Simulation:        #${config.simId} - ${config.purpose}`);
    }
    console.log(`Network:           ${config.network.name}`);
    console.log(`Token:             ${config.tokenName} (${config.tokenSymbol})`);
    console.log(`Token Address:     ${config.token || "(not deployed yet)"}`);
    console.log(`Pair Address:      ${config.pair || "(not created yet)"}`);
    console.log(`Foundation Wallet: ${config.foundationWallet}`);
    console.log(`Burn Tax:          ${config.taxConfig.burnTax} bps (${config.taxConfig.burnTax/100}%)`);
    console.log(`Foundation Fee:    ${config.taxConfig.foundationFee} bps (${config.taxConfig.foundationFee/100}%)`);
    if (!config.isMainnet) {
        console.log(`Deployed:          ${config.deployed ? "✅" : "❌"}`);
        console.log(`LP Added:          ${config.lpAdded ? "✅" : "❌"}`);
        console.log(`Fees Enabled:      ${config.feesEnabled ? "✅" : "❌"}`);
    }
    console.log("─".repeat(70));
}

function printAllSimulations() {
    const state = loadState();
    console.log("─".repeat(70));
    console.log("ALL SIMULATIONS STATUS");
    console.log("─".repeat(70));
    console.log("");
    for (let i = 1; i <= 5; i++) {
        const sim = SIMULATIONS[i];
        const s = state.simulations[i];
        const active = i === ACTIVE_SIMULATION ? " ◄── ACTIVE" : "";
        console.log(`  #${i} ${sim.symbol} - ${sim.purpose}${active}`);
        console.log(`     Token: ${s.token || "(not deployed)"}`);
        console.log(`     Pair:  ${s.pair || "(not created)"}`);
        console.log(`     State: ${s.deployed ? "✅ Deployed" : "❌"} ${s.lpAdded ? "✅ LP" : "❌"} ${s.feesEnabled ? "✅ Fees" : "❌"}`);
        console.log("");
    }
    console.log("─".repeat(70));
}

async function verifyOwner(contract, signer) {
    const owner = await contract.owner();
    const signerAddress = await signer.getAddress();

    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        console.log("");
        console.log("❌ ERROR: You are NOT the owner of this contract!");
        console.log(`   Contract Owner: ${owner}`);
        console.log(`   Your Address:   ${signerAddress}`);
        console.log("");
        console.log("   You need admin access to run this script.");
        console.log("");
        process.exit(1);
    }

    console.log(`✅ Owner verified: ${signerAddress}`);
    return true;
}

/**
 * Get a signer that works on both fork (impersonation) and mainnet (real key)
 * @param {object} hre - Hardhat Runtime Environment
 * @returns {Promise<{signer: Signer, isFork: boolean}>}
 */
async function getMainnetSigner(hre) {
    const networkName = hre.network.name;
    const isFork = networkName === "fork";

    if (isFork) {
        // On fork: impersonate the real mainnet owner
        const ownerAddress = MAINNET.owner;

        console.log("─".repeat(70));
        console.log("🔵 FORK MODE - Impersonating Owner");
        console.log("─".repeat(70));
        console.log(`Owner Address: ${ownerAddress}`);

        // Anvil impersonation
        await hre.network.provider.request({
            method: "anvil_impersonateAccount",
            params: [ownerAddress]
        });

        // Fund with ETH for gas
        await hre.network.provider.request({
            method: "anvil_setBalance",
            params: [ownerAddress, "0x8AC7230489E80000"] // 10 ETH
        });

        const signer = await hre.ethers.getImpersonatedSigner(ownerAddress);
        console.log(`Impersonated: ${await signer.getAddress()}`);
        console.log(`Funded with 10 ETH for gas`);
        console.log("");

        return { signer, isFork: true };
    } else {
        // On mainnet: use real signer from private key
        const [signer] = await hre.ethers.getSigners();
        return { signer, isFork: false };
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    MODE,
    ACTIVE_SIMULATION,
    NETWORKS,
    MAINNET,
    SIMULATIONS,
    LIQUIDITY,
    getConfig,
    loadState,
    saveState,
    getSimulationState,
    updateSimulationState,
    printDisclaimer,
    printConfig,
    printAllSimulations,
    verifyOwner,
    getMainnetSigner,
};
