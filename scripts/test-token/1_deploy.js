/**
 * =============================================================================
 * TEST TOKEN STEP 1: Deploy AquariTest to Base Mainnet
 * =============================================================================
 *
 * Deploys AquariTest as a UUPS proxy to Base mainnet.
 *
 * Usage:
 *   npx hardhat run scripts/test-token/1_deploy.js --network base
 *
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers, upgrades } = hre;
const { loadState, saveState, c, fmt, printBox, printSection } = require("./config");

async function main() {
    printBox("STEP 1: DEPLOY AQUARI TEST TOKEN", c.magenta);

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    const balance = await ethers.provider.getBalance(deployerAddress);

    printSection("Deployer Info");
    console.log(`  Address:  ${fmt.addr(deployerAddress)}`);
    console.log(`  Balance:  ${fmt.num(ethers.formatEther(balance))} ETH`);
    console.log(`  Network:  ${hre.network.name} (Chain ID: ${hre.network.config.chainId})`);

    if (balance < ethers.parseEther("0.02")) {
        console.log(`\n  ${fmt.fail("✗ ERROR: Insufficient balance!")}`);
        console.log(`  ${fmt.fail("  Need at least 0.02 ETH for deployment + LP")}`);
        process.exit(1);
    }

    // Check existing state
    const state = loadState();
    if (state.deployed && state.proxy) {
        console.log(`\n  ${fmt.warn("⚠ Token already deployed!")}`);
        console.log(`  Proxy: ${fmt.addr(state.proxy)}`);
        console.log(`  Use --force to redeploy (not recommended)`);

        if (process.env.FORCE !== "true") {
            process.exit(0);
        }
    }

    // Deploy
    printSection("Deploying AquariTest");
    console.log(`  ${fmt.info("Compiling contracts...")}`);

    const AquariTest = await ethers.getContractFactory("AquariTest");

    console.log(`  ${fmt.info("Deploying UUPS proxy...")}`);

    // Skip validation - same approach as simulation scripts
    process.env.HARDHAT_UPGRADES_SKIP_VALIDATION = "true";

    const token = await upgrades.deployProxy(AquariTest, [deployerAddress], {
        initializer: "initialize",
        kind: "uups",
        timeout: 0,
        unsafeAllow: ['constructor', 'delegatecall', 'missing-public-upgradeto', 'state-variable-immutable', 'state-variable-assignment', 'external-library-linking', 'selfdestruct', 'internal-function-storage', 'missing-initializer-call'],
        unsafeSkipStorageCheck: true,
        unsafeAllowLinkedLibraries: true,
        unsafeAllowCustomTypes: true,
        constructorArgs: []
    });

    await token.waitForDeployment();
    const proxyAddress = await token.getAddress();
    const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log(`\n  ${fmt.success("✓ Deployment successful!")}`);

    printSection("Contract Addresses");
    console.log(`  Proxy:          ${fmt.addr(proxyAddress)}`);
    console.log(`  Implementation: ${fmt.addr(implAddress)}`);
    console.log(`  Owner:          ${fmt.addr(deployerAddress)}`);

    // Verify contract state
    printSection("Initial State");
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const ownerBalance = await token.balanceOf(deployerAddress);

    console.log(`  Name:           ${fmt.info(name)}`);
    console.log(`  Symbol:         ${fmt.info(symbol)}`);
    console.log(`  Total Supply:   ${fmt.num(ethers.formatEther(totalSupply))} ${symbol}`);
    console.log(`  Owner Balance:  ${fmt.num(ethers.formatEther(ownerBalance))} ${symbol}`);
    console.log(`  Trading:        ${await token.tradingEnabled() ? fmt.success("ENABLED") : fmt.warn("DISABLED")}`);
    console.log(`  pairIsSet:      ${await token.pairIsSet() ? fmt.success("TRUE") : fmt.warn("FALSE")}`);

    // Save state
    const newState = {
        deployed: true,
        proxy: proxyAddress,
        implementation: implAddress,
        owner: deployerAddress,
        pair: null,
        lpAdded: false,
        feesEnabled: false,
        deployedAt: new Date().toISOString(),
    };
    saveState(newState);

    printBox("DEPLOYMENT COMPLETE", c.green);
    console.log(`\n  ${fmt.success("✓")} AquariTest deployed to Base mainnet`);
    console.log(`  ${fmt.success("✓")} Proxy address: ${proxyAddress}`);
    console.log(`\n  ${fmt.info("NEXT:")} Run ${fmt.num("2_add_liquidity.js")} to create LP\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
