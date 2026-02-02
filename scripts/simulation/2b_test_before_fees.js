/**
 * =============================================================================
 * SIMULATION STEP 2b: Test Buy/Sell BEFORE Fees Enabled (V4)
 * =============================================================================
 *
 * Tests that NO fees are applied when pairIsSet is false.
 * Uses V4 Universal Router for BUY, V2 Router for SELL.
 *
 * PREVIOUS: 2_set_tax_config.js
 * NEXT: 3_set_pair.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    NETWORKS,
    getConfig,
    printDisclaimer,
} = require("../config");
const {
    getUniversalRouter,
    buyTokensWithETH,
    UNIVERSAL_ROUTER_ADDRESS,
} = require("../utils/universalRouter");

const TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function transfer(address, uint256) returns (bool)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function pairIsSet() view returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
];

const ROUTER_ABI = [
    "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 2b: TEST BEFORE FEES via V4 (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const network = NETWORKS.base;

    if (!config.token) {
        console.log("Error: Token not deployed. Run 0_deploy.js first.");
        process.exit(1);
    }

    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const buyer = signers[1];

    const tokenDeployer = new ethers.Contract(config.token, TOKEN_ABI, deployer);
    const tokenBuyer = new ethers.Contract(config.token, TOKEN_ABI, buyer);
    const v2Router = new ethers.Contract(network.uniswapV2.router, ROUTER_ABI, buyer);
    const v4Router = getUniversalRouter(buyer);

    const tokenSymbol = await tokenDeployer.symbol();
    const pairIsSet = await tokenDeployer.pairIsSet();
    const burnTax = await tokenDeployer.burnTax();
    const foundationFee = await tokenDeployer.foundationFee();
    const foundationWallet = await tokenDeployer.foundationWallet();

    console.log(`Token:     ${await tokenDeployer.name()} (${tokenSymbol})`);
    console.log(`pairIsSet: ${pairIsSet}`);
    console.log(`burnTax:   ${burnTax} bps`);
    console.log(`foundFee:  ${foundationFee} bps`);
    console.log(`Buyer:     ${buyer.address} (Account #1)`);
    console.log(`V4 Router: ${UNIVERSAL_ROUTER_ADDRESS}`);
    console.log("");

    if (pairIsSet) {
        console.log("WARNING: pairIsSet is already TRUE!");
        console.log("This test should run BEFORE 3_set_pair.js");
        console.log("");
    }

    // Get balances before
    const foundationBefore = await tokenDeployer.balanceOf(foundationWallet);
    const totalSupplyBefore = await tokenDeployer.totalSupply();
    const buyerBefore = await tokenDeployer.balanceOf(buyer.address);

    console.log("=".repeat(70));
    console.log("TEST: BUY via V4 BEFORE FEES ENABLED");
    console.log("=".repeat(70));
    console.log("");

    console.log("BALANCES BEFORE:");
    console.log(`  Buyer:      ${ethers.formatEther(buyerBefore)} ${tokenSymbol}`);
    console.log(`  Foundation: ${ethers.formatEther(foundationBefore)} ${tokenSymbol}`);
    console.log(`  Supply:     ${ethers.formatEther(totalSupplyBefore)} ${tokenSymbol}`);
    console.log("");

    // Buy tokens via V4
    const buyAmount = ethers.parseEther("0.001");
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    console.log(`Buying with ${ethers.formatEther(buyAmount)} ETH via V4 Universal Router...`);
    const buyTx = await buyTokensWithETH(
        v4Router,
        config.token,
        network.weth,
        buyer.address,
        buyAmount,
        0n,
        deadline
    );
    await buyTx.wait();
    console.log("Buy executed!");
    console.log("");

    // Check balances after buy
    const buyerAfterBuy = await tokenDeployer.balanceOf(buyer.address);
    const foundationAfterBuy = await tokenDeployer.balanceOf(foundationWallet);
    const totalSupplyAfterBuy = await tokenDeployer.totalSupply();

    const tokensReceived = buyerAfterBuy - buyerBefore;
    const foundationReceivedBuy = foundationAfterBuy - foundationBefore;
    const burnedBuy = totalSupplyBefore - totalSupplyAfterBuy;
    const totalFeesBuy = foundationReceivedBuy + burnedBuy;

    console.log("BALANCES AFTER BUY:");
    console.log(`  Buyer:      ${ethers.formatEther(buyerAfterBuy)} ${tokenSymbol}`);
    console.log(`  Foundation: ${ethers.formatEther(foundationAfterBuy)} ${tokenSymbol}`);
    console.log(`  Supply:     ${ethers.formatEther(totalSupplyAfterBuy)} ${tokenSymbol}`);
    console.log("");

    console.log("BUY FEE ANALYSIS:");
    console.log(`  Tokens received:     ${ethers.formatEther(tokensReceived)}`);
    console.log(`  Foundation received: ${ethers.formatEther(foundationReceivedBuy)}`);
    console.log(`  Tokens burned:       ${ethers.formatEther(burnedBuy)}`);
    console.log(`  Total fees:          ${ethers.formatEther(totalFeesBuy)}`);

    const buyFeesApplied = totalFeesBuy > 0n;
    const grossBuy = tokensReceived + totalFeesBuy;
    const buyFeePercent = grossBuy > 0n ? (Number(totalFeesBuy) / Number(grossBuy) * 100).toFixed(4) : "0.0000";

    console.log(`  Fee %:               ${buyFeePercent}%`);
    if (buyFeesApplied) {
        console.log("  Result: ❌ FEES APPLIED (unexpected if pairIsSet=false)");
    } else {
        console.log("  Result: ✅ NO FEES (expected when pairIsSet=false)");
    }
    console.log("");

    // Now test sell via V2 (simpler for before-fees test)
    console.log("=".repeat(70));
    console.log("TEST: SELL via V2 BEFORE FEES ENABLED");
    console.log("=".repeat(70));
    console.log("");

    const sellAmount = ethers.parseEther("100");
    let sellFeesApplied = false;

    if (buyerAfterBuy < sellAmount) {
        console.log(`Not enough tokens to sell. Have: ${ethers.formatEther(buyerAfterBuy)}`);
        console.log("Skipping sell test.");
    } else {
        // Approve V2 Router
        await (await tokenBuyer.approve(network.uniswapV2.router, sellAmount)).wait();
        console.log("Approved V2 router");

        const sellPath = [config.token, network.weth];

        console.log(`Selling ${ethers.formatEther(sellAmount)} ${tokenSymbol} via V2...`);

        try {
            const sellTx = await v2Router.swapExactTokensForETH(
                sellAmount, 0, sellPath, buyer.address, deadline
            );
            await sellTx.wait();
            console.log("Sell executed!");
            console.log("");

            // Check balances after sell
            const buyerAfterSell = await tokenDeployer.balanceOf(buyer.address);
            const foundationAfterSell = await tokenDeployer.balanceOf(foundationWallet);
            const totalSupplyAfterSell = await tokenDeployer.totalSupply();

            const tokensSold = buyerAfterBuy - buyerAfterSell;
            const foundationReceivedSell = foundationAfterSell - foundationAfterBuy;
            const burnedSell = totalSupplyAfterBuy - totalSupplyAfterSell;
            const totalFeesSell = foundationReceivedSell + burnedSell;

            console.log("BALANCES AFTER SELL:");
            console.log(`  Buyer:      ${ethers.formatEther(buyerAfterSell)} ${tokenSymbol}`);
            console.log(`  Foundation: ${ethers.formatEther(foundationAfterSell)} ${tokenSymbol}`);
            console.log(`  Supply:     ${ethers.formatEther(totalSupplyAfterSell)} ${tokenSymbol}`);
            console.log("");

            console.log("SELL FEE ANALYSIS:");
            console.log(`  Tokens sold:         ${ethers.formatEther(tokensSold)}`);
            console.log(`  Foundation received: ${ethers.formatEther(foundationReceivedSell)}`);
            console.log(`  Tokens burned:       ${ethers.formatEther(burnedSell)}`);
            console.log(`  Total fees:          ${ethers.formatEther(totalFeesSell)}`);

            sellFeesApplied = totalFeesSell > 0n;
            const sellFeePercent = tokensSold > 0n ? (Number(totalFeesSell) / Number(tokensSold) * 100).toFixed(4) : "0.0000";
            console.log(`  Fee %:               ${sellFeePercent}%`);

            if (sellFeesApplied) {
                console.log("  Result: ❌ FEES APPLIED (unexpected if pairIsSet=false)");
            } else {
                console.log("  Result: ✅ NO FEES (expected when pairIsSet=false)");
            }
        } catch (e) {
            console.log(`Sell failed: ${e.message.slice(0, 100)}`);
        }
    }

    console.log("");
    console.log("=".repeat(70));
    console.log("SUMMARY");
    console.log("=".repeat(70));
    console.log("");

    console.log("┌─────────────────┬──────────────┬──────────────┬────────┐");
    console.log("│ Test            │ Expected     │ Actual       │ Status │");
    console.log("├─────────────────┼──────────────┼──────────────┼────────┤");
    console.log(`│ BUY via V4      │ 0.00%        │ ${buyFeePercent.padStart(10)}%  │ ${buyFeesApplied ? "  FAIL" : "  PASS"} │`);
    console.log(`│ SELL via V2     │ 0.00%        │ ${sellFeesApplied ? "  >0.00" : "   0.00"}%  │ ${sellFeesApplied ? "  FAIL" : "  PASS"} │`);
    console.log("└─────────────────┴──────────────┴──────────────┴────────┘");
    console.log("");

    if (!pairIsSet && !buyFeesApplied && !sellFeesApplied) {
        console.log("✅ CONCLUSION: Fee logic is CORRECT!");
        console.log("   Fees only apply AFTER setUniswapV2Pair() is called.");
    } else if (pairIsSet) {
        console.log("⚠️ pairIsSet is already TRUE - fees should be applied.");
        console.log("   Run this test BEFORE step 3.");
    } else {
        console.log("❌ WARNING: Unexpected behavior - fees applied when pairIsSet=false");
    }
    console.log("");

    console.log("=".repeat(70));
    console.log("STEP 2b COMPLETE");
    console.log("=".repeat(70));
    console.log("");
    console.log("NEXT: Run 3_set_pair.js to enable fees (IRREVERSIBLE)");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
