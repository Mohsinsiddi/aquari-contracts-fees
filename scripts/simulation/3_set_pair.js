/**
 * =============================================================================
 * SIMULATION STEP 3: Set Pair Address (ENABLES FEES)
 * =============================================================================
 *
 * ⚠️  WARNING: THIS IS IRREVERSIBLE! ⚠️
 *
 * Sets the Uniswap V2 pair address, which ENABLES fees on trades.
 * For Simulation #2, intentionally uses WRONG pair to test behavior.
 *
 * PREVIOUS: 2_set_tax_config.js
 * NEXT: 4_test_buy.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    SIMULATIONS,
    NETWORKS,
    getConfig,
    updateSimulationState,
    printDisclaimer,
    printAllSimulations,
    verifyOwner,
} = require("../config");

const TOKEN_ABI = [
    "function owner() view returns (address)",
    "function setUniswapV2Pair(address newPairAddress)",
    "function uniswapV2Pair() view returns (address)",
    "function pairIsSet() view returns (bool)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 3: SET PAIR ADDRESS (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");
    console.log("⚠️  WARNING: THIS ACTION IS IRREVERSIBLE!");
    console.log("");

    const config = getConfig();
    const simConfig = SIMULATIONS[ACTIVE_SIMULATION];
    const network = NETWORKS.base;

    // Check prerequisites
    if (!config.deployed || !config.token) {
        console.log("❌ Error: Token not deployed. Run 0_deploy.js first.");
        process.exit(1);
    }

    if (!config.lpAdded || !config.pair) {
        console.log("❌ Error: LP not added. Run 1_add_liquidity.js first.");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    const token = new ethers.Contract(config.token, TOKEN_ABI, deployer);
    const factory = new ethers.Contract(network.uniswapV2.factory, FACTORY_ABI, deployer);

    const tokenName = await token.name();

    console.log(`Token:       ${tokenName}`);
    console.log(`Address:     ${config.token}`);
    console.log("");

    // Verify owner
    await verifyOwner(token, deployer);
    console.log("");

    // Check pairIsSet
    const pairIsSet = await token.pairIsSet();
    if (pairIsSet) {
        console.log("❌ Error: Pair is ALREADY set! Cannot change.");
        console.log(`   Current pair: ${await token.uniswapV2Pair()}`);
        process.exit(1);
    }
    console.log("✅ pairIsSet is false - can proceed");
    console.log("");

    // Get correct pair from factory
    const factoryPair = await factory.getPair(config.token, network.weth);

    // Determine which pair to set
    let pairToSet = factoryPair;

    // For Sim2 (wrong pair test), use a wrong address
    if (config.useWrongPair || ACTIVE_SIMULATION === 2) {
        pairToSet = "0x0000000000000000000000000000000000000001"; // Wrong address!
        console.log("⚠️  SIMULATION #2: Using WRONG pair address intentionally!");
        console.log("   This tests what happens when wrong pair is set.");
        console.log("");
    }

    console.log("─".repeat(70));
    console.log("PAIR VERIFICATION");
    console.log("─".repeat(70));
    console.log(`Factory Pair:  ${factoryPair}`);
    console.log(`State Pair:    ${config.pair}`);
    console.log(`Setting Pair:  ${pairToSet}`);
    console.log(`Correct:       ${factoryPair === pairToSet ? "✅ YES" : "❌ NO (intentional for test)"}`);
    console.log("");

    // Current tax config
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();

    console.log("─".repeat(70));
    console.log("TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`burnTax:       ${burnTax} (${Number(burnTax)/100}%)`);
    console.log(`foundationFee: ${foundationFee} (${Number(foundationFee)/100}%)`);
    console.log(`Total:         ${Number(burnTax) + Number(foundationFee)} bps`);
    console.log("");

    // Set pair
    console.log("Setting pair address...");
    const tx = await token.setUniswapV2Pair(pairToSet);
    await tx.wait();
    console.log("✅ Pair address set!");
    console.log("");

    // Verify
    console.log("─".repeat(70));
    console.log("VERIFICATION");
    console.log("─".repeat(70));
    const newPairIsSet = await token.pairIsSet();
    const storedPair = await token.uniswapV2Pair();

    console.log(`pairIsSet:     ${newPairIsSet}`);
    console.log(`uniswapV2Pair: ${storedPair}`);
    console.log("");

    // Update state
    updateSimulationState(ACTIVE_SIMULATION, {
        feesEnabled: newPairIsSet,
        pairSet: storedPair,
        feesEnabledAt: new Date().toISOString(),
        usedWrongPair: pairToSet !== factoryPair,
    });

    if (newPairIsSet) {
        if (pairToSet === factoryPair) {
            console.log("🎉 FEES ARE NOW ENABLED!");
        } else {
            console.log("⚠️  Pair set but it's WRONG - fees won't apply to real trades!");
        }
    }
    console.log("");

    printAllSimulations();

    console.log("═".repeat(70));
    console.log("✅ STEP 3 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("NEXT: Run 4_test_buy.js to test buying tokens");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
