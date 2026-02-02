/**
 * =============================================================================
 * SIMULATION STATUS: View All Simulations
 * =============================================================================
 *
 * Shows the status of all 5 simulations and their current state.
 * Use this to see which simulations are deployed, have LP, have fees enabled.
 *
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    SIMULATIONS,
    NETWORKS,
    loadState,
    printDisclaimer,
    printAllSimulations,
} = require("../config");

const TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function pairIsSet() view returns (bool)",
    "function uniswapV2Pair() view returns (address)"
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)"
];

async function main() {
    console.log("");
    console.log("═".repeat(70));
    console.log("SIMULATION STATUS");
    console.log("═".repeat(70));
    console.log("");
    console.log(`Active Simulation: #${ACTIVE_SIMULATION} - ${SIMULATIONS[ACTIVE_SIMULATION].purpose}`);
    console.log("");

    printAllSimulations();

    const state = loadState();
    const [signer] = await ethers.getSigners();
    const network = NETWORKS.base;

    // Show detailed info for active simulation
    const activeState = state.simulations[ACTIVE_SIMULATION];

    if (activeState.token) {
        console.log("─".repeat(70));
        console.log(`ACTIVE SIMULATION #${ACTIVE_SIMULATION} DETAILS`);
        console.log("─".repeat(70));
        console.log("");

        try {
            const token = new ethers.Contract(activeState.token, TOKEN_ABI, signer);

            console.log(`Token Address:    ${activeState.token}`);
            console.log(`Name:             ${await token.name()}`);
            console.log(`Symbol:           ${await token.symbol()}`);
            console.log(`Total Supply:     ${ethers.formatEther(await token.totalSupply())}`);
            console.log("");

            const burnTax = await token.burnTax();
            const foundationFee = await token.foundationFee();
            const pairIsSet = await token.pairIsSet();
            const storedPair = await token.uniswapV2Pair();

            console.log(`Burn Tax:         ${burnTax} bps (${Number(burnTax)/100}%)`);
            console.log(`Foundation Fee:   ${foundationFee} bps (${Number(foundationFee)/100}%)`);
            console.log(`Foundation Wallet: ${await token.foundationWallet()}`);
            console.log("");
            console.log(`pairIsSet:        ${pairIsSet} ${pairIsSet ? "✅ FEES ENABLED" : "❌ FEES NOT ENABLED"}`);
            console.log(`Stored Pair:      ${storedPair}`);
            console.log(`State Pair:       ${activeState.pair || "(not recorded)"}`);
            console.log("");

            if (activeState.pair && activeState.pair !== ethers.ZeroAddress) {
                try {
                    const pair = new ethers.Contract(activeState.pair, PAIR_ABI, signer);
                    const reserves = await pair.getReserves();
                    const token0 = await pair.token0();
                    const isToken0 = token0.toLowerCase() === activeState.token.toLowerCase();
                    const tokenReserve = isToken0 ? reserves[0] : reserves[1];
                    const ethReserve = isToken0 ? reserves[1] : reserves[0];

                    console.log(`Token Reserve:    ${ethers.formatEther(tokenReserve)}`);
                    console.log(`ETH Reserve:      ${ethers.formatEther(ethReserve)} ETH`);
                } catch (e) {
                    console.log(`Pair Info:        Could not read`);
                }
            }
        } catch (e) {
            console.log(`Error reading contract: ${e.message}`);
        }
    }

    console.log("");
    console.log("─".repeat(70));
    console.log("TO SWITCH SIMULATION");
    console.log("─".repeat(70));
    console.log("");
    console.log("Edit scripts/config.js and change:");
    console.log("  const ACTIVE_SIMULATION = 1;  // Change to 1, 2, 3, 4, or 5");
    console.log("");
    console.log("═".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
