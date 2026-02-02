/**
 * =============================================================================
 * TEST REAL AQUARI ON FORK (Impersonate Owner)
 * =============================================================================
 *
 * This script impersonates the REAL owner of mainnet AQUARI on a fork
 * to test fee enablement on the actual deployed contract.
 *
 * SAFE: Fork is isolated - no real transactions occur.
 *
 * Usage:
 *   docker restart aquari-fork
 *   npx hardhat run scripts/fork-test/test-real-aquari.js --network fork
 *
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers } = hre;
const {
    getUniversalRouter,
    buyTokensWithETH,
    sellFeeTokensForETH,
    setupPermit2ForSell,
} = require("../utils/universalRouter");

// REAL Mainnet AQUARI
const AQUARI_PROXY = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
const AQUARI_PAIR = "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F";
const FOUNDATION_WALLET = "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235";
const WETH = "0x4200000000000000000000000000000000000006";

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
    "function tradingEnabled() view returns (bool)",
    "function paused() view returns (bool)",
    "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee)",
    "function setUniswapV2Pair(address newPairAddress)",
    "function setFoundationWallet(address newWallet)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
];

async function main() {
    console.log("");
    console.log("=".repeat(70));
    console.log("TEST REAL AQUARI ON FORK (IMPERSONATE OWNER)");
    console.log("=".repeat(70));
    console.log("");

    // Get the real owner
    const token = new ethers.Contract(AQUARI_PROXY, TOKEN_ABI, ethers.provider);
    const realOwner = await token.owner();

    console.log("MAINNET AQUARI CONTRACT:");
    console.log(`  Proxy:       ${AQUARI_PROXY}`);
    console.log(`  Owner:       ${realOwner}`);
    console.log(`  Pair:        ${AQUARI_PAIR}`);
    console.log(`  Foundation:  ${FOUNDATION_WALLET}`);
    console.log("");

    // Check current state
    const name = await token.name();
    const symbol = await token.symbol();
    const pairIsSet = await token.pairIsSet();
    const currentBurnTax = await token.burnTax();
    const currentFoundationFee = await token.foundationFee();
    const tradingEnabled = await token.tradingEnabled();
    const paused = await token.paused();

    console.log("CURRENT STATE:");
    console.log(`  Name:           ${name} (${symbol})`);
    console.log(`  pairIsSet:      ${pairIsSet}`);
    console.log(`  burnTax:        ${currentBurnTax} bps`);
    console.log(`  foundationFee:  ${currentFoundationFee} bps`);
    console.log(`  tradingEnabled: ${tradingEnabled}`);
    console.log(`  paused:         ${paused}`);
    console.log("");

    if (pairIsSet) {
        console.log("WARNING: pairIsSet is already TRUE on mainnet!");
        console.log("Fees are already enabled. Testing current state...");
        console.log("");
    }

    // Impersonate the owner using direct RPC calls
    console.log("=".repeat(70));
    console.log("IMPERSONATING OWNER");
    console.log("=".repeat(70));
    console.log("");

    // Use hre.network.provider.request for direct RPC access (bypasses Hardhat's account management)
    // Try Anvil RPC first, then Hardhat RPC
    let isAnvil = false;

    try {
        await hre.network.provider.request({
            method: "anvil_impersonateAccount",
            params: [realOwner],
        });
        isAnvil = true;
        console.log("Anvil impersonation enabled");
    } catch (e) {
        try {
            await hre.network.provider.request({
                method: "hardhat_impersonateAccount",
                params: [realOwner],
            });
            console.log("Hardhat impersonation enabled");
        } catch (e2) {
            console.log("ERROR: Could not impersonate account");
            console.log("  Anvil error:", e.message?.slice(0, 80));
            console.log("  Hardhat error:", e2.message?.slice(0, 80));
            process.exit(1);
        }
    }

    // Fund the owner with ETH for gas
    if (isAnvil) {
        // Anvil method - set balance directly
        await hre.network.provider.request({
            method: "anvil_setBalance",
            params: [realOwner, "0x8AC7230489E80000"], // 10 ETH in hex
        });
        console.log(`Set owner balance to 10 ETH (Anvil)`);
    } else {
        // Hardhat fallback - send ETH from funded account
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: realOwner,
            value: ethers.parseEther("10"),
        });
        console.log(`Funded owner with 10 ETH (Hardhat)`);
    }

    // Get signer for impersonated account using Hardhat's helper
    const ownerSigner = await ethers.getImpersonatedSigner(realOwner);
    const tokenAsOwner = new ethers.Contract(AQUARI_PROXY, TOKEN_ABI, ownerSigner);

    console.log(`Impersonating: ${realOwner}`);
    console.log("");

    // Get trader (non-owner, not excluded from fees)
    const signers = await ethers.getSigners();
    const trader = signers[1];
    const traderAddress = await trader.getAddress();
    const tokenAsTrader = new ethers.Contract(AQUARI_PROXY, TOKEN_ABI, trader);
    const v4Router = getUniversalRouter(trader);

    console.log(`Trader: ${traderAddress} (for fee tests)`);
    console.log("");

    // =========================================================================
    // TEST 1: Set Tax Config (if owner)
    // =========================================================================
    console.log("=".repeat(70));
    console.log("TEST 1: SET TAX CONFIG");
    console.log("=".repeat(70));
    console.log("");

    const targetBurnTax = 125;      // 1.25%
    const targetFoundationFee = 125; // 1.25%

    console.log(`Setting fees: burnTax=${targetBurnTax}, foundationFee=${targetFoundationFee}`);

    try {
        const tx1 = await tokenAsOwner.setTaxConfig(targetBurnTax, targetFoundationFee);
        await tx1.wait();

        const newBurnTax = await token.burnTax();
        const newFoundationFee = await token.foundationFee();

        console.log(`[PASS] setTaxConfig succeeded`);
        console.log(`  burnTax:        ${currentBurnTax} -> ${newBurnTax}`);
        console.log(`  foundationFee:  ${currentFoundationFee} -> ${newFoundationFee}`);
    } catch (e) {
        console.log(`[FAIL] setTaxConfig failed: ${e.message.slice(0, 100)}`);
    }
    console.log("");

    // =========================================================================
    // TEST 2: Set Uniswap V2 Pair (enables fees)
    // =========================================================================
    console.log("=".repeat(70));
    console.log("TEST 2: SET UNISWAP V2 PAIR (ENABLE FEES)");
    console.log("=".repeat(70));
    console.log("");

    const pairIsSetBefore = await token.pairIsSet();

    if (pairIsSetBefore) {
        console.log("[SKIP] pairIsSet is already TRUE - fees already enabled");
    } else {
        console.log(`Setting pair: ${AQUARI_PAIR}`);

        try {
            const tx2 = await tokenAsOwner.setUniswapV2Pair(AQUARI_PAIR);
            await tx2.wait();

            const pairIsSetAfter = await token.pairIsSet();
            const storedPair = await token.uniswapV2Pair();

            console.log(`[PASS] setUniswapV2Pair succeeded`);
            console.log(`  pairIsSet: ${pairIsSetBefore} -> ${pairIsSetAfter}`);
            console.log(`  uniswapV2Pair: ${storedPair}`);
        } catch (e) {
            console.log(`[FAIL] setUniswapV2Pair failed: ${e.message.slice(0, 100)}`);
        }
    }
    console.log("");

    // =========================================================================
    // TEST 3: BUY via V4 Universal Router
    // =========================================================================
    console.log("=".repeat(70));
    console.log("TEST 3: BUY TOKENS VIA V4 UNIVERSAL ROUTER");
    console.log("=".repeat(70));
    console.log("");

    const foundationWallet = await token.foundationWallet();
    const buyAmount = ethers.parseEther("0.01"); // 0.01 ETH

    const traderBalanceBefore = await token.balanceOf(traderAddress);
    const foundationBalanceBefore = await token.balanceOf(foundationWallet);
    const totalSupplyBefore = await token.totalSupply();

    console.log(`Buying with ${ethers.formatEther(buyAmount)} ETH...`);
    console.log("");

    try {
        const deadline = Math.floor(Date.now() / 1000) + 1200;

        const buyTx = await buyTokensWithETH(
            v4Router,
            AQUARI_PROXY,
            WETH,
            traderAddress,
            buyAmount,
            0n,
            deadline
        );
        await buyTx.wait();

        const traderBalanceAfter = await token.balanceOf(traderAddress);
        const foundationBalanceAfter = await token.balanceOf(foundationWallet);
        const totalSupplyAfter = await token.totalSupply();

        const tokensReceived = traderBalanceAfter - traderBalanceBefore;
        const foundationReceived = foundationBalanceAfter - foundationBalanceBefore;
        const tokensBurned = totalSupplyBefore - totalSupplyAfter;
        const totalFees = foundationReceived + tokensBurned;
        const grossTokens = tokensReceived + totalFees;

        const feePercent = grossTokens > 0n
            ? (Number(totalFees) / Number(grossTokens) * 100).toFixed(2)
            : "0.00";

        console.log(`[PASS] BUY succeeded via V4 Universal Router`);
        console.log("");
        console.log("BALANCES:");
        console.log(`  Tokens received:     ${ethers.formatEther(tokensReceived)}`);
        console.log(`  Foundation received: ${ethers.formatEther(foundationReceived)}`);
        console.log(`  Tokens burned:       ${ethers.formatEther(tokensBurned)}`);
        console.log(`  Total fees:          ${ethers.formatEther(totalFees)} (${feePercent}%)`);
        console.log("");

        if (totalFees > 0n) {
            console.log(`  Result: FEES APPLIED (${feePercent}%)`);
        } else {
            console.log(`  Result: NO FEES (pairIsSet may be false or trader excluded)`);
        }

    } catch (e) {
        console.log(`[FAIL] BUY failed: ${e.message.slice(0, 200)}`);
    }
    console.log("");

    // =========================================================================
    // TEST 4: SELL via V4 Universal Router
    // =========================================================================
    console.log("=".repeat(70));
    console.log("TEST 4: SELL TOKENS VIA V4 UNIVERSAL ROUTER");
    console.log("=".repeat(70));
    console.log("");

    const traderBalance = await token.balanceOf(traderAddress);
    const sellAmount = traderBalance > ethers.parseEther("100")
        ? ethers.parseEther("100")
        : traderBalance / 2n;

    if (sellAmount === 0n) {
        console.log("[SKIP] No tokens to sell");
    } else {
        console.log(`Selling ${ethers.formatEther(sellAmount)} tokens...`);
        console.log("");

        // Setup Permit2
        console.log("Setting up Permit2 approvals...");
        await setupPermit2ForSell(tokenAsTrader, AQUARI_PROXY, trader);

        const traderBalanceBeforeSell = await token.balanceOf(traderAddress);
        const foundationBeforeSell = await token.balanceOf(foundationWallet);
        const totalSupplyBeforeSell = await token.totalSupply();

        try {
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            const sellTx = await sellFeeTokensForETH(
                v4Router,
                AQUARI_PROXY,
                WETH,
                traderAddress,
                sellAmount,
                0n,
                deadline
            );
            await sellTx.wait();

            const traderBalanceAfterSell = await token.balanceOf(traderAddress);
            const foundationAfterSell = await token.balanceOf(foundationWallet);
            const totalSupplyAfterSell = await token.totalSupply();

            const tokensSold = traderBalanceBeforeSell - traderBalanceAfterSell;
            const foundationReceivedSell = foundationAfterSell - foundationBeforeSell;
            const tokensBurnedSell = totalSupplyBeforeSell - totalSupplyAfterSell;
            const totalFeesSell = foundationReceivedSell + tokensBurnedSell;

            const sellFeePercent = tokensSold > 0n
                ? (Number(totalFeesSell) / Number(tokensSold) * 100).toFixed(2)
                : "0.00";

            console.log(`[PASS] SELL succeeded via V4 Universal Router`);
            console.log("");
            console.log("BALANCES:");
            console.log(`  Tokens sold:         ${ethers.formatEther(tokensSold)}`);
            console.log(`  Foundation received: ${ethers.formatEther(foundationReceivedSell)}`);
            console.log(`  Tokens burned:       ${ethers.formatEther(tokensBurnedSell)}`);
            console.log(`  Total fees:          ${ethers.formatEther(totalFeesSell)} (${sellFeePercent}%)`);
            console.log("");

            if (totalFeesSell > 0n) {
                console.log(`  Result: FEES APPLIED (${sellFeePercent}%)`);
            } else {
                console.log(`  Result: NO FEES`);
            }

        } catch (e) {
            console.log(`[FAIL] SELL failed: ${e.message.slice(0, 200)}`);
        }
    }
    console.log("");

    // =========================================================================
    // FINAL STATE
    // =========================================================================
    console.log("=".repeat(70));
    console.log("FINAL STATE");
    console.log("=".repeat(70));
    console.log("");

    const finalPairIsSet = await token.pairIsSet();
    const finalBurnTax = await token.burnTax();
    const finalFoundationFee = await token.foundationFee();
    const finalTotalSupply = await token.totalSupply();
    const finalFoundationBalance = await token.balanceOf(foundationWallet);

    console.log(`  pairIsSet:          ${finalPairIsSet}`);
    console.log(`  burnTax:            ${finalBurnTax} bps (${Number(finalBurnTax)/100}%)`);
    console.log(`  foundationFee:      ${finalFoundationFee} bps (${Number(finalFoundationFee)/100}%)`);
    console.log(`  Total fee:          ${Number(finalBurnTax) + Number(finalFoundationFee)} bps (${(Number(finalBurnTax) + Number(finalFoundationFee))/100}%)`);
    console.log(`  Foundation balance: ${ethers.formatEther(finalFoundationBalance)}`);
    console.log(`  Total supply:       ${ethers.formatEther(finalTotalSupply)}`);
    console.log("");

    // Stop impersonation
    try {
        await hre.network.provider.request({
            method: "anvil_stopImpersonatingAccount",
            params: [realOwner],
        });
    } catch (e) {
        await hre.network.provider.request({
            method: "hardhat_stopImpersonatingAccount",
            params: [realOwner],
        });
    }
    console.log("Stopped impersonating owner");
    console.log("");

    console.log("=".repeat(70));
    console.log("TEST COMPLETE");
    console.log("=".repeat(70));
    console.log("");
    console.log("This was a FORK TEST - no real transactions occurred.");
    console.log("The real mainnet contract is unchanged.");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
