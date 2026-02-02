/**
 * Verify Mainnet AQUARI Contract State
 * Reads the real AQUARI contract on Base mainnet to confirm configuration
 */

const { ethers } = require("hardhat");

// Mainnet AQUARI address (the real one trading for ~1 year)
const MAINNET_AQUARI = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";

// Base addresses
const WETH = "0x4200000000000000000000000000000000000006";
const FACTORY = "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6";
const ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";

const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function owner() view returns (address)",
    // Tax functions
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function TAX_DENOMINATOR() view returns (uint256)",
    // Pair functions
    "function uniswapV2Pair() view returns (address)",
    "function pairIsSet() view returns (bool)",
    // Trading
    "function tradingEnabled() view returns (bool)",
    "function paused() view returns (bool)",
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)"
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function totalSupply() view returns (uint256)"
];

async function main() {
    console.log("=".repeat(70));
    console.log("MAINNET AQUARI CONTRACT VERIFICATION");
    console.log("=".repeat(70));
    console.log(`\nContract: ${MAINNET_AQUARI}`);
    console.log(`Network: Base Mainnet (Chain ID: 8453)`);
    console.log(`BaseScan: https://basescan.org/token/${MAINNET_AQUARI}`);
    console.log("");

    const [signer] = await ethers.getSigners();
    const token = new ethers.Contract(MAINNET_AQUARI, ERC20_ABI, signer);
    const factory = new ethers.Contract(FACTORY, FACTORY_ABI, signer);

    // Basic Info
    console.log("─".repeat(70));
    console.log("TOKEN INFO");
    console.log("─".repeat(70));

    try {
        const name = await token.name();
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        const totalSupply = await token.totalSupply();
        const owner = await token.owner();

        console.log(`Name:         ${name}`);
        console.log(`Symbol:       ${symbol}`);
        console.log(`Decimals:     ${decimals}`);
        console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
        console.log(`Owner:        ${owner}`);
    } catch (e) {
        console.log(`Error reading basic info: ${e.message}`);
    }

    // Tax Config
    console.log("\n" + "─".repeat(70));
    console.log("TAX CONFIGURATION");
    console.log("─".repeat(70));

    try {
        const burnTax = await token.burnTax();
        const foundationFee = await token.foundationFee();
        const foundationWallet = await token.foundationWallet();

        let taxDenom = 10000n; // default
        try {
            taxDenom = await token.TAX_DENOMINATOR();
        } catch {}

        const burnPct = (Number(burnTax) / Number(taxDenom) * 100).toFixed(2);
        const foundPct = (Number(foundationFee) / Number(taxDenom) * 100).toFixed(2);
        const totalPct = (Number(burnTax + foundationFee) / Number(taxDenom) * 100).toFixed(2);

        console.log(`Burn Tax:         ${burnTax} bps (${burnPct}%)`);
        console.log(`Foundation Fee:   ${foundationFee} bps (${foundPct}%)`);
        console.log(`Total Tax:        ${burnTax + foundationFee} bps (${totalPct}%)`);
        console.log(`Foundation Wallet: ${foundationWallet}`);
    } catch (e) {
        console.log(`Error reading tax config: ${e.message}`);
    }

    // Pair Status
    console.log("\n" + "─".repeat(70));
    console.log("UNISWAP PAIR STATUS");
    console.log("─".repeat(70));

    try {
        const pairIsSet = await token.pairIsSet();
        const storedPair = await token.uniswapV2Pair();
        const factoryPair = await factory.getPair(MAINNET_AQUARI, WETH);

        console.log(`pairIsSet():      ${pairIsSet} ${pairIsSet ? "✅ FEES ENABLED" : "❌ FEES NOT ENABLED"}`);
        console.log(`uniswapV2Pair():  ${storedPair}`);
        console.log(`Factory Pair:     ${factoryPair}`);
        console.log(`Pairs Match:      ${storedPair.toLowerCase() === factoryPair.toLowerCase() ? "✅ YES" : "❌ NO"}`);

        if (factoryPair !== ethers.ZeroAddress) {
            const pair = new ethers.Contract(factoryPair, PAIR_ABI, signer);
            const reserves = await pair.getReserves();
            const token0 = await pair.token0();

            const isToken0 = token0.toLowerCase() === MAINNET_AQUARI.toLowerCase();
            const aquariReserve = isToken0 ? reserves[0] : reserves[1];
            const wethReserve = isToken0 ? reserves[1] : reserves[0];

            console.log(`\nLiquidity Pool:`);
            console.log(`  AQUARI Reserve: ${ethers.formatUnits(aquariReserve, 18)}`);
            console.log(`  WETH Reserve:   ${ethers.formatUnits(wethReserve, 18)} ETH`);

            if (wethReserve > 0n) {
                const price = Number(wethReserve) / Number(aquariReserve);
                console.log(`  Price:          ${price.toExponential(4)} ETH per AQUARI`);
            }
        }
    } catch (e) {
        console.log(`Error reading pair status: ${e.message}`);
    }

    // Trading Status
    console.log("\n" + "─".repeat(70));
    console.log("TRADING STATUS");
    console.log("─".repeat(70));

    try {
        const tradingEnabled = await token.tradingEnabled();
        console.log(`Trading Enabled:  ${tradingEnabled ? "✅ YES" : "❌ NO"}`);

        try {
            const paused = await token.paused();
            console.log(`Contract Paused:  ${paused ? "⚠️ YES" : "✅ NO"}`);
        } catch {}
    } catch (e) {
        console.log(`Error reading trading status: ${e.message}`);
    }

    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("VERIFICATION SUMMARY");
    console.log("=".repeat(70));

    try {
        const pairIsSet = await token.pairIsSet();
        const burnTax = await token.burnTax();
        const foundationFee = await token.foundationFee();

        if (!pairIsSet) {
            console.log("\n⚠️  FEES ARE NOT YET ENABLED (pairIsSet = false)");
            console.log("    This means taxes are NOT being applied to trades.");
            console.log("\n    To enable fees, owner must call:");
            console.log("    1. setTaxConfig(burnTax, foundationFee)");
            console.log("    2. setUniswapV2Pair(pairAddress)  ← IRREVERSIBLE");
        } else {
            console.log("\n✅ FEES ARE ENABLED");
            console.log(`   Burn: ${burnTax} bps, Foundation: ${foundationFee} bps`);
        }
    } catch (e) {
        console.log(`Summary error: ${e.message}`);
    }

    console.log("\n" + "=".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
