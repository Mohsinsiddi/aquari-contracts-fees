/**
 * =============================================================================
 * SIMULATION STEP 1: Add Liquidity
 * =============================================================================
 *
 * Creates Uniswap pair and adds initial liquidity.
 * Pair address is saved to state file.
 *
 * PREVIOUS: 0_deploy.js
 * NEXT: 2_set_tax_config.js
 * =============================================================================
 */

const { ethers } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    NETWORKS,
    LIQUIDITY,
    getConfig,
    updateSimulationState,
    printDisclaimer,
    printAllSimulations,
} = require("../config");

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)",
    "function createPair(address tokenA, address tokenB) returns (address)"
];

const ROUTER_ABI = [
    "function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)"
];

const TOKEN_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)"
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)"
];

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 1: ADD LIQUIDITY (Simulation #${ACTIVE_SIMULATION})`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const network = NETWORKS.base;

    // Check prerequisites
    if (!config.deployed || !config.token) {
        console.log("❌ Error: Token not deployed yet. Run 0_deploy.js first.");
        process.exit(1);
    }

    if (config.lpAdded) {
        console.log("⚠️  Liquidity already added!");
        console.log(`   Pair: ${config.pair}`);
        console.log("");
        printAllSimulations();
        return;
    }

    const [deployer] = await ethers.getSigners();

    console.log(`Token:       ${config.token}`);
    console.log(`Deployer:    ${deployer.address}`);
    console.log("");

    // Get contracts
    const token = new ethers.Contract(config.token, TOKEN_ABI, deployer);
    const factory = new ethers.Contract(network.uniswapV2.factory, FACTORY_ABI, deployer);
    const router = new ethers.Contract(network.uniswapV2.router, ROUTER_ABI, deployer);

    const tokenName = await token.name();
    const tokenSymbol = await token.symbol();
    console.log(`Token:       ${tokenName} (${tokenSymbol})`);

    // Check/create pair
    console.log("");
    console.log("Checking for existing pair...");
    let pairAddress = await factory.getPair(config.token, network.weth);

    if (pairAddress === ethers.ZeroAddress) {
        console.log("Creating pair...");
        const tx = await factory.createPair(config.token, network.weth);
        await tx.wait();
        pairAddress = await factory.getPair(config.token, network.weth);
        console.log("✅ Pair created!");
    } else {
        console.log("✅ Pair already exists");
    }

    console.log(`Pair:        ${pairAddress}`);
    console.log("");

    // Add liquidity
    const tokenAmount = ethers.parseEther(LIQUIDITY.tokenAmount);
    const ethAmount = ethers.parseEther(LIQUIDITY.ethAmount);

    console.log("─".repeat(70));
    console.log("ADDING LIQUIDITY");
    console.log("─".repeat(70));
    console.log(`Tokens:      ${LIQUIDITY.tokenAmount} ${tokenSymbol}`);
    console.log(`ETH:         ${LIQUIDITY.ethAmount} ETH`);
    console.log("");

    // Approve router
    console.log("Approving router...");
    const approveTx = await token.approve(network.uniswapV2.router, tokenAmount);
    await approveTx.wait();
    console.log("✅ Approved");

    // Add liquidity
    console.log("Adding liquidity...");
    const deadline = Math.floor(Date.now() / 1000) + 1200;

    const lpTx = await router.addLiquidityETH(
        config.token,
        tokenAmount,
        0,
        0,
        deployer.address,
        deadline,
        { value: ethAmount }
    );

    await lpTx.wait();
    console.log("✅ Liquidity added!");
    console.log("");

    // Get pair info
    const pair = new ethers.Contract(pairAddress, PAIR_ABI, deployer);
    const reserves = await pair.getReserves();
    const token0 = await pair.token0();

    const isToken0 = token0.toLowerCase() === config.token.toLowerCase();
    const tokenReserve = isToken0 ? reserves[0] : reserves[1];
    const ethReserve = isToken0 ? reserves[1] : reserves[0];

    console.log("─".repeat(70));
    console.log("PAIR INFO");
    console.log("─".repeat(70));
    console.log(`Token Reserve: ${ethers.formatEther(tokenReserve)} ${tokenSymbol}`);
    console.log(`ETH Reserve:   ${ethers.formatEther(ethReserve)} ETH`);
    console.log("");

    // Update state
    updateSimulationState(ACTIVE_SIMULATION, {
        pair: pairAddress,
        lpAdded: true,
        lpAddedAt: new Date().toISOString(),
    });

    console.log("📄 State saved");
    console.log("");

    printAllSimulations();

    console.log("═".repeat(70));
    console.log("✅ STEP 1 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("IMPORTANT: pairIsSet is still FALSE - fees are NOT enabled yet!");
    console.log("");
    console.log("NEXT: Run 2_set_tax_config.js to configure tax rates");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
