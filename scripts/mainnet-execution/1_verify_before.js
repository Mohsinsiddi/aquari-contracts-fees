/**
 * =============================================================================
 * MAINNET STEP 1: Verify State Before Fee Enablement
 * =============================================================================
 *
 * ⚠️  THIS IS FOR MAINNET - REAL TRANSACTIONS, REAL MONEY! ⚠️
 *
 * This script verifies the current state of the mainnet AQUARI contract
 * before enabling fees.
 *
 * WHAT IT CHECKS:
 * 1. You are the contract owner
 * 2. pairIsSet is false (fees not yet enabled)
 * 3. Current tax configuration
 * 4. Pair address matches factory
 *
 * NO STATE CHANGES - This is READ ONLY.
 *
 * NEXT: 2_set_fees.js (if all checks pass)
 * =============================================================================
 */

const { ethers } = require("hardhat");
const { MAINNET, NETWORKS, printDisclaimer, verifyOwner } = require("../config");

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

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)"
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)",
    "function totalSupply() view returns (uint256)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log("🔴 MAINNET STEP 1: VERIFY STATE BEFORE FEE ENABLEMENT");
    console.log("=".repeat(70));
    console.log("");
    console.log("This script is READ ONLY - no transactions will be made.");
    console.log("");

    const [signer] = await ethers.getSigners();
    const network = NETWORKS.base;

    // Contracts
    const token = new ethers.Contract(MAINNET.token.address, TOKEN_ABI, signer);
    const factory = new ethers.Contract(network.uniswapV2.factory, FACTORY_ABI, signer);

    // Basic Info
    console.log("─".repeat(70));
    console.log("TOKEN INFO");
    console.log("─".repeat(70));
    console.log(`Address:      ${MAINNET.token.address}`);
    console.log(`Name:         ${await token.name()}`);
    console.log(`Symbol:       ${await token.symbol()}`);
    console.log(`Total Supply: ${ethers.formatEther(await token.totalSupply())}`);
    console.log("");

    // Owner Check
    console.log("─".repeat(70));
    console.log("OWNER CHECK");
    console.log("─".repeat(70));
    const owner = await token.owner();
    const signerAddress = await signer.getAddress();
    console.log(`Contract Owner: ${owner}`);
    console.log(`Your Address:   ${signerAddress}`);

    const isOwner = owner.toLowerCase() === signerAddress.toLowerCase();
    if (isOwner) {
        console.log(`Status:         ✅ You ARE the owner`);
    } else {
        console.log(`Status:         ❌ You are NOT the owner!`);
        console.log("");
        console.log("⚠️  You cannot enable fees without owner access.");
        console.log("   Get the correct private key or contact the owner.");
    }
    console.log("");

    // Pair Status
    console.log("─".repeat(70));
    console.log("PAIR STATUS");
    console.log("─".repeat(70));
    const pairIsSet = await token.pairIsSet();
    const storedPair = await token.uniswapV2Pair();
    const factoryPair = await factory.getPair(MAINNET.token.address, network.weth);

    console.log(`pairIsSet:      ${pairIsSet}`);
    console.log(`Stored Pair:    ${storedPair}`);
    console.log(`Factory Pair:   ${factoryPair}`);
    console.log(`Expected Pair:  ${MAINNET.pair.address}`);
    console.log("");

    if (pairIsSet) {
        console.log("⚠️  FEES ARE ALREADY ENABLED!");
        console.log("   pairIsSet = true means setUniswapV2Pair was already called.");
        console.log("   You cannot change the pair address.");
    } else {
        console.log("✅ pairIsSet is false - fees can be enabled");
    }

    // Verify pair addresses match
    const pairsMatch = factoryPair.toLowerCase() === MAINNET.pair.address.toLowerCase();
    if (pairsMatch) {
        console.log("✅ Factory pair matches expected pair");
    } else {
        console.log("⚠️  Factory pair does NOT match expected pair!");
        console.log("   Update MAINNET.pair.address in config.js");
    }
    console.log("");

    // Current Tax Config
    console.log("─".repeat(70));
    console.log("CURRENT TAX CONFIGURATION");
    console.log("─".repeat(70));
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();

    console.log(`Burn Tax:         ${burnTax} bps (${Number(burnTax)/100}%)`);
    console.log(`Foundation Fee:   ${foundationFee} bps (${Number(foundationFee)/100}%)`);
    console.log(`Foundation Wallet: ${foundationWallet}`);
    console.log("");

    // Target Config
    console.log("─".repeat(70));
    console.log("TARGET TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Burn Tax:         ${MAINNET.taxConfig.burnTax} bps (${MAINNET.taxConfig.burnTax/100}%)`);
    console.log(`Foundation Fee:   ${MAINNET.taxConfig.foundationFee} bps (${MAINNET.taxConfig.foundationFee/100}%)`);
    console.log(`Foundation Wallet: ${MAINNET.foundationWallet}`);
    console.log("");

    // Liquidity Info
    if (factoryPair !== ethers.ZeroAddress) {
        console.log("─".repeat(70));
        console.log("LIQUIDITY INFO");
        console.log("─".repeat(70));
        const pair = new ethers.Contract(factoryPair, PAIR_ABI, signer);
        const reserves = await pair.getReserves();
        const token0 = await pair.token0();
        const isToken0 = token0.toLowerCase() === MAINNET.token.address.toLowerCase();

        const tokenReserve = isToken0 ? reserves[0] : reserves[1];
        const ethReserve = isToken0 ? reserves[1] : reserves[0];

        console.log(`AQUARI Reserve: ${ethers.formatEther(tokenReserve)}`);
        console.log(`ETH Reserve:    ${ethers.formatEther(ethReserve)}`);
        console.log(`LP Total Supply: ${ethers.formatEther(await pair.totalSupply())}`);
        console.log("");
    }

    // Summary
    console.log("═".repeat(70));
    console.log("PRE-FLIGHT CHECKLIST");
    console.log("═".repeat(70));
    console.log("");

    const checks = [
        { name: "You are the owner", pass: isOwner },
        { name: "pairIsSet is false", pass: !pairIsSet },
        { name: "Pair address verified", pass: pairsMatch },
        { name: "Trading is enabled", pass: await token.tradingEnabled() },
    ];

    let allPass = true;
    for (const check of checks) {
        const icon = check.pass ? "✅" : "❌";
        console.log(`  ${icon} ${check.name}`);
        if (!check.pass) allPass = false;
    }
    console.log("");

    if (allPass) {
        console.log("═".repeat(70));
        console.log("✅ ALL CHECKS PASSED - Ready to enable fees");
        console.log("═".repeat(70));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  1. Run 2_set_fees.js to set tax configuration");
        console.log("  2. Run 3_enable_fees.js to enable fees (IRREVERSIBLE)");
        console.log("  3. Run 4_verify_after.js to confirm everything works");
    } else {
        console.log("═".repeat(70));
        console.log("❌ SOME CHECKS FAILED - Do not proceed!");
        console.log("═".repeat(70));
        console.log("");
        console.log("Fix the issues above before continuing.");
    }
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
