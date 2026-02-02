/**
 * =============================================================================
 * TEST TOKEN STEP 4: Configure Token (Foundation, Pair, Fees)
 * =============================================================================
 *
 * This script:
 * 1. Sets new foundation wallet: 0x802D8097eC1D49808F3c2c866020442891adde57
 * 2. Sets Uniswap V2 pair address (ENABLES FEES - IRREVERSIBLE!)
 * 3. Sets tax config: 125 bps burn + 125 bps foundation = 2.5% total
 *
 * ⚠️ WARNING: setUniswapV2Pair is IRREVERSIBLE!
 *
 * Usage:
 *   npx hardhat run scripts/test-token/4_configure.js --network base
 *
 * =============================================================================
 */

const hre = require("hardhat");
const { ethers } = hre;
const { BASE, CONFIG, loadState, saveState, c, fmt, printBox, printSection } = require("./config");

const TOKEN_ABI = [
    "function owner() view returns (address)",
    "function setFoundationWallet(address newWallet)",
    "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee)",
    "function setUniswapV2Pair(address newPairAddress)",
    "function foundationWallet() view returns (address)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function uniswapV2Pair() view returns (address)",
    "function pairIsSet() view returns (bool)",
];

const FACTORY_ABI = [
    "function getPair(address tokenA, address tokenB) view returns (address)",
];

async function main() {
    printBox("STEP 4: CONFIGURE TOKEN", c.magenta);

    // Load state
    const state = loadState();
    if (!state.deployed || !state.proxy) {
        console.log(`\n  ${fmt.fail("✗ ERROR: Token not deployed!")}`);
        console.log(`  ${fmt.fail("  Run 1_deploy.js first")}`);
        process.exit(1);
    }

    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();

    printSection("Setup");
    console.log(`  Token:   ${fmt.addr(state.proxy)}`);
    console.log(`  Signer:  ${fmt.addr(signerAddress)}`);

    // Load token
    const token = new ethers.Contract(state.proxy, TOKEN_ABI, signer);

    // Verify owner
    const owner = await token.owner();
    if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
        console.log(`\n  ${fmt.fail("✗ ERROR: You are not the owner!")}`);
        console.log(`  Owner:  ${fmt.addr(owner)}`);
        console.log(`  You:    ${fmt.addr(signerAddress)}`);
        process.exit(1);
    }
    console.log(`  ${fmt.success("✓ Owner verified")}`);

    // Get factory pair
    const factory = new ethers.Contract(BASE.uniswapV2Factory, FACTORY_ABI, signer);
    const factoryPair = await factory.getPair(state.proxy, BASE.weth);

    if (factoryPair === ethers.ZeroAddress) {
        console.log(`\n  ${fmt.fail("✗ ERROR: No LP pair found!")}`);
        console.log(`  ${fmt.fail("  Run 2_add_liquidity.js first")}`);
        process.exit(1);
    }

    // Current state
    printSection("Current Configuration");
    const currentFoundation = await token.foundationWallet();
    const currentBurn = await token.burnTax();
    const currentFee = await token.foundationFee();
    const currentPairIsSet = await token.pairIsSet();
    const currentPair = await token.uniswapV2Pair();

    console.log(`  Foundation:    ${fmt.addr(currentFoundation)}`);
    console.log(`  Burn Tax:      ${fmt.num(currentBurn.toString())} bps (${Number(currentBurn)/100}%)`);
    console.log(`  Foundation Fee: ${fmt.num(currentFee.toString())} bps (${Number(currentFee)/100}%)`);
    console.log(`  pairIsSet:     ${currentPairIsSet ? fmt.success("TRUE") : fmt.warn("FALSE")}`);
    console.log(`  Stored Pair:   ${fmt.addr(currentPair)}`);
    console.log(`  Factory Pair:  ${fmt.addr(factoryPair)}`);

    // Target config
    printSection("Target Configuration");
    console.log(`  Foundation:    ${fmt.addr(CONFIG.newFoundationWallet)}`);
    console.log(`  Burn Tax:      ${fmt.num(CONFIG.taxConfig.burnTax.toString())} bps (${CONFIG.taxConfig.burnTax/100}%)`);
    console.log(`  Foundation Fee: ${fmt.num(CONFIG.taxConfig.foundationFee.toString())} bps (${CONFIG.taxConfig.foundationFee/100}%)`);
    console.log(`  Pair:          ${fmt.addr(factoryPair)}`);

    // =========================================================================
    // 1. Set Foundation Wallet
    // =========================================================================
    printSection("1. Set Foundation Wallet");

    if (currentFoundation.toLowerCase() !== CONFIG.newFoundationWallet.toLowerCase()) {
        console.log(`  ${fmt.info("Setting foundation wallet...")}`);
        const tx1 = await token.setFoundationWallet(CONFIG.newFoundationWallet);
        console.log(`  TX: ${fmt.addr(tx1.hash)}`);
        await tx1.wait();
        console.log(`  ${fmt.success("✓ Foundation wallet updated!")}`);
    } else {
        console.log(`  ${fmt.warn("○ Already set - skipping")}`);
    }

    // =========================================================================
    // 2. Set Tax Config
    // =========================================================================
    printSection("2. Set Tax Config");

    if (Number(currentBurn) !== CONFIG.taxConfig.burnTax ||
        Number(currentFee) !== CONFIG.taxConfig.foundationFee) {
        console.log(`  ${fmt.info("Setting tax config...")}`);
        const tx2 = await token.setTaxConfig(CONFIG.taxConfig.burnTax, CONFIG.taxConfig.foundationFee);
        console.log(`  TX: ${fmt.addr(tx2.hash)}`);
        await tx2.wait();
        console.log(`  ${fmt.success("✓ Tax config updated!")}`);
    } else {
        console.log(`  ${fmt.warn("○ Already set - skipping")}`);
    }

    // =========================================================================
    // 3. Set Uniswap V2 Pair (IRREVERSIBLE!)
    // =========================================================================
    printSection("3. Set Uniswap V2 Pair");

    if (currentPairIsSet) {
        console.log(`  ${fmt.warn("○ pairIsSet is already TRUE - skipping")}`);
        console.log(`  Current pair: ${fmt.addr(currentPair)}`);
    } else {
        console.log(`  ${c.bright}${c.yellow}⚠️ WARNING: This action is IRREVERSIBLE!${c.reset}`);
        console.log(`  ${fmt.info("Setting pair address...")}`);

        const tx3 = await token.setUniswapV2Pair(factoryPair);
        console.log(`  TX: ${fmt.addr(tx3.hash)}`);
        await tx3.wait();
        console.log(`  ${fmt.success("✓ Pair set! FEES ARE NOW ACTIVE!")}`);

        state.feesEnabled = true;
    }

    // =========================================================================
    // Verify Final State
    // =========================================================================
    printSection("Final Verification");

    const newFoundation = await token.foundationWallet();
    const newBurn = await token.burnTax();
    const newFee = await token.foundationFee();
    const newPairIsSet = await token.pairIsSet();
    const newPair = await token.uniswapV2Pair();

    console.log(`  Foundation:     ${fmt.addr(newFoundation)}`);
    console.log(`  Burn Tax:       ${fmt.num(newBurn.toString())} bps (${Number(newBurn)/100}%)`);
    console.log(`  Foundation Fee: ${fmt.num(newFee.toString())} bps (${Number(newFee)/100}%)`);
    console.log(`  pairIsSet:      ${newPairIsSet ? fmt.success("TRUE (FEES ACTIVE!)") : fmt.warn("FALSE")}`);
    console.log(`  Pair:           ${fmt.addr(newPair)}`);

    // Check all values
    const allCorrect =
        newFoundation.toLowerCase() === CONFIG.newFoundationWallet.toLowerCase() &&
        Number(newBurn) === CONFIG.taxConfig.burnTax &&
        Number(newFee) === CONFIG.taxConfig.foundationFee &&
        newPairIsSet &&
        newPair.toLowerCase() === factoryPair.toLowerCase();

    // Save state
    state.feesEnabled = newPairIsSet;
    saveState(state);

    if (allCorrect) {
        printBox("CONFIGURATION COMPLETE", c.green);
        console.log(`\n  ${fmt.success("✓")} Foundation wallet set to: ${CONFIG.newFoundationWallet}`);
        console.log(`  ${fmt.success("✓")} Tax config: ${CONFIG.taxConfig.burnTax/100}% burn + ${CONFIG.taxConfig.foundationFee/100}% foundation`);
        console.log(`  ${fmt.success("✓")} Pair set and fees ACTIVE!`);
        console.log(`\n  ${c.bright}${c.green}🎉 Ready to trade on Uniswap UI with ${(CONFIG.taxConfig.burnTax + CONFIG.taxConfig.foundationFee)/100}% fees! 🎉${c.reset}`);
    } else {
        printBox("CONFIGURATION INCOMPLETE", c.yellow);
        console.log(`\n  ${fmt.warn("⚠ Some values may not match expected")}`);
    }

    console.log("");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
