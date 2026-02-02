/**
 * =============================================================================
 * MAINNET STEP 2: Set Tax Configuration
 * =============================================================================
 *
 * ⚠️  THIS IS FOR MAINNET - REAL TRANSACTIONS! ⚠️
 *
 * This script sets the tax configuration on mainnet AQUARI.
 *
 * WHAT IT DOES:
 * 1. Sets burnTax to 125 bps (1.25%)
 * 2. Sets foundationFee to 125 bps (1.25%)
 *
 * NOTE: This CAN be changed later! Only setUniswapV2Pair is irreversible.
 *
 * PREVIOUS: 1_verify_before.js
 * NEXT: 3_enable_fees.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const { MAINNET, NETWORKS, printDisclaimer, verifyOwner } = require("../config");

const TOKEN_ABI = [
    "function owner() view returns (address)",
    "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee)",
    "function setFoundationWallet(address newWallet)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function pairIsSet() view returns (bool)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log("🔴 MAINNET STEP 2: SET TAX CONFIGURATION");
    console.log("=".repeat(70));
    console.log("");

    const [signer] = await ethers.getSigners();
    const token = new ethers.Contract(MAINNET.token.address, TOKEN_ABI, signer);

    console.log(`Token:  ${MAINNET.token.address}`);
    console.log(`Signer: ${await signer.getAddress()}`);
    console.log("");

    // Verify owner
    await verifyOwner(token, signer);
    console.log("");

    // Current state
    console.log("─".repeat(70));
    console.log("CURRENT TAX CONFIGURATION");
    console.log("─".repeat(70));
    const currentBurn = await token.burnTax();
    const currentFound = await token.foundationFee();
    const currentWallet = await token.foundationWallet();

    console.log(`Burn Tax:         ${currentBurn} bps (${Number(currentBurn)/100}%)`);
    console.log(`Foundation Fee:   ${currentFound} bps (${Number(currentFound)/100}%)`);
    console.log(`Foundation Wallet: ${currentWallet}`);
    console.log("");

    // Target config
    console.log("─".repeat(70));
    console.log("NEW TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Burn Tax:         ${MAINNET.taxConfig.burnTax} bps (${MAINNET.taxConfig.burnTax/100}%)`);
    console.log(`Foundation Fee:   ${MAINNET.taxConfig.foundationFee} bps (${MAINNET.taxConfig.foundationFee/100}%)`);
    console.log(`Total:            ${MAINNET.taxConfig.burnTax + MAINNET.taxConfig.foundationFee} bps (${(MAINNET.taxConfig.burnTax + MAINNET.taxConfig.foundationFee)/100}%)`);
    console.log(`Foundation Wallet: ${MAINNET.foundationWallet}`);
    console.log("");

    // Check if foundation wallet needs update
    const needsWalletUpdate = currentWallet.toLowerCase() !== MAINNET.foundationWallet.toLowerCase();

    if (needsWalletUpdate) {
        console.log("Updating foundation wallet...");
        const walletTx = await token.setFoundationWallet(MAINNET.foundationWallet);
        await walletTx.wait();
        console.log("✅ Foundation wallet updated!");
        console.log("");
    }

    // Set tax config
    console.log("Setting tax configuration...");
    const tx = await token.setTaxConfig(MAINNET.taxConfig.burnTax, MAINNET.taxConfig.foundationFee);
    console.log(`Transaction: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    await tx.wait();
    console.log("✅ Tax configuration set!");
    console.log("");

    // Verify
    console.log("─".repeat(70));
    console.log("VERIFICATION");
    console.log("─".repeat(70));
    const newBurn = await token.burnTax();
    const newFound = await token.foundationFee();
    const newWallet = await token.foundationWallet();

    console.log(`Burn Tax:         ${newBurn} bps (${Number(newBurn)/100}%)`);
    console.log(`Foundation Fee:   ${newFound} bps (${Number(newFound)/100}%)`);
    console.log(`Foundation Wallet: ${newWallet}`);
    console.log("");

    const burnMatch = Number(newBurn) === MAINNET.taxConfig.burnTax;
    const foundMatch = Number(newFound) === MAINNET.taxConfig.foundationFee;
    const walletMatch = newWallet.toLowerCase() === MAINNET.foundationWallet.toLowerCase();

    if (burnMatch && foundMatch && walletMatch) {
        console.log("✅ All values set correctly!");
    } else {
        console.log("⚠️  Some values don't match expected!");
    }
    console.log("");

    console.log("═".repeat(70));
    console.log("✅ STEP 2 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("NOTE: These settings CAN be changed later with setTaxConfig()");
    console.log("");
    console.log("NEXT: Run 3_enable_fees.js to enable fees (⚠️ IRREVERSIBLE!)");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
