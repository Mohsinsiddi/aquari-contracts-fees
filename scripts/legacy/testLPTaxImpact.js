const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  AQUARI LP ADD/REMOVE TAX IMPACT TEST                                      ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║  Tests:                                                                    ║
 * ║  1. Check reserves BEFORE                                                  ║
 * ║  2. Add liquidity (with fees enabled)                                      ║
 * ║  3. Check reserves AFTER add                                               ║
 * ║  4. Remove ALL liquidity                                                   ║
 * ║  5. Check final balances and calculate tax impact                          ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 * 
 * Run:
 *   Terminal 1: npx hardhat node --fork https://mainnet.base.org
 *   Terminal 2: npx hardhat run scripts/testLPTaxImpact.js --network localhost
 */

// Base Mainnet Addresses
const BASE = {
    weth: "0x4200000000000000000000000000000000000006",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
};

// ABIs
const ROUTER_ABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)",
    "function removeLiquidityETHSupportingFeeOnTransferTokens(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountETH)",
    "function getAmountsOut(uint amountIn, address[] path) external view returns (uint[] memory amounts)",
    "function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB)",
];

const FACTORY_ABI = [
    "function getPair(address, address) external view returns (address)",
    "function createPair(address, address) external returns (address)",
];

const PAIR_ABI = [
    "function getReserves() external view returns (uint112, uint112, uint32)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address, uint256) external returns (bool)",
];

const AQUARI_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function transfer(address, uint256) returns (bool)",
    "function allowance(address, address) view returns (uint256)",
    "function pairIsSet() view returns (bool)",
    "function uniswapV2Pair() view returns (address)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function setUniswapV2Pair(address) external",
    "function owner() view returns (address)",
    "function isExcludedFromTax(address) view returns (bool)",
];

const WETH_ABI = [
    "function deposit() external payable",
    "function withdraw(uint256) external",
    "function balanceOf(address) external view returns (uint256)",
    "function approve(address, uint256) external returns (bool)",
];

// Formatting helpers
function formatEther(value) {
    return ethers.formatEther(value);
}

function parseEther(value) {
    return ethers.parseEther(value);
}

function formatPercent(numerator, denominator) {
    if (denominator === 0n) return "0.00%";
    return ((Number(numerator) / Number(denominator)) * 100).toFixed(4) + "%";
}

async function main() {
    console.log("╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  AQUARI LP ADD/REMOVE TAX IMPACT TEST                                      ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    // Load deployment info
    let AQUARI_ADDRESS;
    if (fs.existsSync('deployment-info.json')) {
        const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
        AQUARI_ADDRESS = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
        console.log("📁 Loaded AQUARI address from deployment-info.json");
    } else {
        console.error("❌ deployment-info.json not found! Please deploy first.");
        process.exit(1);
    }

    const [deployer, testUser] = await ethers.getSigners();
    
    // Get contracts
    const aquari = await ethers.getContractAt(AQUARI_ABI, AQUARI_ADDRESS);
    const router = await ethers.getContractAt(ROUTER_ABI, BASE.router);
    const factory = await ethers.getContractAt(FACTORY_ABI, BASE.factory);
    const weth = await ethers.getContractAt(WETH_ABI, BASE.weth);

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 1: INITIAL STATE
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  SECTION 1: INITIAL STATE                                                  ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    // Token info
    const name = await aquari.name();
    const symbol = await aquari.symbol();
    const burnTax = await aquari.burnTax();
    const foundationFee = await aquari.foundationFee();
    const foundationWallet = await aquari.foundationWallet();
    const pairIsSet = await aquari.pairIsSet();
    const totalSupplyInitial = await aquari.totalSupply();

    console.log("📊 TOKEN INFO");
    console.log("─".repeat(78));
    console.log(`  Name:              ${name} (${symbol})`);
    console.log(`  Contract:          ${AQUARI_ADDRESS}`);
    console.log(`  Total Supply:      ${formatEther(totalSupplyInitial)} ${symbol}`);
    console.log(`  Burn Tax:          ${burnTax} bps (${Number(burnTax) / 100}%)`);
    console.log(`  Foundation Fee:    ${foundationFee} bps (${Number(foundationFee) / 100}%)`);
    console.log(`  Total Tax:         ${Number(burnTax) + Number(foundationFee)} bps (${(Number(burnTax) + Number(foundationFee)) / 100}%)`);
    console.log(`  Foundation Wallet: ${foundationWallet}`);
    console.log(`  Pair Is Set:       ${pairIsSet ? "✅ YES (fees ACTIVE)" : "❌ NO (fees NOT active)"}`);

    // Check/create pair
    let pairAddress = await factory.getPair(AQUARI_ADDRESS, BASE.weth);
    
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
        console.log("\n⚠️  No pair exists. Creating pair and adding initial liquidity...");
        
        // Create pair
        const createPairTx = await factory.createPair(AQUARI_ADDRESS, BASE.weth);
        await createPairTx.wait();
        pairAddress = await factory.getPair(AQUARI_ADDRESS, BASE.weth);
        console.log(`  ✅ Pair created: ${pairAddress}`);

        // Add initial liquidity (before fees are set)
        const initialAquari = parseEther("1000000"); // 1M AQUARI
        const initialEth = parseEther("100"); // 100 ETH

        await aquari.approve(BASE.router, initialAquari);
        
        const deadline = Math.floor(Date.now() / 1000) + 3600;
        await router.addLiquidityETH(
            AQUARI_ADDRESS,
            initialAquari,
            0,
            0,
            deployer.address,
            deadline,
            { value: initialEth }
        );
        console.log(`  ✅ Initial liquidity added: ${formatEther(initialAquari)} AQUARI + ${formatEther(initialEth)} ETH`);
    }

    const pair = await ethers.getContractAt(PAIR_ABI, pairAddress);
    console.log(`\n  Pair Address:      ${pairAddress}`);

    // Get reserves
    const [reserve0, reserve1] = await pair.getReserves();
    const token0 = await pair.token0();
    
    let ethReserve, aquariReserve;
    if (token0.toLowerCase() === AQUARI_ADDRESS.toLowerCase()) {
        aquariReserve = reserve0;
        ethReserve = reserve1;
    } else {
        ethReserve = reserve0;
        aquariReserve = reserve1;
    }

    console.log("\n💧 POOL RESERVES (Initial)");
    console.log("─".repeat(78));
    console.log(`  AQUARI Reserve:    ${formatEther(aquariReserve)} AQUARI`);
    console.log(`  ETH Reserve:       ${formatEther(ethReserve)} ETH`);
    console.log(`  Price:             1 ETH = ${(Number(aquariReserve) / Number(ethReserve)).toFixed(2)} AQUARI`);
    console.log(`  Price:             1 AQUARI = ${(Number(ethReserve) / Number(aquariReserve)).toFixed(8)} ETH`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 2: SET PAIR (ENABLE FEES) IF NOT SET
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  SECTION 2: ENABLE FEES (SET PAIR)                                         ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    if (!pairIsSet) {
        console.log("  Setting pair to enable fees...");
        const setPairTx = await aquari.setUniswapV2Pair(pairAddress);
        await setPairTx.wait();
        console.log("  ✅ Pair set! Fees are now ACTIVE");
    } else {
        console.log("  ✅ Pair already set. Fees are ACTIVE");
    }

    const newPairIsSet = await aquari.pairIsSet();
    console.log(`  Pair Is Set:       ${newPairIsSet ? "✅ YES" : "❌ NO"}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 3: PREPARE TEST USER
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  SECTION 3: PREPARE TEST USER                                              ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    // Send AQUARI to test user
    const testAquariAmount = parseEther("10000"); // 10,000 AQUARI for testing
    const testEthAmount = parseEther("1"); // 1 ETH for testing

    console.log(`  Test User:         ${testUser.address}`);
    console.log(`  Sending ${formatEther(testAquariAmount)} AQUARI to test user...`);

    // Transfer AQUARI (this should NOT be taxed - wallet to wallet)
    const transferTx = await aquari.transfer(testUser.address, testAquariAmount);
    await transferTx.wait();

    const userAquariBefore = await aquari.balanceOf(testUser.address);
    const userEthBefore = await ethers.provider.getBalance(testUser.address);
    const foundationBefore = await aquari.balanceOf(foundationWallet);
    const totalSupplyBefore = await aquari.totalSupply();

    console.log("\n📊 TEST USER BALANCES (Before LP Operations)");
    console.log("─".repeat(78));
    console.log(`  AQUARI Balance:    ${formatEther(userAquariBefore)} AQUARI`);
    console.log(`  ETH Balance:       ${formatEther(userEthBefore)} ETH`);
    console.log(`  Foundation Balance:${formatEther(foundationBefore)} AQUARI`);
    console.log(`  Total Supply:      ${formatEther(totalSupplyBefore)} AQUARI`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 4: ADD LIQUIDITY (WITH FEES)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  SECTION 4: ADD LIQUIDITY (Testing Tax Impact)                             ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    // Calculate how much AQUARI needed for 1 ETH at current ratio
    const aquariForOneEth = (aquariReserve * testEthAmount) / ethReserve;
    
    // We'll try to add slightly more AQUARI to account for potential tax
    const aquariToAdd = aquariForOneEth + (aquariForOneEth / 100n); // +1% buffer
    const ethToAdd = testEthAmount;

    console.log("📝 ATTEMPTING TO ADD LIQUIDITY");
    console.log("─".repeat(78));
    console.log(`  AQUARI to add:     ${formatEther(aquariToAdd)} AQUARI`);
    console.log(`  ETH to add:        ${formatEther(ethToAdd)} ETH`);
    console.log(`  Expected ratio:    ${(Number(aquariReserve) / Number(ethReserve)).toFixed(2)} AQUARI/ETH`);

    // Approve router
    await aquari.connect(testUser).approve(BASE.router, aquariToAdd);
    console.log("  ✅ Approved router to spend AQUARI");

    // Record state before add
    const [reserveBefore0, reserveBefore1] = await pair.getReserves();
    let aquariReserveBefore, ethReserveBefore;
    if (token0.toLowerCase() === AQUARI_ADDRESS.toLowerCase()) {
        aquariReserveBefore = reserveBefore0;
        ethReserveBefore = reserveBefore1;
    } else {
        ethReserveBefore = reserveBefore0;
        aquariReserveBefore = reserveBefore1;
    }

    const lpTotalSupplyBefore = await pair.totalSupply();
    const userLpBefore = await pair.balanceOf(testUser.address);

    console.log("\n  Reserves BEFORE add:");
    console.log(`    AQUARI: ${formatEther(aquariReserveBefore)}`);
    console.log(`    ETH:    ${formatEther(ethReserveBefore)}`);

    // Add liquidity
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    let addLiquidityResult;
    try {
        console.log("\n  📤 Calling addLiquidityETH()...");
        
        const addTx = await router.connect(testUser).addLiquidityETH(
            AQUARI_ADDRESS,
            aquariToAdd,
            0, // Accept any amount (for testing)
            0, // Accept any amount (for testing)
            testUser.address,
            deadline,
            { value: ethToAdd }
        );
        
        const receipt = await addTx.wait();
        console.log(`  ✅ Transaction successful! Gas used: ${receipt.gasUsed}`);
        
        // Parse events to get actual amounts
        addLiquidityResult = { success: true };
        
    } catch (error) {
        console.log(`  ❌ Add liquidity failed: ${error.message}`);
        addLiquidityResult = { success: false, error: error.message };
    }

    // Record state after add
    const [reserveAfter0, reserveAfter1] = await pair.getReserves();
    let aquariReserveAfter, ethReserveAfter;
    if (token0.toLowerCase() === AQUARI_ADDRESS.toLowerCase()) {
        aquariReserveAfter = reserveAfter0;
        ethReserveAfter = reserveAfter1;
    } else {
        ethReserveAfter = reserveAfter0;
        aquariReserveAfter = reserveAfter1;
    }

    const lpTotalSupplyAfter = await pair.totalSupply();
    const userLpAfter = await pair.balanceOf(testUser.address);
    const userAquariAfterAdd = await aquari.balanceOf(testUser.address);
    const userEthAfterAdd = await ethers.provider.getBalance(testUser.address);
    const foundationAfterAdd = await aquari.balanceOf(foundationWallet);
    const totalSupplyAfterAdd = await aquari.totalSupply();

    console.log("\n  Reserves AFTER add:");
    console.log(`    AQUARI: ${formatEther(aquariReserveAfter)}`);
    console.log(`    ETH:    ${formatEther(ethReserveAfter)}`);

    const aquariAdded = aquariReserveAfter - aquariReserveBefore;
    const ethAdded = ethReserveAfter - ethReserveBefore;
    const lpMinted = userLpAfter - userLpBefore;

    console.log("\n📊 ADD LIQUIDITY RESULTS");
    console.log("─".repeat(78));
    console.log(`  AQUARI sent by user:     ${formatEther(userAquariBefore - userAquariAfterAdd)} AQUARI`);
    console.log(`  AQUARI added to pool:    ${formatEther(aquariAdded)} AQUARI`);
    console.log(`  ETH added to pool:       ${formatEther(ethAdded)} ETH`);
    console.log(`  LP tokens received:      ${formatEther(lpMinted)} LP`);
    
    const aquariTaxOnAdd = (userAquariBefore - userAquariAfterAdd) - aquariAdded;
    const burnedOnAdd = totalSupplyBefore - totalSupplyAfterAdd;
    const foundationReceivedOnAdd = foundationAfterAdd - foundationBefore;

    console.log("\n  💰 TAX ANALYSIS (Add Liquidity):");
    console.log(`    Total tax taken:       ${formatEther(aquariTaxOnAdd)} AQUARI`);
    console.log(`    Burned:                ${formatEther(burnedOnAdd)} AQUARI`);
    console.log(`    To foundation:         ${formatEther(foundationReceivedOnAdd)} AQUARI`);
    console.log(`    Tax percentage:        ${formatPercent(aquariTaxOnAdd, userAquariBefore - userAquariAfterAdd)}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 5: REMOVE LIQUIDITY (WITH FEES)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  SECTION 5: REMOVE LIQUIDITY (Testing Tax Impact)                          ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    if (userLpAfter === 0n) {
        console.log("  ⚠️  No LP tokens to remove. Skipping remove test.");
    } else {
        // Calculate expected amounts from LP removal
        const lpShare = (userLpAfter * 10000n) / lpTotalSupplyAfter;
        const expectedAquari = (aquariReserveAfter * userLpAfter) / lpTotalSupplyAfter;
        const expectedEth = (ethReserveAfter * userLpAfter) / lpTotalSupplyAfter;

        console.log("📝 REMOVING ALL LIQUIDITY");
        console.log("─".repeat(78));
        console.log(`  LP tokens to remove: ${formatEther(userLpAfter)} LP`);
        console.log(`  LP share of pool:    ${Number(lpShare) / 100}%`);
        console.log(`  Expected AQUARI:     ${formatEther(expectedAquari)} AQUARI`);
        console.log(`  Expected ETH:        ${formatEther(expectedEth)} ETH`);

        // Approve LP tokens
        await pair.connect(testUser).approve(BASE.router, userLpAfter);
        console.log("  ✅ Approved router to spend LP tokens");

        // Record state before remove
        const userAquariBeforeRemove = await aquari.balanceOf(testUser.address);
        const userEthBeforeRemove = await ethers.provider.getBalance(testUser.address);
        const foundationBeforeRemove = await aquari.balanceOf(foundationWallet);
        const totalSupplyBeforeRemove = await aquari.totalSupply();

        // Try both methods: regular and SupportingFeeOnTransfer
        console.log("\n  📤 Method 1: removeLiquidityETHSupportingFeeOnTransferTokens()...");
        
        try {
            const removeTx = await router.connect(testUser).removeLiquidityETHSupportingFeeOnTransferTokens(
                AQUARI_ADDRESS,
                userLpAfter,
                0, // Accept any amount (for testing)
                0, // Accept any amount (for testing)
                testUser.address,
                deadline
            );
            
            const receipt = await removeTx.wait();
            console.log(`  ✅ Transaction successful! Gas used: ${receipt.gasUsed}`);
            
        } catch (error) {
            console.log(`  ❌ SupportingFeeOnTransfer failed: ${error.message}`);
            
            console.log("\n  📤 Method 2: Trying regular removeLiquidityETH()...");
            try {
                const removeTx2 = await router.connect(testUser).removeLiquidityETH(
                    AQUARI_ADDRESS,
                    userLpAfter,
                    0,
                    0,
                    testUser.address,
                    deadline
                );
                await removeTx2.wait();
                console.log(`  ✅ Regular method worked!`);
            } catch (error2) {
                console.log(`  ❌ Regular method also failed: ${error2.message}`);
            }
        }

        // Record state after remove
        const userAquariAfterRemove = await aquari.balanceOf(testUser.address);
        const userEthAfterRemove = await ethers.provider.getBalance(testUser.address);
        const foundationAfterRemove = await aquari.balanceOf(foundationWallet);
        const totalSupplyAfterRemove = await aquari.totalSupply();
        const userLpAfterRemove = await pair.balanceOf(testUser.address);

        const aquariReceived = userAquariAfterRemove - userAquariBeforeRemove;
        const ethReceived = userEthAfterRemove - userEthBeforeRemove;
        const aquariTaxOnRemove = expectedAquari - aquariReceived;
        const burnedOnRemove = totalSupplyBeforeRemove - totalSupplyAfterRemove;
        const foundationReceivedOnRemove = foundationAfterRemove - foundationBeforeRemove;

        console.log("\n📊 REMOVE LIQUIDITY RESULTS");
        console.log("─".repeat(78));
        console.log(`  Expected AQUARI:         ${formatEther(expectedAquari)} AQUARI`);
        console.log(`  Actual AQUARI received:  ${formatEther(aquariReceived)} AQUARI`);
        console.log(`  ETH received:            ${formatEther(ethReceived)} ETH`);
        console.log(`  LP tokens remaining:     ${formatEther(userLpAfterRemove)} LP`);

        console.log("\n  💰 TAX ANALYSIS (Remove Liquidity):");
        console.log(`    Total tax taken:       ${formatEther(aquariTaxOnRemove)} AQUARI`);
        console.log(`    Burned:                ${formatEther(burnedOnRemove)} AQUARI`);
        console.log(`    To foundation:         ${formatEther(foundationReceivedOnRemove)} AQUARI`);
        console.log(`    Tax percentage:        ${formatPercent(aquariTaxOnRemove, expectedAquari)}`);

        // ═══════════════════════════════════════════════════════════════════════════
        // SECTION 6: FINAL SUMMARY
        // ═══════════════════════════════════════════════════════════════════════════
        console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
        console.log("║  SECTION 6: FINAL SUMMARY                                                  ║");
        console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

        const totalAquariLost = userAquariBefore - userAquariAfterRemove;
        const totalBurned = totalSupplyBefore - totalSupplyAfterRemove;
        const totalToFoundation = foundationAfterRemove - foundationBefore;

        // Calculate net position
        const netAquariChange = userAquariAfterRemove - userAquariBefore;
        const netEthChange = userEthAfterRemove - userEthBefore;

        console.log("📊 USER NET POSITION CHANGE");
        console.log("─".repeat(78));
        console.log(`  Started with:        ${formatEther(userAquariBefore)} AQUARI`);
        console.log(`  Ended with:          ${formatEther(userAquariAfterRemove)} AQUARI`);
        console.log(`  Net AQUARI change:   ${formatEther(netAquariChange)} AQUARI`);
        console.log(`  Net ETH change:      ${formatEther(netEthChange)} ETH (includes gas)`);

        console.log("\n📊 TOTAL TAX IMPACT (Add + Remove Cycle)");
        console.log("─".repeat(78));
        console.log(`  Total AQUARI lost:   ${formatEther(totalAquariLost)} AQUARI`);
        console.log(`  Total burned:        ${formatEther(totalBurned)} AQUARI`);
        console.log(`  Total to foundation: ${formatEther(totalToFoundation)} AQUARI`);
        console.log(`  Overall tax rate:    ${formatPercent(totalAquariLost, userAquariBefore - userAquariAfterRemove + totalAquariLost)}`);

        console.log("\n📊 POOL STATE COMPARISON");
        console.log("─".repeat(78));
        
        const [finalReserve0, finalReserve1] = await pair.getReserves();
        let finalAquariReserve, finalEthReserve;
        if (token0.toLowerCase() === AQUARI_ADDRESS.toLowerCase()) {
            finalAquariReserve = finalReserve0;
            finalEthReserve = finalReserve1;
        } else {
            finalEthReserve = finalReserve0;
            finalAquariReserve = finalReserve1;
        }

        console.log("                        Before LP Ops    After LP Ops     Change");
        console.log(`  AQUARI Reserve:       ${formatEther(aquariReserveBefore).padEnd(16)} ${formatEther(finalAquariReserve).padEnd(16)} ${formatEther(finalAquariReserve - aquariReserveBefore)}`);
        console.log(`  ETH Reserve:          ${formatEther(ethReserveBefore).padEnd(16)} ${formatEther(finalEthReserve).padEnd(16)} ${formatEther(finalEthReserve - ethReserveBefore)}`);
        console.log(`  Price (AQUARI/ETH):   ${(Number(aquariReserveBefore) / Number(ethReserveBefore)).toFixed(2).padEnd(16)} ${(Number(finalAquariReserve) / Number(finalEthReserve)).toFixed(2).padEnd(16)}`);

        // Check for imbalance
        const initialRatio = Number(aquariReserveBefore) / Number(ethReserveBefore);
        const finalRatio = Number(finalAquariReserve) / Number(finalEthReserve);
        const ratioChange = ((finalRatio - initialRatio) / initialRatio) * 100;

        console.log("\n📊 IMBALANCE CHECK");
        console.log("─".repeat(78));
        console.log(`  Initial ratio:       ${initialRatio.toFixed(6)} AQUARI/ETH`);
        console.log(`  Final ratio:         ${finalRatio.toFixed(6)} AQUARI/ETH`);
        console.log(`  Ratio change:        ${ratioChange.toFixed(4)}%`);
        
        if (Math.abs(ratioChange) < 0.01) {
            console.log("  ✅ Pool remains BALANCED (< 0.01% change)");
        } else if (Math.abs(ratioChange) < 0.1) {
            console.log("  ⚠️  Minor imbalance detected (< 0.1% change)");
        } else {
            console.log("  🚨 Significant imbalance detected!");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION 7: CONCLUSIONS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  CONCLUSIONS                                                               ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

    console.log("  📋 KEY FINDINGS:");
    console.log("  ─".repeat(39));
    console.log("  1. Add Liquidity:    Tax IS/ISN'T applied (check results above)");
    console.log("  2. Remove Liquidity: Tax IS/ISN'T applied (check results above)");
    console.log("  3. Pool Balance:     Check 'IMBALANCE CHECK' section above");
    console.log("  4. LP Providers:     Will lose X% on add/remove cycle");
    console.log("");
    console.log("  ⚠️  RECOMMENDATIONS:");
    console.log("  ─".repeat(39));
    console.log("  • If tax applies to LP operations: Consider excluding router");
    console.log("  • Announce fee activation 48-72 hours in advance");
    console.log("  • Let existing LPs remove before fees activate");
    console.log("  • Document expected behavior for new LPs");

    console.log("\n╔════════════════════════════════════════════════════════════════════════════╗");
    console.log("║  TEST COMPLETE                                                             ║");
    console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Fatal Error:", error);
        process.exit(1);
    });