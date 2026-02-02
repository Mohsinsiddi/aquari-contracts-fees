/**
 * =============================================================================
 * TEST TOKEN STEP 2: Add Liquidity to Uniswap V2
 * =============================================================================
 *
 * Creates LP pair and adds liquidity:
 * - 0.01 ETH
 * - 1,000,000 AQTEST tokens
 *
 * Usage:
 *   npx hardhat run scripts/test-token/2_add_liquidity.js --network base
 *
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers } = hre;
const { BASE, CONFIG, loadState, saveState, c, fmt, printBox, printSection } = require("./config");

const ROUTER_ABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function WETH() view returns (address)",
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)",
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)",
    "function totalSupply() view returns (uint256)",
];

const TOKEN_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
];

async function main() {
    printBox("STEP 2: ADD LIQUIDITY TO UNISWAP V2", c.magenta);

    // Load state
    const state = loadState();
    if (!state.deployed || !state.proxy) {
        console.log(`\n  ${fmt.fail("✗ ERROR: Token not deployed!")}`);
        console.log(`  ${fmt.fail("  Run 1_deploy.js first")}`);
        process.exit(1);
    }

    if (state.lpAdded && state.pair) {
        console.log(`\n  ${fmt.warn("⚠ LP already added!")}`);
        console.log(`  Pair: ${fmt.addr(state.pair)}`);
        process.exit(0);
    }

    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    printSection("Setup");
    console.log(`  Token:    ${fmt.addr(state.proxy)}`);
    console.log(`  Signer:   ${fmt.addr(signerAddress)}`);
    console.log(`  Router:   ${fmt.addr(BASE.uniswapV2Router)}`);

    // Load contracts
    const token = new ethers.Contract(state.proxy, TOKEN_ABI, signer);
    const router = new ethers.Contract(BASE.uniswapV2Router, ROUTER_ABI, signer);
    const factory = new ethers.Contract(BASE.uniswapV2Factory, FACTORY_ABI, signer);

    const symbol = await token.symbol();
    const tokenBalance = await token.balanceOf(signerAddress);
    const ethBalance = await ethers.provider.getBalance(signerAddress);

    printSection("Balances");
    console.log(`  ${symbol}:  ${fmt.num(ethers.formatEther(tokenBalance))}`);
    console.log(`  ETH:    ${fmt.num(ethers.formatEther(ethBalance))}`);

    // Amounts
    const tokenAmount = ethers.parseEther(CONFIG.liquidityTokens);
    const ethAmount = ethers.parseEther(CONFIG.liquidityETH);

    printSection("Liquidity to Add");
    console.log(`  ${symbol}:  ${fmt.num(CONFIG.liquidityTokens)} (${ethers.formatEther(tokenAmount)})`);
    console.log(`  ETH:    ${fmt.num(CONFIG.liquidityETH)}`);

    // Check balances
    if (tokenBalance < tokenAmount) {
        console.log(`\n  ${fmt.fail("✗ ERROR: Insufficient token balance!")}`);
        process.exit(1);
    }
    if (ethBalance < ethAmount + ethers.parseEther("0.005")) {
        console.log(`\n  ${fmt.fail("✗ ERROR: Insufficient ETH balance!")}`);
        process.exit(1);
    }

    // Approve router
    printSection("Approve Router");
    console.log(`  ${fmt.info("Approving router to spend tokens...")}`);
    const approveTx = await token.approve(BASE.uniswapV2Router, tokenAmount);
    await approveTx.wait();
    console.log(`  ${fmt.success("✓ Approved")}`);

    // Add liquidity
    printSection("Add Liquidity");
    console.log(`  ${fmt.info("Adding liquidity...")}`);

    const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes

    const tx = await router.addLiquidityETH(
        state.proxy,
        tokenAmount,
        tokenAmount * 95n / 100n,  // 5% slippage
        ethAmount * 95n / 100n,     // 5% slippage
        signerAddress,
        deadline,
        { value: ethAmount }
    );

    console.log(`  TX: ${fmt.addr(tx.hash)}`);
    console.log(`  ${fmt.info("Waiting for confirmation...")}`);
    const receipt = await tx.wait();
    console.log(`  ${fmt.success("✓ Liquidity added!")} (Gas: ${receipt.gasUsed.toLocaleString()})`);

    // Get pair address
    const pairAddress = await factory.getPair(state.proxy, BASE.weth);
    console.log(`\n  ${fmt.success("Pair Address:")} ${fmt.addr(pairAddress)}`);

    // Get pair info
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);
    const [reserve0, reserve1] = await pair.getReserves();
    const token0 = await pair.token0();
    const lpSupply = await pair.totalSupply();

    const isToken0 = token0.toLowerCase() === state.proxy.toLowerCase();
    const tokenReserve = isToken0 ? reserve0 : reserve1;
    const ethReserve = isToken0 ? reserve1 : reserve0;

    printSection("Pair Info");
    console.log(`  Pair:         ${fmt.addr(pairAddress)}`);
    console.log(`  ${symbol} Reserve: ${fmt.num(ethers.formatEther(tokenReserve))}`);
    console.log(`  ETH Reserve:  ${fmt.num(ethers.formatEther(ethReserve))}`);
    console.log(`  LP Supply:    ${fmt.num(ethers.formatEther(lpSupply))}`);

    const price = Number(ethReserve) / Number(tokenReserve);
    console.log(`  Price:        ${fmt.num(price.toExponential(4))} ETH/${symbol}`);

    // Save state
    state.pair = pairAddress;
    state.lpAdded = true;
    saveState(state);

    printBox("LIQUIDITY ADDED", c.green);
    console.log(`\n  ${fmt.success("✓")} Pair created: ${pairAddress}`);
    console.log(`  ${fmt.success("✓")} Reserves: ${CONFIG.liquidityTokens} ${symbol} + ${CONFIG.liquidityETH} ETH`);
    console.log(`\n  ${fmt.info("NEXT:")} Run ${fmt.num("3_verify_state.js")} to verify\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
