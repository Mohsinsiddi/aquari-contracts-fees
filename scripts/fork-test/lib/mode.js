/**
 * =============================================================================
 * Mode Detection & Context Setup
 * =============================================================================
 */

const { ethers } = require("hardhat");
const { MAINNET, BASE, ABIS, TEST_PARAMS } = require("../config");
const { loadState, saveState } = require("./state");

/**
 * Detect mode from CLI args or environment variables
 *
 * Environment variables (for use with hardhat run):
 *   TEST_MODE=simulate     - Edge case testing with AquariSim
 *   TEST_MODE=mainnet      - Test real AQUARI (need owner key)
 *   NEW_TOKEN=true         - Deploy fresh token (used with mainnet mode)
 *
 * Usage:
 *   TEST_MODE=simulate npx hardhat run scripts/fork-test/run-all.js --network fork
 *   TEST_MODE=mainnet NEW_TOKEN=true npx hardhat run scripts/fork-test/run-all.js --network fork
 *
 * @returns {{ mode: "mainnet" | "simulate", newToken: boolean }}
 */
function getMode() {
    const args = process.argv.slice(2);

    // Check environment variables first (works with hardhat run)
    const envMode = process.env.TEST_MODE;
    const envNewToken = process.env.NEW_TOKEN === "true";

    // Check CLI args (works with node direct execution)
    const isMainnet = args.includes("--mainnet") || envMode === "mainnet";
    const isSimulate = args.includes("--simulate") || envMode === "simulate";
    const isNewToken = args.includes("--new-token") || envNewToken;

    if (isSimulate) {
        return { mode: "simulate", newToken: true }; // Always deploy fresh for simulate
    }

    if (isMainnet && !isNewToken) {
        // --mainnet without --new-token = Test real AQUARI (need real owner key)
        return { mode: "mainnet", newToken: false };
    }

    if (isMainnet && isNewToken) {
        // --mainnet --new-token = Deploy fresh token, test as owner
        return { mode: "mainnet", newToken: true };
    }

    // Default
    console.log("No mode specified.");
    console.log("");
    console.log("Environment variables (recommended for hardhat run):");
    console.log("  TEST_MODE=simulate npx hardhat run ... --network fork");
    console.log("  TEST_MODE=mainnet npx hardhat run ... --network fork");
    console.log("  TEST_MODE=mainnet NEW_TOKEN=true npx hardhat run ... --network fork");
    console.log("");
    console.log("Defaulting to --mainnet --new-token\n");
    return { mode: "mainnet", newToken: true };
}

/**
 * Get implementation address for a proxy
 */
async function getImplementationAddress(proxyAddress) {
    // EIP-1967 implementation slot
    const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implStorage = await ethers.provider.getStorage(proxyAddress, implSlot);
    const implAddress = "0x" + implStorage.slice(26);
    return ethers.getAddress(implAddress);
}

/**
 * Setup test context based on mode
 * @returns {Promise<TestContext>}
 */
async function setupContext() {
    const { mode, newToken } = getMode();
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    const router = new ethers.Contract(BASE.uniswapV2Router, ABIS.router, signer);
    const factory = new ethers.Contract(BASE.uniswapV2Factory, ABIS.factory, signer);

    let token, tokenAddress, pairAddress, foundationWallet, isOwner;
    let proxyAddress, implementationAddress;
    let ownerAddress;

    console.log("─".repeat(70));
    if (mode === "mainnet" && newToken) {
        console.log("MODE: MAINNET --new-token (deploy fresh, YOU are owner)");
    } else if (mode === "mainnet") {
        console.log("MODE: MAINNET (test real AQUARI, need owner key)");
    } else {
        console.log("MODE: SIMULATE (edge case testing with AquariSim)");
    }
    console.log("─".repeat(70));
    console.log("");

    if (mode === "mainnet" && !newToken) {
        // =====================================================================
        // MAINNET MODE: Use real AQUARI contract (already deployed, has LP)
        // =====================================================================
        console.log("Loading REAL AQUARI contract from mainnet fork...");
        console.log("");

        proxyAddress = MAINNET.token;
        tokenAddress = proxyAddress;
        pairAddress = MAINNET.pair;
        foundationWallet = MAINNET.foundationWallet;

        token = new ethers.Contract(tokenAddress, ABIS.token, signer);

        // Fetch owner from contract
        ownerAddress = await token.owner();
        isOwner = ownerAddress.toLowerCase() === signerAddress.toLowerCase();

        // Get implementation address
        try {
            implementationAddress = await getImplementationAddress(proxyAddress);
        } catch (e) {
            implementationAddress = "Unknown";
        }

        console.log("CONTRACT INFO (MAINNET):");
        console.log(`  Proxy:          ${proxyAddress}`);
        console.log(`  Implementation: ${implementationAddress}`);
        console.log(`  Pair:           ${pairAddress}`);
        console.log(`  Foundation:     ${foundationWallet}`);
        console.log("");
        console.log("OWNER VALIDATION:");
        console.log(`  Contract Owner: ${ownerAddress}`);
        console.log(`  Your Address:   ${signerAddress}`);
        console.log(`  Match:          ${isOwner ? "YES ✓" : "NO ✗"}`);
        console.log("");

        if (!isOwner) {
            console.log("═".repeat(70));
            console.log("ERROR: You are NOT the owner of AQUARI contract!");
            console.log("═".repeat(70));
            console.log("");
            console.log("To run mainnet tests, ADMIN_KEY in .env must be the owner's private key.");
            console.log(`Expected owner: ${ownerAddress}`);
            console.log("");
            console.log("Options:");
            console.log("  1. Set correct ADMIN_KEY in .env (must be owner)");
            console.log("  2. Use --mainnet --new-token (deploy fresh, YOU become owner)");
            console.log("");
        }

    } else {
        // =====================================================================
        // NEW TOKEN or SIMULATE MODE: Deploy fresh contract + add LP
        // --mainnet --new-token = Deploy AquariTest (same code as mainnet)
        // --simulate = Edge case testing with AquariSim contracts
        // =====================================================================
        const state = loadState();

        // If --new-token flag, always deploy fresh (ignore existing state)
        const shouldDeployNew = newToken || !state.deployed || !state.proxy;

        if (!shouldDeployNew && state.deployed && state.proxy) {
            // ─────────────────────────────────────────────────────────────────
            // Load existing simulation
            // ─────────────────────────────────────────────────────────────────
            console.log("Loading existing simulation...");
            console.log("");

            proxyAddress = state.proxy;
            implementationAddress = state.implementation;
            tokenAddress = proxyAddress;
            pairAddress = state.pair || null;
            foundationWallet = state.foundationWallet || signerAddress;

            token = new ethers.Contract(tokenAddress, ABIS.token, signer);
            ownerAddress = await token.owner();
            isOwner = ownerAddress.toLowerCase() === signerAddress.toLowerCase();

            console.log("CONTRACT INFO (SIMULATION - LOADED):");
            console.log(`  Proxy:          ${proxyAddress}`);
            console.log(`  Implementation: ${implementationAddress}`);
            console.log(`  Pair:           ${pairAddress}`);
            console.log(`  Foundation:     ${foundationWallet}`);
            console.log(`  Owner:          ${ownerAddress}`);
            console.log("");

        }

        if (shouldDeployNew) {
            // ─────────────────────────────────────────────────────────────────
            // Deploy new token (--new-token flag or no existing state)
            // ─────────────────────────────────────────────────────────────────
            if (newToken) {
                console.log("DEPLOYING NEW TOKEN (--new-token flag)...");
            } else {
                console.log("DEPLOYING NEW SIMULATION...");
            }
            console.log("");

            // Step 1: Deploy proxy (UUPS - same as mainnet, skip validation)
            console.log("Step 1/3: Deploying AquariProtocol (UUPS Proxy, same as mainnet)...");
            const { upgrades } = require("hardhat");

            // Skip validation - same approach as legacy/deploy.js
            process.env.HARDHAT_UPGRADES_SKIP_VALIDATION = "true";

            const AquariProtocol = await ethers.getContractFactory("AquariProtocol");
            const proxy = await upgrades.deployProxy(
                AquariProtocol,
                [signerAddress],
                {
                    initializer: "initialize",
                    kind: "uups",
                    timeout: 0,
                    unsafeAllow: ['constructor', 'delegatecall', 'missing-public-upgradeto', 'state-variable-immutable', 'state-variable-assignment', 'external-library-linking', 'selfdestruct', 'internal-function-storage', 'missing-initializer-call'],
                    unsafeSkipStorageCheck: true,
                    unsafeAllowLinkedLibraries: true,
                    unsafeAllowCustomTypes: true,
                    constructorArgs: []
                }
            );
            await proxy.waitForDeployment();

            proxyAddress = await proxy.getAddress();
            tokenAddress = proxyAddress;

            // Get implementation address
            implementationAddress = await getImplementationAddress(proxyAddress);

            token = new ethers.Contract(tokenAddress, ABIS.token, signer);
            ownerAddress = await token.owner();
            isOwner = true;
            foundationWallet = signerAddress; // Use signer as foundation for simulation

            console.log(`  Proxy:          ${proxyAddress}`);
            console.log(`  Implementation: ${implementationAddress}`);
            console.log("");

            // Step 2: Create pair
            console.log("Step 2/3: Creating Uniswap V2 Pair...");
            let pair = await factory.getPair(tokenAddress, BASE.weth);
            if (pair === ethers.ZeroAddress) {
                const createTx = await factory.createPair(tokenAddress, BASE.weth);
                await createTx.wait();
                pair = await factory.getPair(tokenAddress, BASE.weth);
                console.log(`  Created pair: ${pair}`);
            } else {
                console.log(`  Pair exists:  ${pair}`);
            }
            pairAddress = pair;
            console.log("");

            // Step 3: Add liquidity
            console.log("Step 3/3: Adding Liquidity...");
            const lpTokens = ethers.parseEther(TEST_PARAMS.lpTokenAmount);
            const lpEth = ethers.parseEther(TEST_PARAMS.lpEthAmount);

            console.log(`  Tokens: ${TEST_PARAMS.lpTokenAmount}`);
            console.log(`  ETH:    ${TEST_PARAMS.lpEthAmount}`);

            await (await token.approve(BASE.uniswapV2Router, lpTokens)).wait();

            const deadline = Math.floor(Date.now() / 1000) + 1200;
            await (await router.addLiquidityETH(
                tokenAddress,
                lpTokens,
                0, 0,
                signerAddress,
                deadline,
                { value: lpEth }
            )).wait();
            console.log("  LP added successfully!");
            console.log("");

            // Save state
            saveState({
                deployed: true,
                proxy: proxyAddress,
                implementation: implementationAddress,
                token: tokenAddress,
                pair: pairAddress,
                foundationWallet,
                owner: ownerAddress,
                deployedAt: new Date().toISOString(),
            });

            console.log("CONTRACT INFO (NEW DEPLOYMENT - AquariProtocol):");
            console.log(`  Proxy:          ${proxyAddress}`);
            console.log(`  Implementation: ${implementationAddress}`);
            console.log(`  Pair:           ${pairAddress}`);
            console.log(`  Foundation:     ${foundationWallet}`);
            console.log(`  Owner:          ${ownerAddress}`);
            console.log("");
            console.log("State saved to simulation-state.json");
            console.log("");
        }
    }

    return {
        mode,
        newToken,
        signer,
        signerAddress,
        token,
        tokenAddress,
        proxyAddress,
        implementationAddress,
        pairAddress,
        foundationWallet,
        ownerAddress,
        isOwner,
        router,
        factory,
    };
}

module.exports = {
    getMode,
    setupContext,
    getImplementationAddress,
};
