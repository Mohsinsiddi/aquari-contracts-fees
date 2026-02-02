/**
 * =============================================================================
 * SIMULATION STEP 5: Test Sell (V4 Universal Router)
 * =============================================================================
 *
 * Tests selling tokens via V4 Universal Router to verify fees are applied.
 * Uses Permit2 for token approval (same as Uniswap UI).
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
    printAllSimulations,
} = require("../config");
const {
    getUniversalRouter,
    sellFeeTokensForETH,
    setupPermit2ForSell,
    UNIVERSAL_ROUTER_ADDRESS,
    PERMIT2_ADDRESS,
} = require("../utils/universalRouter");

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

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 5: TEST SELL via V4 (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const network = NETWORKS.base;

    if (!config.token) {
        console.log("❌ Error: Token not deployed. Run 0_deploy.js first.");
        process.exit(1);
    }

    const signers = await ethers.getSigners();
    const trader = signers[1]; // Account #1 - NOT excluded from fees

    const token = new ethers.Contract(config.token, TOKEN_ABI, trader);
    const universalRouter = getUniversalRouter(trader);

    console.log(`Seller:      ${trader.address} (Account #1 - NOT excluded from fees)`);
    console.log(`V4 Router:   ${UNIVERSAL_ROUTER_ADDRESS}`);
    console.log(`Permit2:     ${PERMIT2_ADDRESS}`);

    const tokenSymbol = await token.symbol();
    const pairIsSet = await token.pairIsSet();

    console.log(`Token:       ${await token.name()} (${tokenSymbol})`);
    console.log(`pairIsSet:   ${pairIsSet}`);
    console.log("");

    // Get tax config
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();
    const expectedFeeBps = Number(burnTax) + Number(foundationFee);

    console.log("─".repeat(70));
    console.log("TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Burn Tax:       ${burnTax} bps (${Number(burnTax)/100}%)`);
    console.log(`Foundation Fee: ${foundationFee} bps (${Number(foundationFee)/100}%)`);
    console.log(`Total Tax:      ${expectedFeeBps} bps (${expectedFeeBps/100}%)`);
    console.log(`Expected Fee:   ${pairIsSet ? expectedFeeBps/100 + "%" : "0% (pairIsSet=false)"}`);
    console.log("");

    // Check balance
    const sellAmount = ethers.parseEther("100");
    const balance = await token.balanceOf(trader.address);

    if (balance < sellAmount) {
        console.log(`❌ Insufficient balance: ${ethers.formatEther(balance)} < ${ethers.formatEther(sellAmount)}`);
        console.log("   Run 4_test_buy.js first to get tokens.");
        process.exit(1);
    }

    // Setup Permit2 (required for V4 Universal Router sells)
    console.log("─".repeat(70));
    console.log("PERMIT2 SETUP");
    console.log("─".repeat(70));
    console.log("Step 1: Approving Permit2 for token...");
    console.log("Step 2: Approving Universal Router via Permit2...");
    await setupPermit2ForSell(token, config.token, trader);
    console.log("✅ Permit2 ready");
    console.log("");

    // Balances before
    const sellerBalanceBefore = await token.balanceOf(trader.address);
    const foundationBalanceBefore = await token.balanceOf(foundationWallet);
    const totalSupplyBefore = await token.totalSupply();

    console.log("─".repeat(70));
    console.log("BALANCES BEFORE SELL");
    console.log("─".repeat(70));
    console.log(`Seller:       ${ethers.formatEther(sellerBalanceBefore)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBalanceBefore)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyBefore)} ${tokenSymbol}`);
    console.log("");

    // Sell via V4
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    console.log("─".repeat(70));
    console.log("SELL ORDER (V4 Universal Router)");
    console.log("─".repeat(70));
    console.log(`Selling: ${ethers.formatEther(sellAmount)} ${tokenSymbol}`);
    console.log("");

    console.log("Executing sell via V4...");
    const tx = await sellFeeTokensForETH(
        universalRouter,
        config.token,
        network.weth,
        trader.address,
        sellAmount,
        0n,
        deadline
    );
    await tx.wait();
    console.log("✅ Sell executed!");
    console.log("");

    // Balances after
    const sellerBalanceAfter = await token.balanceOf(trader.address);
    const foundationBalanceAfter = await token.balanceOf(foundationWallet);
    const totalSupplyAfter = await token.totalSupply();

    const tokensSold = sellerBalanceBefore - sellerBalanceAfter;
    const foundationReceived = foundationBalanceAfter - foundationBalanceBefore;
    const tokensBurned = totalSupplyBefore - totalSupplyAfter;
    const totalFees = foundationReceived + tokensBurned;

    console.log("─".repeat(70));
    console.log("BALANCES AFTER SELL");
    console.log("─".repeat(70));
    console.log(`Seller:       ${ethers.formatEther(sellerBalanceAfter)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBalanceAfter)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyAfter)} ${tokenSymbol}`);
    console.log("");

    console.log("─".repeat(70));
    console.log("FEE ANALYSIS (STRICT)");
    console.log("─".repeat(70));
    console.log(`Tokens Sold:         ${ethers.formatEther(tokensSold)}`);
    console.log(`Foundation Received: ${ethers.formatEther(foundationReceived)}`);
    console.log(`Tokens Burned:       ${ethers.formatEther(tokensBurned)}`);
    console.log(`Total Fees:          ${ethers.formatEther(totalFees)}`);
    console.log("");

    // Calculate actual fee percentage
    const actualFeeBps = tokensSold > 0n ? Number((totalFees * 10000n) / tokensSold) : 0;
    const actualFeePercent = actualFeeBps / 100;
    const expectedFeePercent = pairIsSet ? expectedFeeBps / 100 : 0;
    const precisionLoss = Math.abs(actualFeePercent - expectedFeePercent);

    console.log(`Expected Fee:        ${expectedFeePercent.toFixed(4)}%`);
    console.log(`Actual Fee:          ${actualFeePercent.toFixed(4)}%`);
    console.log(`Actual Fee (bps):    ${actualFeeBps} bps`);
    console.log(`Precision Loss:      ${precisionLoss.toFixed(6)}%`);

    // Verify burn/foundation split (should be 50/50)
    if (totalFees > 0n) {
        const burnSplit = Number((tokensBurned * 10000n) / totalFees) / 100;
        const foundationSplit = Number((foundationReceived * 10000n) / totalFees) / 100;
        console.log(`Burn Split:          ${burnSplit.toFixed(2)}% of fees`);
        console.log(`Foundation Split:    ${foundationSplit.toFixed(2)}% of fees`);
    }
    console.log("");

    // Result
    console.log("─".repeat(70));
    console.log("RESULT");
    console.log("─".repeat(70));

    const pass = precisionLoss < 0.02; // 0.02% tolerance

    if (pass) {
        console.log("✅ FEES APPLIED CORRECTLY!");
        console.log(`   Expected: ${expectedFeePercent}%`);
        console.log(`   Actual:   ${actualFeePercent.toFixed(4)}%`);
        console.log(`   Precision Loss: ${precisionLoss.toFixed(6)}%`);
    } else {
        console.log("❌ FEE MISMATCH!");
        console.log(`   Expected: ${expectedFeePercent}%`);
        console.log(`   Actual:   ${actualFeePercent.toFixed(4)}%`);
    }
    console.log("");

    printAllSimulations();

    console.log("═".repeat(70));
    console.log("✅ STEP 5 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("NEXT: Run 6_verify_state.js to verify final state");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
