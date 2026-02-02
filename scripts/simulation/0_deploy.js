/**
 * =============================================================================
 * SIMULATION STEP 0: Deploy Test Token
 * =============================================================================
 *
 * Deploys the selected simulation contract (AquariSim1-5).
 * Each simulation has its own token address stored in state file.
 *
 * NEXT STEP: Run 1_add_liquidity.js
 * =============================================================================
 */

const { ethers, upgrades } = require("hardhat");
const {
    ACTIVE_SIMULATION,
    SIMULATIONS,
    getConfig,
    updateSimulationState,
    printDisclaimer,
    printConfig,
    printAllSimulations,
} = require("../config");

async function main() {
    printDisclaimer();

    console.log("=".repeat(70));
    console.log(`STEP 0: DEPLOY SIMULATION #${ACTIVE_SIMULATION}`);
    console.log("=".repeat(70));
    console.log("");

    const config = getConfig();
    const simConfig = SIMULATIONS[ACTIVE_SIMULATION];

    // Check if already deployed
    if (config.deployed) {
        console.log("⚠️  This simulation is already deployed!");
        console.log(`   Token: ${config.token}`);
        console.log("");
        console.log("   To redeploy, manually clear the state in:");
        console.log("   deployments/simulation_state.json");
        console.log("");
        printAllSimulations();
        return;
    }

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log(`Deployer:    ${deployer.address}`);
    console.log(`Balance:     ${ethers.formatEther(balance)} ETH`);
    console.log(`Contract:    ${simConfig.name}`);
    console.log(`Purpose:     ${simConfig.purpose}`);
    console.log("");

    // Deploy
    console.log("Deploying contract...");
    const Contract = await ethers.getContractFactory(simConfig.name);

    // Skip validation - same as legacy/deploy.js (contracts have known initializer order)
    process.env.HARDHAT_UPGRADES_SKIP_VALIDATION = "true";

    const contract = await upgrades.deployProxy(Contract, [deployer.address], {
        initializer: "initialize",
        kind: "uups",
        timeout: 0,
        unsafeAllow: ['constructor', 'delegatecall', 'missing-public-upgradeto', 'state-variable-immutable', 'state-variable-assignment', 'external-library-linking', 'selfdestruct', 'internal-function-storage', 'missing-initializer-call'],
        unsafeSkipStorageCheck: true,
        unsafeAllowLinkedLibraries: true,
        unsafeAllowCustomTypes: true,
        constructorArgs: []
    });

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log("");
    console.log("✅ Contract deployed!");
    console.log(`   Address: ${contractAddress}`);
    console.log("");

    // Read contract info
    const name = await contract.name();
    const symbol = await contract.symbol();
    const totalSupply = await contract.totalSupply();
    const owner = await contract.owner();

    console.log("─".repeat(70));
    console.log("CONTRACT INFO");
    console.log("─".repeat(70));
    console.log(`Name:         ${name}`);
    console.log(`Symbol:       ${symbol}`);
    console.log(`Total Supply: ${ethers.formatEther(totalSupply)}`);
    console.log(`Owner:        ${owner}`);
    console.log(`pairIsSet:    ${await contract.pairIsSet()}`);
    console.log(`burnTax:      ${await contract.burnTax()}`);
    console.log(`foundationFee: ${await contract.foundationFee()}`);
    console.log("");

    // Update state
    updateSimulationState(ACTIVE_SIMULATION, {
        token: contractAddress,
        deployed: true,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
    });

    console.log("📄 State saved to deployments/simulation_state.json");
    console.log("");

    printAllSimulations();

    console.log("═".repeat(70));
    console.log("✅ STEP 0 COMPLETE");
    console.log("═".repeat(70));
    console.log("");
    console.log("NEXT: Run 1_add_liquidity.js to create pair and add liquidity");
    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
