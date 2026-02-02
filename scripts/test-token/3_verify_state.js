/**
 * =============================================================================
 * TEST TOKEN STEP 3: Verify Contract State
 * =============================================================================
 *
 * Verifies the current state of the AquariTest contract.
 * READ ONLY - no transactions.
 *
 * Usage:
 *   npx hardhat run scripts/test-token/3_verify_state.js --network base
 *
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers } = hre;
const { BASE, CONFIG, loadState, c, fmt, printBox, printSection } = require("./config");

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
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)",
    "function totalSupply() view returns (uint256)",
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)",
];

async function main() {
    printBox("STEP 3: VERIFY CONTRACT STATE", c.blue);

    // Load state
    const state = loadState();
    if (!state.deployed || !state.proxy) {
        console.log(`\n  ${fmt.fail("✗ ERROR: Token not deployed!")}`);
        console.log(`  ${fmt.fail("  Run 1_deploy.js first")}`);
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    printSection("Addresses");
    console.log(`  Proxy:    ${fmt.addr(state.proxy)}`);
    console.log(`  Signer:   ${fmt.addr(signerAddress)}`);

    // Load token
    const token = new ethers.Contract(state.proxy, TOKEN_ABI, signer);

    // Basic info
    printSection("Token Info");
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const owner = await token.owner();

    console.log(`  Name:         ${fmt.info(name)}`);
    console.log(`  Symbol:       ${fmt.info(symbol)}`);
    console.log(`  Total Supply: ${fmt.num(ethers.formatEther(totalSupply))} ${symbol}`);
    console.log(`  Owner:        ${fmt.addr(owner)}`);
    console.log(`  Is Owner:     ${owner.toLowerCase() === signerAddress.toLowerCase() ? fmt.success("YES") : fmt.fail("NO")}`);

    // State
    printSection("Contract State");
    const tradingEnabled = await token.tradingEnabled();
    const paused = await token.paused();
    const pairIsSet = await token.pairIsSet();
    const storedPair = await token.uniswapV2Pair();

    console.log(`  Trading:      ${tradingEnabled ? fmt.success("ENABLED") : fmt.warn("DISABLED")}`);
    console.log(`  Paused:       ${paused ? fmt.fail("YES") : fmt.success("NO")}`);
    console.log(`  pairIsSet:    ${pairIsSet ? fmt.success("TRUE (FEES ACTIVE)") : fmt.warn("FALSE (FEES INACTIVE)")}`);
    console.log(`  Stored Pair:  ${fmt.addr(storedPair)}`);

    // Tax config
    printSection("Tax Configuration");
    const burnTax = await token.burnTax();
    const foundationFee = await token.foundationFee();
    const foundationWallet = await token.foundationWallet();
    const totalTax = Number(burnTax) + Number(foundationFee);

    console.log(`  Burn Tax:         ${fmt.num(burnTax.toString())} bps (${Number(burnTax)/100}%)`);
    console.log(`  Foundation Fee:   ${fmt.num(foundationFee.toString())} bps (${Number(foundationFee)/100}%)`);
    console.log(`  Total Tax:        ${fmt.num(totalTax.toString())} bps (${totalTax/100}%)`);
    console.log(`  Foundation Wallet: ${fmt.addr(foundationWallet)}`);

    // LP Info
    const factory = new ethers.Contract(BASE.uniswapV2Factory, FACTORY_ABI, signer);
    const factoryPair = await factory.getPair(state.proxy, BASE.weth);

    printSection("Liquidity Pool");
    console.log(`  Factory Pair: ${fmt.addr(factoryPair)}`);
    console.log(`  State Pair:   ${fmt.addr(state.pair || "Not saved")}`);

    if (factoryPair !== ethers.ZeroAddress) {
        const pair = new ethers.Contract(factoryPair, PAIR_ABI, signer);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0 = await pair.token0();
        const lpSupply = await pair.totalSupply();

        const isToken0 = token0.toLowerCase() === state.proxy.toLowerCase();
        const tokenReserve = isToken0 ? reserve0 : reserve1;
        const ethReserve = isToken0 ? reserve1 : reserve0;
        const price = Number(ethReserve) / Number(tokenReserve);

        console.log(`  ${symbol} Reserve: ${fmt.num(ethers.formatEther(tokenReserve))}`);
        console.log(`  ETH Reserve:  ${fmt.num(ethers.formatEther(ethReserve))}`);
        console.log(`  LP Supply:    ${fmt.num(ethers.formatEther(lpSupply))}`);
        console.log(`  Price:        ${fmt.num(price.toExponential(4))} ETH/${symbol}`);
    } else {
        console.log(`  ${fmt.warn("No LP pair found")}`);
    }

    // Key balances
    printSection("Key Balances");
    const ownerBalance = await token.balanceOf(owner);
    const foundationBalance = await token.balanceOf(foundationWallet);

    console.log(`  Owner:      ${fmt.num(ethers.formatEther(ownerBalance))} ${symbol}`);
    console.log(`  Foundation: ${fmt.num(ethers.formatEther(foundationBalance))} ${symbol}`);

    // Summary
    printBox("STATUS SUMMARY", c.cyan);

    const checks = [
        { name: "Contract deployed", pass: state.deployed },
        { name: "LP created", pass: factoryPair !== ethers.ZeroAddress },
        { name: "Trading enabled", pass: tradingEnabled },
        { name: "Not paused", pass: !paused },
        { name: "Fees enabled (pairIsSet)", pass: pairIsSet },
    ];

    for (const check of checks) {
        console.log(`  ${check.pass ? fmt.success("✓") : fmt.warn("○")} ${check.name}`);
    }

    // What to do next
    printSection("Next Steps");
    if (!state.lpAdded || factoryPair === ethers.ZeroAddress) {
        console.log(`  1. Run ${fmt.num("2_add_liquidity.js")} to create LP`);
    }
    if (!pairIsSet) {
        console.log(`  2. Run ${fmt.num("4_configure.js")} to set pair and enable fees`);
        console.log(`     OR trade on Uniswap UI WITHOUT fees first`);
    } else {
        console.log(`  ${fmt.success("✓")} Ready to trade with fees on Uniswap UI!`);
    }
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
