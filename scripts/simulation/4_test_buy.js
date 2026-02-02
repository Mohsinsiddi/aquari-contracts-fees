/**
 * =============================================================================
 * SIMULATION STEP 4: Test Buy
 * =============================================================================
 *
 * Tests buying tokens to verify fees are applied correctly.
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

const ROUTER_ABI = [
    "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
    "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 4: TEST BUY (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const network = NETWORKS.base;

    // Check prerequisites
    if (!config.token) {
        console.log("❌ Error: Token not deployed. Run 0_deploy.js first.");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    const token = new ethers.Contract(config.token, TOKEN_ABI, deployer);
    const router = new ethers.Contract(network.uniswapV2.router, ROUTER_ABI, deployer);

    const tokenSymbol = await token.symbol();
    const pairIsSet = await token.pairIsSet();

    console.log(`Token:       ${await token.name()} (${tokenSymbol})`);
    console.log(`pairIsSet:   ${pairIsSet}`);
    console.log("");

    // Get tax config
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();

    console.log("─".repeat(70));
    console.log("TAX CONFIGURATION");
    console.log("─".repeat(70));
    console.log(`Burn Tax:       ${burnTax} (${Number(burnTax)/100}%)`);
    console.log(`Foundation Fee: ${foundationFee} (${Number(foundationFee)/100}%)`);
    console.log(`Total Tax:      ${Number(burnTax) + Number(foundationFee)} bps`);
    console.log("");

    // Balances before
    const buyerBalanceBefore = await token.balanceOf(deployer.address);
    const foundationBalanceBefore = await token.balanceOf(foundationWallet);
    const totalSupplyBefore = await token.totalSupply();

    console.log("─".repeat(70));
    console.log("BALANCES BEFORE BUY");
    console.log("─".repeat(70));
    console.log(`Buyer:        ${ethers.formatEther(buyerBalanceBefore)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBalanceBefore)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyBefore)} ${tokenSymbol}`);
    console.log("");

    // Buy
    const buyAmount = ethers.parseEther("0.001");
    const path = [network.weth, config.token];

    console.log("─".repeat(70));
    console.log("BUY ORDER");
    console.log("─".repeat(70));
    console.log(`Buying with: ${ethers.formatEther(buyAmount)} ETH`);
    console.log("");

    console.log("Executing buy...");
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const tx = await router.swapExactETHForTokens(
        0,
        path,
        deployer.address,
        deadline,
        { value: buyAmount }
    );
    await tx.wait();
    console.log("✅ Buy executed!");
    console.log("");

    // Balances after
    const buyerBalanceAfter = await token.balanceOf(deployer.address);
    const foundationBalanceAfter = await token.balanceOf(foundationWallet);
    const totalSupplyAfter = await token.totalSupply();

    const tokensReceived = buyerBalanceAfter - buyerBalanceBefore;
    const foundationReceived = foundationBalanceAfter - foundationBalanceBefore;
    const tokensBurned = totalSupplyBefore - totalSupplyAfter;

    console.log("─".repeat(70));
    console.log("BALANCES AFTER BUY");
    console.log("─".repeat(70));
    console.log(`Buyer:        ${ethers.formatEther(buyerBalanceAfter)} ${tokenSymbol}`);
    console.log(`Foundation:   ${ethers.formatEther(foundationBalanceAfter)} ${tokenSymbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupplyAfter)} ${tokenSymbol}`);
    console.log("");

    console.log("─".repeat(70));
    console.log("FEE ANALYSIS");
    console.log("─".repeat(70));
    console.log(`Tokens Received:     ${ethers.formatEther(tokensReceived)}`);
    console.log(`Foundation Received: ${ethers.formatEther(foundationReceived)}`);
    console.log(`Tokens Burned:       ${ethers.formatEther(tokensBurned)}`);
    console.log("");

    // Check if fees applied
    const feesApplied = foundationReceived > 0n || tokensBurned > 0n;

    console.log("─".repeat(70));
    console.log("RESULT");
    console.log("─".repeat(70));

    if (feesApplied) {
        console.log("✅ FEES WERE APPLIED!");
        const totalFees = foundationReceived + tokensBurned;
        const totalOutput = tokensReceived + totalFees;
        console.log(`   Total fees: ${ethers.formatEther(totalFees)} (${(Number(totalFees) / Number(totalOutput) * 100).toFixed(2)}%)`);
    } else {
        console.log("❌ NO FEES APPLIED");
        if (!pairIsSet) {
            console.log("   Reason: pairIsSet is false");
        } else {
            console.log("   Reason: Possibly wrong pair address set");
        }
    }
    console.log("");

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
