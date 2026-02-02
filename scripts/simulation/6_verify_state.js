/**
 * =============================================================================
 * SIMULATION STEP 6: Verify Final State
 * =============================================================================
 *
 * Verifies the complete state after all steps.
 * Shows summary of what happened during simulation.
 *
 * PREVIOUS: 5_test_sell.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    SIMULATIONS,
    NETWORKS,
    getConfig,
    loadState,
    printDisclaimer,
    printAllSimulations,
} = require("../config");

const TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function owner() view returns (address)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function uniswapV2Pair() view returns (address)",
    "function pairIsSet() view returns (bool)",
    "function tradingEnabled() view returns (bool)"
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 6: VERIFY FINAL STATE (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const simConfig = SIMULATIONS[ACTIVE_SIMULATION];
    const network = NETWORKS.base;

    if (!config.token) {
        console.log("❌ No token deployed for this simulation.");
        console.log("");
        printAllSimulations();
        return;
    }

    const [signer] = await ethers.getSigners();
    const token = new ethers.Contract(config.token, TOKEN_ABI, signer);

    // Token Info
    console.log("─".repeat(70));
    console.log("TOKEN INFO");
    console.log("─".repeat(70));
    console.log(`Address:      ${config.token}`);
    console.log(`Name:         ${await token.name()}`);
    console.log(`Symbol:       ${await token.symbol()}`);
    console.log(`Total Supply: ${ethers.formatEther(await token.totalSupply())}`);
    console.log(`Owner:        ${await token.owner()}`);
    console.log("");

    // Tax Config
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();

    console.log("─".repeat(70));
    console.log("TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Burn Tax:         ${burnTax} bps (${Number(burnTax)/100}%)`);
    console.log(`Foundation Fee:   ${foundationFee} bps (${Number(foundationFee)/100}%)`);
    console.log(`Total Tax:        ${Number(burnTax) + Number(foundationFee)} bps`);
    console.log(`Foundation Wallet: ${foundationWallet}`);
    console.log("");

    // Pair Status
    const pairIsSet = await token.pairIsSet();
    const storedPair = await token.uniswapV2Pair();

    console.log("─".repeat(70));
    console.log("PAIR STATUS");
    console.log("─".repeat(70));
    console.log(`pairIsSet:     ${pairIsSet} ${pairIsSet ? "✅ FEES ENABLED" : "❌ FEES NOT ENABLED"}`);
    console.log(`Stored Pair:   ${storedPair}`);
    console.log(`Expected Pair: ${config.pair}`);

    if (config.pair && storedPair.toLowerCase() !== config.pair.toLowerCase()) {
        console.log(`Match:         ❌ WRONG PAIR SET`);
    }
    console.log("");

    // Pair Reserves
    if (config.pair) {
        try {
            const pair = new ethers.Contract(config.pair, PAIR_ABI, signer);
            const reserves = await pair.getReserves();
            const token0 = await pair.token0();
            const isToken0 = token0.toLowerCase() === config.token.toLowerCase();
            const tokenReserve = isToken0 ? reserves[0] : reserves[1];
            const ethReserve = isToken0 ? reserves[1] : reserves[0];

            console.log("─".repeat(70));
            console.log("LIQUIDITY");
            console.log("─".repeat(70));
            console.log(`Token Reserve: ${ethers.formatEther(tokenReserve)}`);
            console.log(`ETH Reserve:   ${ethers.formatEther(ethReserve)} ETH`);
            console.log("");
        } catch {}
    }

    // Balances
    console.log("─".repeat(70));
    console.log("KEY BALANCES");
    console.log("─".repeat(70));
    console.log(`Owner:      ${ethers.formatEther(await token.balanceOf(await token.owner()))}`);
    console.log(`Foundation: ${ethers.formatEther(await token.balanceOf(foundationWallet))}`);
    console.log("");

    // Summary
    console.log("═".repeat(70));
    console.log("SIMULATION SUMMARY");
    console.log("═".repeat(70));
    console.log("");
    console.log(`Simulation:  #${ACTIVE_SIMULATION} - ${simConfig.purpose}`);
    console.log(`Description: ${simConfig.description}`);
    console.log("");

    if (pairIsSet) {
        const correctPair = config.pair && storedPair.toLowerCase() === config.pair.toLowerCase();
        if (correctPair) {
            console.log("✅ RESULT: Fees enabled with CORRECT pair");
            console.log(`   - ${Number(burnTax)/100}% burned on trades`);
            console.log(`   - ${Number(foundationFee)/100}% to foundation on trades`);
        } else {
            console.log("⚠️  RESULT: Fees enabled with WRONG pair");
            console.log("   - Fees will NOT apply to real Uniswap trades");
            console.log("   - This demonstrates the danger of wrong pair address");
        }
    } else {
        console.log("❌ RESULT: Fees NOT enabled (pairIsSet = false)");
    }
    console.log("");

    printAllSimulations();

    console.log("═".repeat(70));
    console.log("✅ SIMULATION COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("To run another simulation:");
    console.log("  1. Edit config.js: ACTIVE_SIMULATION = 2 (or 3, 4, 5)");
    console.log("  2. Run scripts 0-6 again");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
