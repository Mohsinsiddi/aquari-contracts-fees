/**
 * =============================================================================
 * SIMULATION STEP 2: Set Tax Configuration
 * =============================================================================
 *
 * Sets the burn tax and foundation fee.
 * NOTE: This CAN be changed later! Only setUniswapV2Pair is irreversible.
 *
 * PREVIOUS: 1_add_liquidity.js
 * NEXT: 3_set_pair.js (enables fees - IRREVERSIBLE)
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    SIMULATIONS,
    getConfig,
    updateSimulationState,
    printDisclaimer,
    printAllSimulations,
    verifyOwner,
} = require("../config");

const TOKEN_ABI = [
    "function owner() view returns (address)",
    "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function pairIsSet() view returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 2: SET TAX CONFIG (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const simConfig = SIMULATIONS[ACTIVE_SIMULATION];

    // Check prerequisites
    if (!config.deployed || !config.token) {
        console.log("❌ Error: Token not deployed yet. Run 0_deploy.js first.");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    const token = new ethers.Contract(config.token, TOKEN_ABI, deployer);

    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();

    console.log(`Token:       ${tokenName} (${tokenSymbol})`);
    console.log(`Address:     ${config.token}`);
    console.log("");

    // Verify owner
    await verifyOwner(token, deployer);
    console.log("");

    // Current state
    console.log("─".repeat(70));
    console.log("CURRENT STATE");
    console.log("─".repeat(70));
    const currentBurnTax = await token.burnTax();
    const currentFoundFee = await token.foundationFee();
    const pairIsSet = await token.pairIsSet();

    console.log(`burnTax:       ${currentBurnTax} (${Number(currentBurnTax)/100}%)`);
    console.log(`foundationFee: ${currentFoundFee} (${Number(currentFoundFee)/100}%)`);
    console.log(`pairIsSet:     ${pairIsSet}`);
    console.log("");

    // New configuration from simulation config
    const newTaxConfig = simConfig.taxConfig;

    console.log("─".repeat(70));
    console.log("NEW CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`burnTax:       ${newTaxConfig.burnTax} (${newTaxConfig.burnTax/100}%)`);
    console.log(`foundationFee: ${newTaxConfig.foundationFee} (${newTaxConfig.foundationFee/100}%)`);
    console.log(`Total:         ${newTaxConfig.burnTax + newTaxConfig.foundationFee} (${(newTaxConfig.burnTax + newTaxConfig.foundationFee)/100}%)`);
    console.log("");

    // Set tax config
    console.log("Setting tax configuration...");
    const tx = await token.setTaxConfig(newTaxConfig.burnTax, newTaxConfig.foundationFee);
    await tx.wait();
    console.log("✅ Tax configuration set!");
    console.log("");

    // Verify
    console.log("─".repeat(70));
    console.log("VERIFICATION");
    console.log("─".repeat(70));
    const newBurnTax = await token.burnTax();
    const newFoundFee = await token.foundationFee();

    console.log(`burnTax:       ${newBurnTax} (${Number(newBurnTax)/100}%)`);
    console.log(`foundationFee: ${newFoundFee} (${Number(newFoundFee)/100}%)`);
    console.log(`Total:         ${Number(newBurnTax) + Number(newFoundFee)} bps`);
    console.log("");

    // Update state
    updateSimulationState(ACTIVE_SIMULATION, {
        taxConfigSet: true,
        taxConfig: {
            burnTax: Number(newBurnTax),
            foundationFee: Number(newFoundFee),
        },
        taxConfigSetAt: new Date().toISOString(),
    });

    printAllSimulations();

    console.log("═".repeat(70));
    console.log("✅ STEP 2 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("NOTE: Tax config can be changed anytime with setTaxConfig()");
    console.log("");
    console.log("NEXT: Run 3_set_pair.js to enable fees (⚠️ IRREVERSIBLE)");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
