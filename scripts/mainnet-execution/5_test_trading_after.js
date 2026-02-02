/**
 * =============================================================================
 * MAINNET STEP 5: Test Trading AFTER Fees Enabled
 * =============================================================================
 *
 * This script tests BUY/SELL on the REAL mainnet AQUARI contract
 * AFTER fees are enabled (pairIsSet = true).
 *
 * EXPECTED: 2.5% fees on all trades (1.25% burn + 1.25% foundation)
 *
 * RUN AFTER: 3_enable_fees.js and 4_verify_after.js
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers } = hre;
const { MAINNET, NETWORKS, getMainnetSigner } = require("../config");
const {
    getUniversalRouter,
    buyTokensWithETH,
    sellFeeTokensForETH,
    setupPermit2ForSell,
} = require("../utils/universalRouter");

// =============================================================================
// COLORS & FORMATTING
// =============================================================================
const c = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgRed: "\x1b[41m",
};

const fmt = {
    title: (s) => `${c.bright}${c.cyan}${s}${c.reset}`,
    success: (s) => `${c.bright}${c.green}${s}${c.reset}`,
    fail: (s) => `${c.bright}${c.red}${s}${c.reset}`,
    warn: (s) => `${c.bright}${c.yellow}${s}${c.reset}`,
    info: (s) => `${c.blue}${s}${c.reset}`,
    num: (s) => `${c.bright}${c.yellow}${s}${c.reset}`,
    addr: (s) => `${c.dim}${s}${c.reset}`,
    highlight: (s) => `${c.bright}${c.magenta}${s}${c.reset}`,
};

// =============================================================================
// CONSTANTS
// =============================================================================
const WETH = NETWORKS.base.weth;
const EXPECTED_FEE_PERCENT = 2.5;
const FEE_TOLERANCE = 0.1; // Allow 0.1% tolerance

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
    "function approve(address spender, uint256 amount) returns (bool)",
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function totalSupply() view returns (uint256)",
];

// =============================================================================
// HELPERS
// =============================================================================
function formatNum(amount, decimals = 18) {
    const num = Number(ethers.formatUnits(amount, decimals));
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function printBox(title, color = c.cyan) {
    const line = "═".repeat(78);
    console.log(`\n${color}╔${line}╗${c.reset}`);
    console.log(`${color}║${c.reset}${c.bright} ${title.padEnd(76)} ${color}║${c.reset}`);
    console.log(`${color}╚${line}╝${c.reset}`);
}

function printSection(title) {
    console.log(`\n${c.bright}${c.white}▶ ${title}${c.reset}`);
    console.log(`${c.dim}${"─".repeat(60)}${c.reset}`);
}

function printTable(rows) {
    const colWidths = [22, 22, 18];
    console.log(`${c.dim}┌${"─".repeat(colWidths[0])}┬${"─".repeat(colWidths[1])}┬${"─".repeat(colWidths[2])}┐${c.reset}`);
    rows.forEach((row, i) => {
        if (i === 0) {
            console.log(`${c.dim}│${c.reset}${c.bright}${row[0].padEnd(colWidths[0])}${c.reset}${c.dim}│${c.reset}${c.bright}${row[1].padEnd(colWidths[1])}${c.reset}${c.dim}│${c.reset}${c.bright}${row[2].padEnd(colWidths[2])}${c.reset}${c.dim}│${c.reset}`);
            console.log(`${c.dim}├${"─".repeat(colWidths[0])}┼${"─".repeat(colWidths[1])}┼${"─".repeat(colWidths[2])}┤${c.reset}`);
        } else {
            console.log(`${c.dim}│${c.reset}${row[0].padEnd(colWidths[0])}${c.dim}│${c.reset}${c.yellow}${row[1].padEnd(colWidths[1])}${c.reset}${c.dim}│${c.reset}${c.cyan}${row[2].padEnd(colWidths[2])}${c.reset}${c.dim}│${c.reset}`);
        }
    });
    console.log(`${c.dim}└${"─".repeat(colWidths[0])}┴${"─".repeat(colWidths[1])}┴${"─".repeat(colWidths[2])}┘${c.reset}`);
}

async function getReserves(pair, token0, tokenAddress) {
    const [reserve0, reserve1] = await pair.getReserves();
    const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
    return {
        token: isToken0 ? reserve0 : reserve1,
        weth: isToken0 ? reserve1 : reserve0,
    };
}

function printReserves(reserves, label, symbol) {
    const price = Number(reserves.weth) / Number(reserves.token);
    console.log(`  ${c.bright}${label}:${c.reset}`);
    console.log(`    ${symbol}: ${fmt.num(formatNum(reserves.token))}`);
    console.log(`    WETH:   ${fmt.num(formatNum(reserves.weth))}`);
    console.log(`    Price:  ${fmt.highlight(price.toExponential(4))} ETH/${symbol}`);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
    // Get signer (impersonated on fork, real on mainnet)
    const { signer: ownerSigner, isFork } = await getMainnetSigner(hre);

    const modeLabel = isFork ? "FORK TEST" : "MAINNET";
    const modeColor = isFork ? c.blue : c.red;

    printBox(`${modeLabel} STEP 5: TEST TRADING AFTER FEES`, modeColor);
    console.log(`\n  ${fmt.info("Expected:")} ${fmt.num(EXPECTED_FEE_PERCENT + "%")} fee (pairIsSet = true)`);

    // ==========================================================================
    // LOAD CONTRACT & CHECK STATE
    // ==========================================================================
    printBox("STEP 1: VERIFY PRECONDITIONS", c.blue);

    const token = new ethers.Contract(MAINNET.token.address, TOKEN_ABI, ethers.provider);
    const symbol = await token.symbol();

    const pairIsSet = await token.pairIsSet();
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();
    const totalFee = Number(burnTax) + Number(foundationFee);

    printSection("Contract State");
    console.log(`  Token:          ${fmt.addr(MAINNET.token.address)}`);
    console.log(`  pairIsSet:      ${pairIsSet ? fmt.success("TRUE (FEES ACTIVE!)") : fmt.fail("FALSE (FEES INACTIVE)")}`);
    console.log(`  burnTax:        ${fmt.num(burnTax.toString())} bps (${Number(burnTax)/100}%)`);
    console.log(`  foundationFee:  ${fmt.num(foundationFee.toString())} bps (${Number(foundationFee)/100}%)`);
    console.log(`  ${c.bright}Total Fee:      ${fmt.highlight(totalFee + " bps")} (${totalFee/100}%)${c.reset}`);

    if (!pairIsSet) {
        console.log(`\n  ${fmt.fail("✗ ERROR: pairIsSet is FALSE!")}`);
        console.log(`  ${fmt.fail("  Fees are NOT active. Run 3_enable_fees.js first.")}`);
        process.exit(1);
    }

    console.log(`\n  ${fmt.success("✓ pairIsSet is TRUE - fees should be " + (totalFee/100) + "%")}`);

    // ==========================================================================
    // SETUP TRADER
    // ==========================================================================
    printBox("STEP 2: SETUP TRADER", c.blue);

    let trader;
    if (isFork) {
        // On fork, use a hardhat signer as trader (NOT owner - owner is excluded from fees)
        const signers = await ethers.getSigners();
        trader = signers[1];
        console.log(`  ${fmt.info("Using Account #1 as trader (not owner - to test fees)")}`);
    } else {
        // On mainnet, need a funded non-owner account
        // For testing purposes, we use owner but note fees won't apply to owner
        trader = ownerSigner;
        console.log(`  ${fmt.warn("⚠ Using owner as trader on mainnet")}`);
        console.log(`  ${fmt.warn("  Note: Owner may be excluded from fees!")}`);
    }

    const traderAddress = await trader.getAddress();
    const ownerAddress = await token.owner();
    const isTraderOwner = traderAddress.toLowerCase() === ownerAddress.toLowerCase();

    const tokenAsTrader = new ethers.Contract(MAINNET.token.address, TOKEN_ABI, trader);
    const v4Router = getUniversalRouter(trader);

    console.log(`  Trader:     ${fmt.addr(traderAddress)}`);
    console.log(`  Is Owner:   ${isTraderOwner ? fmt.warn("YES (may be excluded)") : fmt.success("NO (fees will apply)")}`);
    console.log(`  V4 Router:  ${fmt.addr(v4Router.target)}`);

    // Load pair contract
    const pair = new ethers.Contract(MAINNET.pair.address, PAIR_ABI, ethers.provider);
    const token0 = await pair.token0();

    // ==========================================================================
    // BUY TEST
    // ==========================================================================
    printBox("STEP 3: BUY TEST (V4 Universal Router)", c.green);

    const buyAmount = ethers.parseEther("0.01");
    console.log(`  ${fmt.info("Buy Amount:")} ${fmt.num("0.01")} ETH`);
    console.log(`  ${fmt.info("Expected Fee:")} ${fmt.num(EXPECTED_FEE_PERCENT + "%")} (1.25% burn + 1.25% foundation)`);

    // BEFORE BUY
    const buyBefore = {
        trader: await token.balanceOf(traderAddress),
        foundation: await token.balanceOf(foundationWallet),
        supply: await token.totalSupply(),
        reserves: await getReserves(pair, token0, MAINNET.token.address),
    };

    printSection("BEFORE BUY");
    printReserves(buyBefore.reserves, "LP Reserves", symbol);
    printTable([
        ["Account", "Balance", ""],
        ["Trader", formatNum(buyBefore.trader), symbol],
        ["Foundation", formatNum(buyBefore.foundation), symbol],
        ["Total Supply", formatNum(buyBefore.supply), symbol],
    ]);

    // Execute BUY
    console.log(`\n  ${fmt.info("Executing BUY...")}`);
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    try {
        const tx = await buyTokensWithETH(v4Router, MAINNET.token.address, WETH, traderAddress, buyAmount, 0n, deadline);
        const receipt = await tx.wait();
        console.log(`  ${fmt.success("✓ BUY SUCCEEDED")} (Gas: ${receipt.gasUsed.toLocaleString()})`);
    } catch (e) {
        console.log(`  ${fmt.fail("✗ BUY FAILED:")} ${e.message.slice(0, 100)}`);
        process.exit(1);
    }

    // AFTER BUY
    const buyAfter = {
        trader: await token.balanceOf(traderAddress),
        foundation: await token.balanceOf(foundationWallet),
        supply: await token.totalSupply(),
        reserves: await getReserves(pair, token0, MAINNET.token.address),
    };

    printSection("AFTER BUY");
    printReserves(buyAfter.reserves, "LP Reserves", symbol);
    printTable([
        ["Account", "Balance", "Change"],
        ["Trader", formatNum(buyAfter.trader), `+${formatNum(buyAfter.trader - buyBefore.trader)}`],
        ["Foundation", formatNum(buyAfter.foundation), `+${formatNum(buyAfter.foundation - buyBefore.foundation)}`],
        ["Total Supply", formatNum(buyAfter.supply), formatNum(buyAfter.supply - buyBefore.supply)],
    ]);

    // Fee Analysis
    const buyTokensReceived = buyAfter.trader - buyBefore.trader;
    const buyFoundationFee = buyAfter.foundation - buyBefore.foundation;
    const buyBurned = buyBefore.supply - buyAfter.supply;
    const buyTotalFee = buyFoundationFee + buyBurned;
    const buyGross = buyTokensReceived + buyTotalFee;
    const buyFeePercent = buyGross > 0n ? Number(buyTotalFee) / Number(buyGross) * 100 : 0;
    const buyFoundationPercent = buyGross > 0n ? Number(buyFoundationFee) / Number(buyGross) * 100 : 0;
    const buyBurnPercent = buyGross > 0n ? Number(buyBurned) / Number(buyGross) * 100 : 0;

    printSection("BUY FEE ANALYSIS");
    printTable([
        ["Metric", "Value", "Percent"],
        ["Gross Tokens", formatNum(buyGross), "100%"],
        ["Received", formatNum(buyTokensReceived), `${(100 - buyFeePercent).toFixed(2)}%`],
        ["→ Foundation", formatNum(buyFoundationFee), `${buyFoundationPercent.toFixed(2)}%`],
        ["→ Burned", formatNum(buyBurned), `${buyBurnPercent.toFixed(2)}%`],
        ["TOTAL FEE", formatNum(buyTotalFee), `${buyFeePercent.toFixed(2)}%`],
    ]);

    // Verify expected fee
    const buyPass = Math.abs(buyFeePercent - EXPECTED_FEE_PERCENT) < FEE_TOLERANCE;
    const buyFoundationPass = buyFoundationFee > 0n;
    const buyBurnPass = buyBurned > 0n;

    console.log(`\n  Foundation received: ${buyFoundationPass ? fmt.success("✓ YES") : fmt.fail("✗ NO")}`);
    console.log(`  Tokens burned:       ${buyBurnPass ? fmt.success("✓ YES") : fmt.fail("✗ NO")}`);
    console.log(`  Fee amount:          ${buyPass ? fmt.success(`✓ PASS (${buyFeePercent.toFixed(2)}%)`) : fmt.fail(`✗ FAIL (${buyFeePercent.toFixed(2)}%, expected ${EXPECTED_FEE_PERCENT}%)`)}`);

    // ==========================================================================
    // SELL TEST
    // ==========================================================================
    printBox("STEP 4: SELL TEST (V4 Universal Router)", c.yellow);

    const sellAmount = ethers.parseEther("500");
    console.log(`  ${fmt.info("Sell Amount:")} ${fmt.num("500")} ${symbol}`);
    console.log(`  ${fmt.info("Expected Fee:")} ${fmt.num(EXPECTED_FEE_PERCENT + "%")} (1.25% burn + 1.25% foundation)`);

    // Check balance
    const traderBalance = await token.balanceOf(traderAddress);
    if (traderBalance < sellAmount) {
        console.log(`\n  ${fmt.warn("⚠ Trader balance too low, adjusting sell amount")}`);
        console.log(`  ${fmt.info("  Balance:")} ${formatNum(traderBalance)} ${symbol}`);
    }
    const actualSellAmount = traderBalance < sellAmount ? traderBalance / 2n : sellAmount;

    if (actualSellAmount === 0n) {
        console.log(`\n  ${fmt.fail("✗ Cannot sell - trader has no tokens!")}`);
        process.exit(1);
    }

    // Setup Permit2
    console.log(`\n  ${fmt.info("Setting up Permit2...")}`);
    await setupPermit2ForSell(tokenAsTrader, MAINNET.token.address, trader);
    console.log(`  ${fmt.success("✓ Permit2 approved")}`);

    // BEFORE SELL
    const sellBefore = {
        trader: await token.balanceOf(traderAddress),
        foundation: await token.balanceOf(foundationWallet),
        supply: await token.totalSupply(),
        reserves: await getReserves(pair, token0, MAINNET.token.address),
    };

    printSection("BEFORE SELL");
    printReserves(sellBefore.reserves, "LP Reserves", symbol);
    printTable([
        ["Account", "Balance", ""],
        ["Trader", formatNum(sellBefore.trader), symbol],
        ["Foundation", formatNum(sellBefore.foundation), symbol],
        ["Total Supply", formatNum(sellBefore.supply), symbol],
    ]);

    // Execute SELL
    console.log(`\n  ${fmt.info("Executing SELL...")}`);

    try {
        const tx = await sellFeeTokensForETH(v4Router, MAINNET.token.address, WETH, traderAddress, actualSellAmount, 0n, deadline);
        const receipt = await tx.wait();
        console.log(`  ${fmt.success("✓ SELL SUCCEEDED")} (Gas: ${receipt.gasUsed.toLocaleString()})`);
    } catch (e) {
        console.log(`  ${fmt.fail("✗ SELL FAILED:")} ${e.message.slice(0, 100)}`);
        process.exit(1);
    }

    // AFTER SELL
    const sellAfter = {
        trader: await token.balanceOf(traderAddress),
        foundation: await token.balanceOf(foundationWallet),
        supply: await token.totalSupply(),
        reserves: await getReserves(pair, token0, MAINNET.token.address),
    };

    printSection("AFTER SELL");
    printReserves(sellAfter.reserves, "LP Reserves", symbol);
    printTable([
        ["Account", "Balance", "Change"],
        ["Trader", formatNum(sellAfter.trader), formatNum(sellAfter.trader - sellBefore.trader)],
        ["Foundation", formatNum(sellAfter.foundation), `+${formatNum(sellAfter.foundation - sellBefore.foundation)}`],
        ["Total Supply", formatNum(sellAfter.supply), formatNum(sellAfter.supply - sellBefore.supply)],
    ]);

    // Fee Analysis
    const sellTokensSold = sellBefore.trader - sellAfter.trader;
    const sellFoundationFee = sellAfter.foundation - sellBefore.foundation;
    const sellBurned = sellBefore.supply - sellAfter.supply;
    const sellTotalFee = sellFoundationFee + sellBurned;
    const sellFeePercent = sellTokensSold > 0n ? Number(sellTotalFee) / Number(sellTokensSold) * 100 : 0;
    const sellFoundationPercent = sellTokensSold > 0n ? Number(sellFoundationFee) / Number(sellTokensSold) * 100 : 0;
    const sellBurnPercent = sellTokensSold > 0n ? Number(sellBurned) / Number(sellTokensSold) * 100 : 0;

    printSection("SELL FEE ANALYSIS");
    printTable([
        ["Metric", "Value", "Percent"],
        ["Tokens Sold", formatNum(sellTokensSold), "100%"],
        ["→ Foundation", formatNum(sellFoundationFee), `${sellFoundationPercent.toFixed(2)}%`],
        ["→ Burned", formatNum(sellBurned), `${sellBurnPercent.toFixed(2)}%`],
        ["TOTAL FEE", formatNum(sellTotalFee), `${sellFeePercent.toFixed(2)}%`],
    ]);

    // Verify expected fee
    const sellPass = Math.abs(sellFeePercent - EXPECTED_FEE_PERCENT) < FEE_TOLERANCE;
    const sellFoundationPass = sellFoundationFee > 0n;
    const sellBurnPass = sellBurned > 0n;

    console.log(`\n  Foundation received: ${sellFoundationPass ? fmt.success("✓ YES") : fmt.fail("✗ NO")}`);
    console.log(`  Tokens burned:       ${sellBurnPass ? fmt.success("✓ YES") : fmt.fail("✗ NO")}`);
    console.log(`  Fee amount:          ${sellPass ? fmt.success(`✓ PASS (${sellFeePercent.toFixed(2)}%)`) : fmt.fail(`✗ FAIL (${sellFeePercent.toFixed(2)}%, expected ${EXPECTED_FEE_PERCENT}%)`)}`);

    // ==========================================================================
    // FINAL SUMMARY
    // ==========================================================================
    const allPass = buyPass && buyFoundationPass && buyBurnPass && sellPass && sellFoundationPass && sellBurnPass;
    const summaryColor = allPass ? c.green : c.red;

    printBox(allPass ? "ALL TESTS PASSED - FEES ARE WORKING!" : "SOME TESTS FAILED", summaryColor);

    printSection("Test Results");
    printTable([
        ["Test", "Result", "Fee %"],
        ["BUY - Total Fee", buyPass ? "✓ PASS" : "✗ FAIL", `${buyFeePercent.toFixed(2)}%`],
        ["BUY - Foundation", buyFoundationPass ? "✓ PASS" : "✗ FAIL", `${buyFoundationPercent.toFixed(2)}%`],
        ["BUY - Burn", buyBurnPass ? "✓ PASS" : "✗ FAIL", `${buyBurnPercent.toFixed(2)}%`],
        ["SELL - Total Fee", sellPass ? "✓ PASS" : "✗ FAIL", `${sellFeePercent.toFixed(2)}%`],
        ["SELL - Foundation", sellFoundationPass ? "✓ PASS" : "✗ FAIL", `${sellFoundationPercent.toFixed(2)}%`],
        ["SELL - Burn", sellBurnPass ? "✓ PASS" : "✗ FAIL", `${sellBurnPercent.toFixed(2)}%`],
    ]);

    printSection("Fee Summary");
    console.log(`  Expected Total Fee:   ${fmt.num(EXPECTED_FEE_PERCENT + "%")} (${EXPECTED_FEE_PERCENT/2}% burn + ${EXPECTED_FEE_PERCENT/2}% foundation)`);
    console.log(`  Actual BUY Fee:       ${fmt.num(buyFeePercent.toFixed(2) + "%")}`);
    console.log(`  Actual SELL Fee:      ${fmt.num(sellFeePercent.toFixed(2) + "%")}`);

    printSection("Conclusion");
    if (allPass) {
        console.log(`  ${fmt.success("✓")} Fees are correctly ACTIVE (pairIsSet = true)`);
        console.log(`  ${fmt.success("✓")} ${EXPECTED_FEE_PERCENT}% fee applied on BUY and SELL`);
        console.log(`  ${fmt.success("✓")} Foundation wallet receiving fees`);
        console.log(`  ${fmt.success("✓")} Tokens being burned correctly`);
        console.log(`  ${fmt.success("✓")} V4 Universal Router working with fee-on-transfer`);
        console.log(`\n  ${c.bright}${c.green}🎉 FEE SYSTEM IS FULLY OPERATIONAL! 🎉${c.reset}`);
    } else {
        console.log(`  ${fmt.fail("✗")} Fee verification failed!`);
        console.log(`  ${fmt.fail("  Review the results above and check contract state.")}`);
        if (isTraderOwner) {
            console.log(`\n  ${fmt.warn("⚠ Note: Trader is the owner - owner may be excluded from fees.")}`);
            console.log(`  ${fmt.warn("  Try with a non-owner account for accurate fee testing.")}`);
        }
    }
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
