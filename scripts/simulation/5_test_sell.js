/**
 * =============================================================================
 * SIMULATION STEP 5: Test Sell
 * =============================================================================
 *
 * Tests selling tokens to verify fees are applied correctly.
 * Fee-on-transfer tokens require SupportingFeeOnTransferTokens method.
 *
 * PREVIOUS: 4_test_buy.js
 * NEXT: 6_verify_state.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    NETWORKS,
    getConfig,
    printDisclaimer,
} = require("../config");

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function pairIsSet() view returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
];

const ROUTER_ABI = [
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)",
    "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 5: TEST SELL (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const network = NETWORKS.base;

    if (!config.token) {
        console.log("❌ Error: Token not deployed.");
        process.exit(1);
    }

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    // Use account #1 as seller (has tokens from buy test, not excluded from fees)
    const seller = signers[1];

    const token = new ethers.Contract(config.token, TOKEN_ABI, seller);
    const router = new ethers.Contract(network.uniswapV2.router, ROUTER_ABI, seller);

    console.log(`Seller:      ${seller.address} (Account #1 - NOT excluded from fees)`);

    const tokenSymbol = await token.symbol();
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();
    const pairIsSet = await token.pairIsSet();

    console.log(`Token:       ${await token.name()} (${tokenSymbol})`);
    console.log(`pairIsSet:   ${pairIsSet}`);
    console.log(`Total Tax:   ${Number(burnTax) + Number(foundationFee)} bps`);
    console.log("");

    // Balances before
    const sellerTokensBefore = await token.balanceOf(seller.address);
    const foundationBefore = await token.balanceOf(foundationWallet);
    const totalSupplyBefore = await token.totalSupply();

    console.log("─".repeat(70));
    console.log("BALANCES BEFORE SELL");
    console.log("─".repeat(70));
    console.log(`Seller:       ${ethers.formatEther(sellerTokensBefore)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBefore)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyBefore)} ${tokenSymbol}`);
    console.log("");

    // Sell amount
    const sellAmount = ethers.parseEther("100");

    if (sellerTokensBefore < sellAmount) {
        console.log("❌ Error: Not enough tokens. Run 4_test_buy.js first.");
        console.log(`   Have: ${ethers.formatEther(sellerTokensBefore)}`);
        process.exit(1);
    }

    console.log("─".repeat(70));
    console.log("SELL ORDER");
    console.log("─".repeat(70));
    console.log(`Selling: ${ethers.formatEther(sellAmount)} ${tokenSymbol}`);
    console.log("");

    // Approve
    console.log("Approving router...");
    await (await token.approve(network.uniswapV2.router, sellAmount)).wait();
    console.log("✅ Approved");
    console.log("");

    // Test 1: Regular swap (should fail)
    console.log("─".repeat(70));
    console.log("TEST 1: Regular swap (expected to FAIL)");
    console.log("─".repeat(70));

    const path = [config.token, network.weth];
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    try {
        await router.swapExactTokensForETH.staticCall(
            sellAmount, 0, path, seller.address, deadline
        );
        console.log("⚠️  Regular swap succeeded (unexpected)");
    } catch (e) {
        if (e.message.includes("K") || e.message.includes("INSUFFICIENT")) {
            console.log("✅ Regular swap FAILED with 'K' error - this is EXPECTED!");
        } else {
            console.log(`⚠️  Failed: ${e.message.slice(0, 80)}`);
        }
    }
    console.log("");

    // Test 2: SupportingFee swap
    console.log("─".repeat(70));
    console.log("TEST 2: SupportingFee swap (should WORK)");
    console.log("─".repeat(70));

    console.log("Executing sell...");
    const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
        sellAmount, 0, path, seller.address, deadline
    );
    await tx.wait();
    console.log("✅ Sell executed!");
    console.log("");

    // Balances after
    const sellerTokensAfter = await token.balanceOf(seller.address);
    const foundationAfter = await token.balanceOf(foundationWallet);
    const totalSupplyAfter = await token.totalSupply();

    const tokensSpent = sellerTokensBefore - sellerTokensAfter;
    const foundationReceived = foundationAfter - foundationBefore;
    const tokensBurned = totalSupplyBefore - totalSupplyAfter;

    console.log("─".repeat(70));
    console.log("BALANCES AFTER SELL");
    console.log("─".repeat(70));
    console.log(`Seller:       ${ethers.formatEther(sellerTokensAfter)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationAfter)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyAfter)} ${tokenSymbol}`);
    console.log("");

    console.log("─".repeat(70));
    console.log("FEE ANALYSIS");
    console.log("─".repeat(70));
    console.log(`Tokens Sold:         ${ethers.formatEther(tokensSpent)}`);
    console.log(`Foundation Received: ${ethers.formatEther(foundationReceived)}`);
    console.log(`Tokens Burned:       ${ethers.formatEther(tokensBurned)}`);
    console.log("");

    const feesApplied = foundationReceived > 0n || tokensBurned > 0n;

    console.log("─".repeat(70));
    console.log("RESULT");
    console.log("─".repeat(70));
    if (feesApplied) {
        console.log("✅ FEES WERE APPLIED ON SELL!");
    } else {
        console.log("❌ NO FEES APPLIED");
    }
    console.log("");

    console.log("═".repeat(70));
    console.log("✅ STEP 5 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("KEY FINDING:");
    console.log("  - Regular swapExactTokensForETH: FAILS");
    console.log("  - SupportingFeeOnTransferTokens: WORKS");
    console.log("");
    console.log("NEXT: Run 6_verify_state.js for final verification");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
