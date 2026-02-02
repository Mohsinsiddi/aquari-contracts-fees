/**
 * =============================================================================
 * MAINNET STEP 3: Enable Fees (SET PAIR ADDRESS)
 * =============================================================================
 *
 * ⚠️  WARNING: THIS ACTION IS IRREVERSIBLE! ⚠️
 * ⚠️  THIS IS FOR MAINNET - REAL TRANSACTIONS! ⚠️
 *
 * This script sets the Uniswap V2 pair address, which ENABLES fees.
 *
 * WHAT IT DOES:
 * 1. Verifies you are the owner
 * 2. Verifies pairIsSet is false
 * 3. Triple-verifies the pair address
 * 4. Sets the pair address
 * 5. Fees are now ACTIVE on all Uniswap trades!
 *
 * CANNOT BE UNDONE - This is a ONE-TIME operation!
 *
 * PREVIOUS: 2_set_fees.js
 * NEXT: 4_verify_after.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const readline = require("readline");
const { MAINNET, NETWORKS, printDisclaimer, verifyOwner } = require("../config");

const TOKEN_ABI = [
    "function owner() view returns (address)",
    "function setUniswapV2Pair(address newPairAddress)",
    "function uniswapV2Pair() view returns (address)",
    "function pairIsSet() view returns (bool)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)"
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)"
];

function askQuestion(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log("🔴 MAINNET STEP 3: ENABLE FEES (SET PAIR ADDRESS)");
    console.log("=".repeat(70));
    console.log("");
    console.log("⚠️  ╔═══════════════════════════════════════════════════════════════╗");
    console.log("⚠️  ║                        WARNING                                 ║");
    console.log("⚠️  ║                                                                ║");
    console.log("⚠️  ║   THIS ACTION IS IRREVERSIBLE!                                ║");
    console.log("⚠️  ║   Once you set the pair address, it CANNOT be changed!        ║");
    console.log("⚠️  ║   If you set the WRONG address, fees will NEVER work!         ║");
    console.log("⚠️  ║                                                                ║");
    console.log("⚠️  ╚═══════════════════════════════════════════════════════════════╝");
    console.log("");

    const [signer] = await ethers.getSigners();
    const network = NETWORKS.base;
    const token = new ethers.Contract(MAINNET.token.address, TOKEN_ABI, signer);
    const factory = new ethers.Contract(network.uniswapV2.factory, FACTORY_ABI, signer);

    console.log(`Token:  ${MAINNET.token.address}`);
    console.log(`Signer: ${await signer.getAddress()}`);
    console.log("");

    // Verify owner
    await verifyOwner(token, signer);
    console.log("");

    // Check pairIsSet
    const pairIsSet = await token.pairIsSet();
    if (pairIsSet) {
        console.log("❌ ERROR: pairIsSet is ALREADY true!");
        console.log("   Fees are already enabled.");
        console.log(`   Current pair: ${await token.uniswapV2Pair()}`);
        console.log("");
        console.log("   You cannot change the pair address.");
        process.exit(1);
    }
    console.log("✅ pairIsSet is false - can proceed");
    console.log("");

    // Triple verify pair address
    console.log("─".repeat(70));
    console.log("PAIR ADDRESS VERIFICATION (TRIPLE CHECK!)");
    console.log("─".repeat(70));

    const factoryPair = await factory.getPair(MAINNET.token.address, network.weth);
    const configPair = MAINNET.pair.address;

    console.log(`1. Factory Pair:   ${factoryPair}`);
    console.log(`2. Config Pair:    ${configPair}`);
    console.log(`3. Expected Match: ${factoryPair.toLowerCase() === configPair.toLowerCase() ? "✅ YES" : "❌ NO"}`);
    console.log("");

    if (factoryPair === ethers.ZeroAddress) {
        console.log("❌ ERROR: No pair exists in factory!");
        console.log("   Create the pair and add liquidity first.");
        process.exit(1);
    }

    if (factoryPair.toLowerCase() !== configPair.toLowerCase()) {
        console.log("❌ ERROR: Pair addresses don't match!");
        console.log("   Update MAINNET.pair.address in config.js to match factory pair.");
        process.exit(1);
    }

    // Current tax config
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();

    console.log("─".repeat(70));
    console.log("TAX CONFIGURATION THAT WILL BE APPLIED");
    console.log("─".repeat(70));
    console.log(`Burn Tax:       ${burnTax} bps (${Number(burnTax)/100}%)`);
    console.log(`Foundation Fee: ${foundationFee} bps (${Number(foundationFee)/100}%)`);
    console.log(`Total Tax:      ${Number(burnTax) + Number(foundationFee)} bps`);
    console.log("");

    // Final confirmation
    console.log("═".repeat(70));
    console.log("FINAL CONFIRMATION");
    console.log("═".repeat(70));
    console.log("");
    console.log("You are about to:");
    console.log(`  1. Set pair address to: ${factoryPair}`);
    console.log(`  2. Enable ${(Number(burnTax) + Number(foundationFee))/100}% fee on all Uniswap trades`);
    console.log(`  3. This action CANNOT be undone!`);
    console.log("");

    const answer = await askQuestion("Type 'ENABLE FEES' to proceed (or anything else to cancel): ");

    if (answer !== "ENABLE FEES") {
        console.log("");
        console.log("❌ Cancelled. No changes made.");
        process.exit(0);
    }

    console.log("");
    console.log("Setting pair address...");
    const tx = await token.setUniswapV2Pair(factoryPair);
    console.log(`Transaction: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    await tx.wait();
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

    if (newPairIsSet && storedPair.toLowerCase() === factoryPair.toLowerCase()) {
        console.log("═".repeat(70));
        console.log("🎉 SUCCESS! FEES ARE NOW ENABLED!");
        console.log("═".repeat(70));
        console.log("");
        console.log(`   Burn Tax:       ${Number(burnTax)/100}% burned on each trade`);
        console.log(`   Foundation Fee: ${Number(foundationFee)/100}% to foundation on each trade`);
        console.log("");
        console.log("   All Uniswap trades will now have fees applied.");
        console.log("");
    } else {
        console.log("⚠️  Something unexpected happened. Check the transaction.");
    }

    console.log("NEXT: Run 4_verify_after.js to confirm everything works");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
