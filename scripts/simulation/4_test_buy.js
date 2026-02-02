/**
 * =============================================================================
 * SIMULATION STEP 4: Test Buy (V4 Universal Router)
 * =============================================================================
 *
 * Tests buying tokens via V4 Universal Router to verify fees are applied.
 *
 * PREVIOUS: 3_set_pair.js
 * NEXT: 5_test_sell.js
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
    buyTokensWithETH,
    UNIVERSAL_ROUTER_ADDRESS,
} = require("../utils/universalRouter");

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
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
    console.log(`STEP 4: TEST BUY via V4 (Simulation #${ACTIVE_SIMULATION})`);
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

    console.log(`Buyer:       ${trader.address} (Account #1 - NOT excluded from fees)`);
    console.log(`V4 Router:   ${UNIVERSAL_ROUTER_ADDRESS}`);

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

    // Balances before
    const buyerBalanceBefore = await token.balanceOf(trader.address);
    const foundationBalanceBefore = await token.balanceOf(foundationWallet);
    const totalSupplyBefore = await token.totalSupply();

    console.log("─".repeat(70));
    console.log("BALANCES BEFORE BUY");
    console.log("─".repeat(70));
    console.log(`Buyer:        ${ethers.formatEther(buyerBalanceBefore)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBalanceBefore)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyBefore)} ${tokenSymbol}`);
    console.log("");

    // Buy via V4
    const buyAmount = ethers.parseEther("0.001");
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    console.log("─".repeat(70));
    console.log("BUY ORDER (V4 Universal Router)");
    console.log("─".repeat(70));
    console.log(`Buying with: ${ethers.formatEther(buyAmount)} ETH`);
    console.log("");

    console.log("Executing buy via V4...");
    const tx = await buyTokensWithETH(
        universalRouter,
        config.token,
        network.weth,
        trader.address,
        buyAmount,
        0n,
        deadline
    );
    await tx.wait();
    console.log("✅ Buy executed!");
    console.log("");

    // Balances after
    const buyerBalanceAfter = await token.balanceOf(trader.address);
    const foundationBalanceAfter = await token.balanceOf(foundationWallet);
    const totalSupplyAfter = await token.totalSupply();

    const tokensReceived = buyerBalanceAfter - buyerBalanceBefore;
    const foundationReceived = foundationBalanceAfter - foundationBalanceBefore;
    const tokensBurned = totalSupplyBefore - totalSupplyAfter;
    const totalFees = foundationReceived + tokensBurned;
    const grossTokens = tokensReceived + totalFees;

    console.log("─".repeat(70));
    console.log("BALANCES AFTER BUY");
    console.log("─".repeat(70));
    console.log(`Buyer:        ${ethers.formatEther(buyerBalanceAfter)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBalanceAfter)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyAfter)} ${tokenSymbol}`);
    console.log("");

    console.log("─".repeat(70));
    console.log("FEE ANALYSIS (STRICT)");
    console.log("─".repeat(70));
    console.log(`Gross Tokens:        ${ethers.formatEther(grossTokens)}`);
    console.log(`Tokens Received:     ${ethers.formatEther(tokensReceived)}`);
    console.log(`Foundation Received: ${ethers.formatEther(foundationReceived)}`);
    console.log(`Tokens Burned:       ${ethers.formatEther(tokensBurned)}`);
    console.log(`Total Fees:          ${ethers.formatEther(totalFees)}`);
    console.log("");

    // Calculate actual fee percentage
    const actualFeeBps = grossTokens > 0n ? Number((totalFees * 10000n) / grossTokens) : 0;
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
    console.log("✅ STEP 4 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("NEXT: Run 5_test_sell.js to test selling tokens");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
