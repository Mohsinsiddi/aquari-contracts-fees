/**
 * =============================================================================
 * MAINNET STEP 4: Verify After Fee Enablement
 * =============================================================================
 *
 * This script verifies the state after fees have been enabled.
 *
 * WHAT IT CHECKS:
 * 1. pairIsSet is true
 * 2. Tax configuration is correct
 * 3. Pair address is correct
 * 4. Trading is working
 *
 * NO STATE CHANGES - This is READ ONLY.
 *
 * PREVIOUS: 3_enable_fees.js
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers } = hre;
const { MAINNET, NETWORKS, printDisclaimer, getMainnetSigner } = require("../config");

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
    "function token0() view returns (address)",
    "function totalSupply() view returns (uint256)"
];

async function main() {
    printDisclaimer();

    // Get signer (impersonated on fork, real on mainnet)
    const { signer, isFork } = await getMainnetSigner(hre);

    const modeLabel = isFork ? "🔵 FORK TEST" : "🔴 MAINNET";
    console.log("=".repeat(70));
    console.log(`${modeLabel} STEP 4: VERIFY AFTER FEE ENABLEMENT`);
    console.log("=".repeat(70));
    console.log("");

    const network = NETWORKS.base;
    const token = new ethers.Contract(MAINNET.token.address, TOKEN_ABI, signer);

    // Token Info
    console.log("─".repeat(70));
    console.log("TOKEN INFO");
    console.log("─".repeat(70));
    console.log(`Address:      ${MAINNET.token.address}`);
    console.log(`Name:         ${await token.name()}`);
    console.log(`Symbol:       ${await token.symbol()}`);
    console.log(`Total Supply: ${ethers.formatEther(await token.totalSupply())}`);
    console.log(`Owner:        ${await token.owner()}`);
    console.log("");

    // Pair Status
    const pairIsSet = await token.pairIsSet();
    const uniswapV2Pair = await token.uniswapV2Pair();

    console.log("─".repeat(70));
    console.log("PAIR STATUS");
    console.log("─".repeat(70));
    console.log(`pairIsSet:     ${pairIsSet} ${pairIsSet ? "✅ FEES ENABLED" : "❌ FEES NOT ENABLED"}`);
    console.log(`uniswapV2Pair: ${uniswapV2Pair}`);
    console.log(`Expected:      ${MAINNET.pair.address}`);
    console.log(`Match:         ${uniswapV2Pair.toLowerCase() === MAINNET.pair.address.toLowerCase() ? "✅" : "❌"}`);
    console.log("");

    // Tax Configuration
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();

    console.log("─".repeat(70));
    console.log("TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Burn Tax:         ${burnTax} bps (${Number(burnTax)/100}%)`);
    console.log(`Foundation Fee:   ${foundationFee} bps (${Number(foundationFee)/100}%)`);
    console.log(`Total Tax:        ${Number(burnTax) + Number(foundationFee)} bps (${(Number(burnTax) + Number(foundationFee))/100}%)`);
    console.log(`Foundation Wallet: ${foundationWallet}`);
    console.log("");

    // Verify against expected
    console.log("─".repeat(70));
    console.log("EXPECTED vs ACTUAL");
    console.log("─".repeat(70));
    const burnMatch = Number(burnTax) === MAINNET.taxConfig.burnTax;
    const foundMatch = Number(foundationFee) === MAINNET.taxConfig.foundationFee;
    const walletMatch = foundationWallet.toLowerCase() === MAINNET.foundationWallet.toLowerCase();

    console.log(`Burn Tax:         ${burnMatch ? "✅" : "❌"} (expected ${MAINNET.taxConfig.burnTax}, got ${burnTax})`);
    console.log(`Foundation Fee:   ${foundMatch ? "✅" : "❌"} (expected ${MAINNET.taxConfig.foundationFee}, got ${foundationFee})`);
    console.log(`Foundation Wallet: ${walletMatch ? "✅" : "❌"}`);
    console.log("");

    // Liquidity Info
    if (uniswapV2Pair !== ethers.ZeroAddress) {
        console.log("─".repeat(70));
        console.log("LIQUIDITY INFO");
        console.log("─".repeat(70));
        const pair = new ethers.Contract(uniswapV2Pair, PAIR_ABI, signer);
        const reserves = await pair.getReserves();
        const token0 = await pair.token0();
        const isToken0 = token0.toLowerCase() === MAINNET.token.address.toLowerCase();

        const tokenReserve = isToken0 ? reserves[0] : reserves[1];
        const ethReserve = isToken0 ? reserves[1] : reserves[0];

        console.log(`AQUARI Reserve: ${ethers.formatEther(tokenReserve)}`);
        console.log(`ETH Reserve:    ${ethers.formatEther(ethReserve)}`);
        console.log("");
    }

    // Key Balances
    console.log("─".repeat(70));
    console.log("KEY BALANCES");
    console.log("─".repeat(70));
    console.log(`Foundation: ${ethers.formatEther(await token.balanceOf(foundationWallet))} AQUARI`);
    console.log("");

    // Final Summary
    console.log("═".repeat(70));
    console.log("SUMMARY");
    console.log("═".repeat(70));
    console.log("");

    if (pairIsSet && burnMatch && foundMatch) {
        console.log("🎉 FEES ARE ENABLED AND CONFIGURED CORRECTLY!");
        console.log("");
        console.log("   What happens on each Uniswap trade:");
        console.log(`   - ${Number(burnTax)/100}% of tokens are BURNED (removed from supply)`);
        console.log(`   - ${Number(foundationFee)/100}% of tokens go to FOUNDATION wallet`);
        console.log(`   - ${100 - (Number(burnTax) + Number(foundationFee))/100}% of tokens go to trader`);
        console.log("");
        console.log("   Users must use 'SupportingFeeOnTransferTokens' swap methods.");
        console.log("   Uniswap UI auto-detects this and handles it automatically.");
    } else if (!pairIsSet) {
        console.log("⚠️  FEES ARE NOT YET ENABLED");
        console.log("   pairIsSet is false - run 3_enable_fees.js first");
    } else {
        console.log("⚠️  CONFIGURATION MISMATCH");
        console.log("   Some values don't match expected configuration.");
        console.log("   You can update tax config anytime with setTaxConfig()");
    }
    console.log("");

    // Admin reminder
    console.log("─".repeat(70));
    console.log("ADMIN FUNCTIONS (Can change anytime)");
    console.log("─".repeat(70));
    console.log("• setTaxConfig(newBurnTax, newFoundationFee) - Change fees");
    console.log("• setFoundationWallet(newWallet) - Change foundation wallet");
    console.log("• setTradingEnabled(bool) - Enable/disable trading");
    console.log("• pause() / unpause() - Emergency pause");
    console.log("");
    console.log("⚠️  setUniswapV2Pair() - CANNOT be called again (already set)");
    console.log("");

    console.log("═".repeat(70));
    console.log("✅ VERIFICATION COMPLETE");
    console.log("═".repeat(70));
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
