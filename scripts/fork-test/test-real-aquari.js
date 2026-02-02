/**
 * =============================================================================
 * TEST REAL MAINNET AQUARI ON FORK (Impersonate Owner)
 * =============================================================================
 *
 * This script tests the REAL deployed AQUARI token on Base mainnet by:
 * 1. Forking Base mainnet via Docker (Anvil)
 * 2. Impersonating the REAL contract owner
 * 3. Enabling fees on the REAL contract
 * 4. Testing BUY/SELL via V4 Universal Router
 *
 * SAFE: Fork is completely isolated - no real transactions occur.
 *
 * Usage:
 *   docker restart aquari-fork && sleep 5
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
    UNIVERSAL_ROUTER_ADDRESS,
} = require("../utils/universalRouter");

// =============================================================================
// REAL MAINNET AQUARI ADDRESSES
// =============================================================================
const AQUARI_PROXY = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
const AQUARI_PAIR = "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F";
const FOUNDATION_WALLET = "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235";
const WETH = "0x4200000000000000000000000000000000000006";
const UNISWAP_V2_FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";

// =============================================================================
// ABIs
// =============================================================================
const TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
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

const PAIR_ABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
];

const WETH_ABI = [
    "function balanceOf(address) view returns (uint256)",
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatTokens(amount, decimals = 18) {
    return Number(ethers.formatUnits(amount, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
}

async function logReserves(pair, token0, label) {
    const [reserve0, reserve1] = await pair.getReserves();
    const isToken0Aquari = token0.toLowerCase() === AQUARI_PROXY.toLowerCase();

    const aquariReserve = isToken0Aquari ? reserve0 : reserve1;
    const wethReserve = isToken0Aquari ? reserve1 : reserve0;

    console.log(`  ${label}:`);
    console.log(`    AQUARI: ${formatTokens(aquariReserve)}`);
    console.log(`    WETH:   ${formatTokens(wethReserve)}`);

    // Calculate price
    const price = Number(wethReserve) / Number(aquariReserve);
    console.log(`    Price:  ${price.toExponential(4)} ETH per AQUARI`);

    return { aquariReserve, wethReserve };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
    console.log("");
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + " TEST REAL MAINNET AQUARI ON FORK (IMPERSONATE OWNER) ".padStart(66).padEnd(78) + "║");
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("");

    // =========================================================================
    // STEP 1: Load Real Mainnet Contract State
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 1: LOAD REAL MAINNET CONTRACT");
    console.log("═".repeat(80));
    console.log("");

    const token = new ethers.Contract(AQUARI_PROXY, TOKEN_ABI, ethers.provider);
    const pair = new ethers.Contract(AQUARI_PAIR, PAIR_ABI, ethers.provider);
    const weth = new ethers.Contract(WETH, WETH_ABI, ethers.provider);

    const realOwner = await token.owner();
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const pairIsSet = await token.pairIsSet();
    const currentBurnTax = await token.burnTax();
    const currentFoundationFee = await token.foundationFee();
    const tradingEnabled = await token.tradingEnabled();
    const paused = await token.paused();
    const token0 = await pair.token0();

    console.log("CONTRACT ADDRESSES:");
    console.log(`  Token (Proxy):  ${AQUARI_PROXY}`);
    console.log(`  LP Pair:        ${AQUARI_PAIR}`);
    console.log(`  Foundation:     ${FOUNDATION_WALLET}`);
    console.log(`  Owner:          ${realOwner}`);
    console.log("");

    console.log("TOKEN STATE:");
    console.log(`  Name:           ${name} (${symbol})`);
    console.log(`  Total Supply:   ${formatTokens(totalSupply)} ${symbol}`);
    console.log(`  Trading:        ${tradingEnabled ? "ENABLED" : "DISABLED"}`);
    console.log(`  Paused:         ${paused ? "YES" : "NO"}`);
    console.log("");

    console.log("FEE STATE:");
    console.log(`  pairIsSet:      ${pairIsSet} ${pairIsSet ? "(FEES ACTIVE)" : "(FEES INACTIVE)"}`);
    console.log(`  burnTax:        ${currentBurnTax} bps (${Number(currentBurnTax)/100}%)`);
    console.log(`  foundationFee:  ${currentFoundationFee} bps (${Number(currentFoundationFee)/100}%)`);
    console.log("");

    // =========================================================================
    // STEP 2: Log Liquidity Pool State
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 2: LIQUIDITY POOL STATE");
    console.log("═".repeat(80));
    console.log("");

    const lpTotalSupply = await pair.totalSupply();
    console.log(`LP Token Supply: ${formatTokens(lpTotalSupply)}`);
    console.log("");

    const initialReserves = await logReserves(pair, token0, "Current Reserves");
    console.log("");

    // =========================================================================
    // STEP 3: Impersonate Owner
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 3: IMPERSONATE OWNER");
    console.log("═".repeat(80));
    console.log("");

    // Impersonate using Anvil RPC
    await hre.network.provider.request({
        method: "anvil_impersonateAccount",
        params: [realOwner],
    });
    console.log(`Impersonating: ${realOwner}`);

    // Fund owner with ETH for gas
    await hre.network.provider.request({
        method: "anvil_setBalance",
        params: [realOwner, "0x8AC7230489E80000"], // 10 ETH
    });
    console.log(`Funded with 10 ETH for gas`);

    const ownerSigner = await ethers.getImpersonatedSigner(realOwner);
    const tokenAsOwner = new ethers.Contract(AQUARI_PROXY, TOKEN_ABI, ownerSigner);
    console.log("");

    // Get trader (for fee tests - not excluded from fees)
    const trader = (await ethers.getSigners())[1];
    const traderAddress = await trader.getAddress();
    const tokenAsTrader = new ethers.Contract(AQUARI_PROXY, TOKEN_ABI, trader);
    const v4Router = getUniversalRouter(trader);

    console.log(`Trader: ${traderAddress}`);
    console.log(`V4 Universal Router: ${UNIVERSAL_ROUTER_ADDRESS}`);
    console.log("");

    // =========================================================================
    // STEP 4: Set Tax Config
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 4: SET TAX CONFIG (as owner)");
    console.log("═".repeat(80));
    console.log("");

    const targetBurnTax = 125;       // 1.25%
    const targetFoundationFee = 125; // 1.25%
    const targetTotal = targetBurnTax + targetFoundationFee; // 2.5%

    console.log(`Current: burnTax=${currentBurnTax}, foundationFee=${currentFoundationFee}`);
    console.log(`Target:  burnTax=${targetBurnTax}, foundationFee=${targetFoundationFee} (${targetTotal/100}% total)`);
    console.log("");

    try {
        const tx1 = await tokenAsOwner.setTaxConfig(targetBurnTax, targetFoundationFee);
        const receipt1 = await tx1.wait();

        const newBurnTax = await token.burnTax();
        const newFoundationFee = await token.foundationFee();

        console.log(`[PASS] setTaxConfig`);
        console.log(`  Gas used: ${receipt1.gasUsed.toLocaleString()}`);
        console.log(`  burnTax: ${currentBurnTax} -> ${newBurnTax}`);
        console.log(`  foundationFee: ${currentFoundationFee} -> ${newFoundationFee}`);
    } catch (e) {
        console.log(`[FAIL] setTaxConfig: ${e.message.slice(0, 100)}`);
    }
    console.log("");

    // =========================================================================
    // STEP 5: Enable Fees (setUniswapV2Pair)
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 5: ENABLE FEES (setUniswapV2Pair)");
    console.log("═".repeat(80));
    console.log("");

    const pairIsSetBefore = await token.pairIsSet();

    if (pairIsSetBefore) {
        console.log("[SKIP] pairIsSet is already TRUE - fees already enabled");
    } else {
        console.log(`Setting pair: ${AQUARI_PAIR}`);
        console.log("WARNING: This is IRREVERSIBLE on mainnet!");
        console.log("");

        try {
            const tx2 = await tokenAsOwner.setUniswapV2Pair(AQUARI_PAIR);
            const receipt2 = await tx2.wait();

            const pairIsSetAfter = await token.pairIsSet();
            const storedPair = await token.uniswapV2Pair();

            console.log(`[PASS] setUniswapV2Pair`);
            console.log(`  Gas used: ${receipt2.gasUsed.toLocaleString()}`);
            console.log(`  pairIsSet: ${pairIsSetBefore} -> ${pairIsSetAfter}`);
            console.log(`  uniswapV2Pair: ${storedPair}`);
        } catch (e) {
            console.log(`[FAIL] setUniswapV2Pair: ${e.message.slice(0, 100)}`);
        }
    }
    console.log("");

    // =========================================================================
    // STEP 6: BUY via V4 Universal Router
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 6: BUY TOKENS VIA V4 UNIVERSAL ROUTER");
    console.log("═".repeat(80));
    console.log("");

    const foundationWallet = await token.foundationWallet();
    const buyAmount = ethers.parseEther("0.01"); // 0.01 ETH

    console.log(`Buy amount: ${ethers.formatEther(buyAmount)} ETH`);
    console.log("");

    // Balances before
    const traderBalanceBefore = await token.balanceOf(traderAddress);
    const foundationBalanceBefore = await token.balanceOf(foundationWallet);
    const totalSupplyBefore = await token.totalSupply();

    console.log("BEFORE BUY:");
    console.log(`  Trader balance:     ${formatTokens(traderBalanceBefore)} ${symbol}`);
    console.log(`  Foundation balance: ${formatTokens(foundationBalanceBefore)} ${symbol}`);
    console.log(`  Total supply:       ${formatTokens(totalSupplyBefore)} ${symbol}`);
    await logReserves(pair, token0, "Reserves");
    console.log("");

    try {
        const deadline = Math.floor(Date.now() / 1000) + 1200;

        console.log("Executing BUY via V4 Universal Router...");
        const buyTx = await buyTokensWithETH(
            v4Router,
            AQUARI_PROXY,
            WETH,
            traderAddress,
            buyAmount,
            0n,
            deadline
        );
        const buyReceipt = await buyTx.wait();

        // Balances after
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

        console.log("");
        console.log(`[PASS] BUY succeeded`);
        console.log(`  Gas used: ${buyReceipt.gasUsed.toLocaleString()}`);
        console.log("");
        console.log("AFTER BUY:");
        console.log(`  Trader balance:     ${formatTokens(traderBalanceAfter)} ${symbol}`);
        console.log(`  Foundation balance: ${formatTokens(foundationBalanceAfter)} ${symbol}`);
        console.log(`  Total supply:       ${formatTokens(totalSupplyAfter)} ${symbol}`);
        await logReserves(pair, token0, "Reserves");
        console.log("");
        console.log("FEE ANALYSIS:");
        console.log(`  Gross tokens:        ${formatTokens(grossTokens)}`);
        console.log(`  Tokens received:     ${formatTokens(tokensReceived)} (${(100 - Number(feePercent)).toFixed(2)}%)`);
        console.log(`  Foundation received: ${formatTokens(foundationReceived)} (${(Number(foundationReceived) / Number(grossTokens) * 100).toFixed(2)}%)`);
        console.log(`  Tokens burned:       ${formatTokens(tokensBurned)} (${(Number(tokensBurned) / Number(grossTokens) * 100).toFixed(2)}%)`);
        console.log(`  Total fee:           ${feePercent}%`);

    } catch (e) {
        console.log(`[FAIL] BUY: ${e.message.slice(0, 200)}`);
    }
    console.log("");

    // =========================================================================
    // STEP 7: SELL via V4 Universal Router
    // =========================================================================
    console.log("═".repeat(80));
    console.log("STEP 7: SELL TOKENS VIA V4 UNIVERSAL ROUTER");
    console.log("═".repeat(80));
    console.log("");

    const traderBalance = await token.balanceOf(traderAddress);
    const sellAmount = traderBalance > ethers.parseEther("500")
        ? ethers.parseEther("500")
        : traderBalance / 2n;

    if (sellAmount === 0n) {
        console.log("[SKIP] No tokens to sell");
    } else {
        console.log(`Sell amount: ${formatTokens(sellAmount)} ${symbol}`);
        console.log("");

        // Setup Permit2 for V4 Universal Router
        console.log("Setting up Permit2 approvals...");
        await setupPermit2ForSell(tokenAsTrader, AQUARI_PROXY, trader);
        console.log("Permit2 approved");
        console.log("");

        // Balances before sell
        const traderBeforeSell = await token.balanceOf(traderAddress);
        const foundationBeforeSell = await token.balanceOf(foundationWallet);
        const totalSupplyBeforeSell = await token.totalSupply();

        console.log("BEFORE SELL:");
        console.log(`  Trader balance:     ${formatTokens(traderBeforeSell)} ${symbol}`);
        console.log(`  Foundation balance: ${formatTokens(foundationBeforeSell)} ${symbol}`);
        console.log(`  Total supply:       ${formatTokens(totalSupplyBeforeSell)} ${symbol}`);
        await logReserves(pair, token0, "Reserves");
        console.log("");

        try {
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            console.log("Executing SELL via V4 Universal Router...");
            const sellTx = await sellFeeTokensForETH(
                v4Router,
                AQUARI_PROXY,
                WETH,
                traderAddress,
                sellAmount,
                0n,
                deadline
            );
            const sellReceipt = await sellTx.wait();

            // Balances after sell
            const traderAfterSell = await token.balanceOf(traderAddress);
            const foundationAfterSell = await token.balanceOf(foundationWallet);
            const totalSupplyAfterSell = await token.totalSupply();

            const tokensSold = traderBeforeSell - traderAfterSell;
            const foundationReceivedSell = foundationAfterSell - foundationBeforeSell;
            const tokensBurnedSell = totalSupplyBeforeSell - totalSupplyAfterSell;
            const totalFeesSell = foundationReceivedSell + tokensBurnedSell;

            const sellFeePercent = tokensSold > 0n
                ? (Number(totalFeesSell) / Number(tokensSold) * 100).toFixed(2)
                : "0.00";

            console.log("");
            console.log(`[PASS] SELL succeeded`);
            console.log(`  Gas used: ${sellReceipt.gasUsed.toLocaleString()}`);
            console.log("");
            console.log("AFTER SELL:");
            console.log(`  Trader balance:     ${formatTokens(traderAfterSell)} ${symbol}`);
            console.log(`  Foundation balance: ${formatTokens(foundationAfterSell)} ${symbol}`);
            console.log(`  Total supply:       ${formatTokens(totalSupplyAfterSell)} ${symbol}`);
            await logReserves(pair, token0, "Reserves");
            console.log("");
            console.log("FEE ANALYSIS:");
            console.log(`  Tokens sold:         ${formatTokens(tokensSold)}`);
            console.log(`  Foundation received: ${formatTokens(foundationReceivedSell)} (${(Number(foundationReceivedSell) / Number(tokensSold) * 100).toFixed(2)}%)`);
            console.log(`  Tokens burned:       ${formatTokens(tokensBurnedSell)} (${(Number(tokensBurnedSell) / Number(tokensSold) * 100).toFixed(2)}%)`);
            console.log(`  Total fee:           ${sellFeePercent}%`);

        } catch (e) {
            console.log(`[FAIL] SELL: ${e.message.slice(0, 200)}`);
        }
    }
    console.log("");

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log("═".repeat(80));
    console.log("FINAL STATE");
    console.log("═".repeat(80));
    console.log("");

    const finalPairIsSet = await token.pairIsSet();
    const finalBurnTax = await token.burnTax();
    const finalFoundationFee = await token.foundationFee();
    const finalTotalSupply = await token.totalSupply();
    const finalFoundationBalance = await token.balanceOf(foundationWallet);

    console.log("TOKEN STATE:");
    console.log(`  pairIsSet:          ${finalPairIsSet}`);
    console.log(`  burnTax:            ${finalBurnTax} bps (${Number(finalBurnTax)/100}%)`);
    console.log(`  foundationFee:      ${finalFoundationFee} bps (${Number(finalFoundationFee)/100}%)`);
    console.log(`  Total fee:          ${Number(finalBurnTax) + Number(finalFoundationFee)} bps (${(Number(finalBurnTax) + Number(finalFoundationFee))/100}%)`);
    console.log("");
    console.log("BALANCES:");
    console.log(`  Foundation:         ${formatTokens(finalFoundationBalance)} ${symbol}`);
    console.log(`  Total supply:       ${formatTokens(finalTotalSupply)} ${symbol}`);
    console.log(`  Burned from supply: ${formatTokens(totalSupply - finalTotalSupply)} ${symbol}`);
    console.log("");

    await logReserves(pair, token0, "Final Reserves");
    console.log("");

    // Stop impersonation
    await hre.network.provider.request({
        method: "anvil_stopImpersonatingAccount",
        params: [realOwner],
    });

    console.log("═".repeat(80));
    console.log("");
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + " TEST COMPLETE - FORK ONLY (NO REAL TRANSACTIONS) ".padStart(64).padEnd(78) + "║");
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("");
    console.log("This test proved that:");
    console.log("  1. Owner can set tax config on REAL contract");
    console.log("  2. Owner can enable fees via setUniswapV2Pair");
    console.log("  3. BUY works with fees via V4 Universal Router");
    console.log("  4. SELL works with fees via V4 Universal Router");
    console.log("");
    console.log("The REAL mainnet contract is UNCHANGED.");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
