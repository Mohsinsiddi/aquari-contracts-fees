const { ethers } = require("hardhat");
const fs = require('fs');

/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║  CHECK AQUARI FEE DETECTION - UNISWAP FeeOnTransferDetector            ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 * 
 * This script checks if Uniswap's FeeOnTransferDetector can detect
 * fees on your AQUARI token (on Base mainnet fork).
 * 
 * It tests:
 * 1. Before pair is set (should NOT detect fees)
 * 2. After pair is set (SHOULD detect fees)
 * 
 * Run on Base mainnet fork:
 *   Terminal 1: npx hardhat node --fork https://mainnet.base.org
 *   Terminal 2: npx hardhat run scripts/checkFeeDetection.js --network localhost
 */

// Base Mainnet addresses
const BASE = {
    feeDetector: "0xCF6220e4496B091a6b391D48e770f1FbaC63E740",
    v2Factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    weth: "0x4200000000000000000000000000000000000006",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

// ABIs
const FEE_DETECTOR_ABI = [
    "function validate(address token, address[] calldata baseTokens, uint256 amountToBorrow) external returns (uint8)",
    "function batchValidate(address[] calldata tokens, address[] calldata baseTokens, uint256 amountToBorrow) external returns (uint8[])",
];

const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
];

const AQUARI_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function pairIsSet() view returns (bool)",
    "function uniswapV2Pair() view returns (address)",
    "function burnTax() view returns (uint256)",
    "function foundationFee() view returns (uint256)",
    "function foundationWallet() view returns (address)",
    "function setUniswapV2Pair(address) external",
    "function owner() view returns (address)",
];

const FACTORY_ABI = [
    "function getPair(address, address) view returns (address)",
];

const PAIR_ABI = [
    "function getReserves() view returns (uint112, uint112, uint32)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function totalSupply() view returns (uint256)",
];

// Status enum from Uniswap's ITokenValidator
const STATUS = {
    0: "UNKN - Unknown (no issues detected)",
    1: "FOT  - Fee-On-Transfer DETECTED! ✅",
    2: "STF  - Transfer Failed",
};

async function main() {
    console.log("╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║  AQUARI FEE DETECTION TEST - Using Uniswap FeeOnTransferDetector       ║");
    console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

    // Load deployment info
    let AQUARI;
    let PAIR;
    
    if (fs.existsSync('deployment-info.json')) {
        const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
        AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
        PAIR = deploymentInfo.pairAddress;
        console.log("📁 Loaded from deployment-info.json");
    } else {
        console.log("⚠️  deployment-info.json not found!");
        console.log("   Please set AQUARI address manually in this script.");
        AQUARI = "0xYOUR_AQUARI_ADDRESS"; // <-- UPDATE THIS IF NO deployment-info.json
        PAIR = null;
    }

    const [deployer] = await ethers.getSigners();

    console.log("\n📋 CONFIGURATION");
    console.log("─".repeat(76));
    console.log("  Fee Detector:  ", BASE.feeDetector);
    console.log("  AQUARI Token:  ", AQUARI);
    console.log("  WETH:          ", BASE.weth);
    console.log("  V2 Factory:    ", BASE.v2Factory);
    console.log("  Deployer:      ", deployer.address);

    // Get contracts
    const feeDetector = await ethers.getContractAt(FEE_DETECTOR_ABI, BASE.feeDetector);
    const aquari = await ethers.getContractAt(AQUARI_ABI, AQUARI);
    const factory = await ethers.getContractAt(FACTORY_ABI, BASE.v2Factory);

    // Get token info
    console.log("\n📊 AQUARI TOKEN INFO");
    console.log("─".repeat(76));
    
    try {
        const name = await aquari.name();
        const symbol = await aquari.symbol();
        const totalSupply = await aquari.totalSupply();
        const burnTax = await aquari.burnTax();
        const foundationFee = await aquari.foundationFee();
        const pairIsSet = await aquari.pairIsSet();
        const contractPair = await aquari.uniswapV2Pair();

        console.log("  Name:           ", name);
        console.log("  Symbol:         ", symbol);
        console.log("  Total Supply:   ", ethers.formatEther(totalSupply));
        console.log("  Burn Tax:       ", `${burnTax} bps (${Number(burnTax) / 100}%)`);
        console.log("  Foundation Fee: ", `${foundationFee} bps (${Number(foundationFee) / 100}%)`);
        console.log("  Total Tax:      ", `${Number(burnTax) + Number(foundationFee)} bps (${(Number(burnTax) + Number(foundationFee)) / 100}%)`);
        console.log("  Pair Is Set:    ", pairIsSet ? "✅ YES" : "❌ NO");
        console.log("  Contract Pair:  ", contractPair);
    } catch (error) {
        console.log("  ❌ Error reading token info:", error.message);
    }

    // Check if pair exists
    console.log("\n🔍 CHECKING UNISWAP V2 PAIR");
    console.log("─".repeat(76));

    let pairAddress = await factory.getPair(AQUARI, BASE.weth);
    
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
        console.log("  ❌ No AQUARI/WETH pair exists!");
        console.log("     Fee detection requires a liquidity pool.");
        console.log("     Run 03-create-pair.js first to create the pair.");
        return;
    }

    console.log("  ✅ Pair found: ", pairAddress);

    // Check pair liquidity
    const pair = await ethers.getContractAt(PAIR_ABI, pairAddress);
    const [reserve0, reserve1] = await pair.getReserves();
    const token0 = await pair.token0();

    let ethReserve, aquariReserve;
    if (token0.toLowerCase() === AQUARI.toLowerCase()) {
        aquariReserve = reserve0;
        ethReserve = reserve1;
    } else {
        ethReserve = reserve0;
        aquariReserve = reserve1;
    }

    console.log("  ETH Reserve:    ", ethers.formatEther(ethReserve), "ETH");
    console.log("  AQUARI Reserve: ", ethers.formatEther(aquariReserve), "AQUARI");

    if (ethReserve === 0n || aquariReserve === 0n) {
        console.log("\n  ⚠️  Pair has no liquidity!");
        console.log("     Fee detection requires liquidity in the pool.");
        return;
    }

    // =========================================================================
    // TEST 1: Check current fee detection status
    // =========================================================================
    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║  TEST 1: CURRENT FEE DETECTION STATUS                                  ║");
    console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

    const pairIsSet = await aquari.pairIsSet();
    console.log("  Pair Is Set in Contract:", pairIsSet ? "✅ YES (fees active)" : "❌ NO (fees NOT active)");

    console.log("\n  📝 Calling FeeOnTransferDetector.validate()...");
    console.log("     Token:          ", AQUARI);
    console.log("     Base Tokens:    ", `[WETH: ${BASE.weth}]`);
    console.log("     Amount:         ", "1 ETH worth");

    try {
        // Call validate with staticCall to get result without state change
        const amountToBorrow = ethers.parseEther("1");
        const status = await feeDetector.validate.staticCall(
            AQUARI,
            [BASE.weth],
            amountToBorrow
        );

        console.log("\n  📊 DETECTION RESULT");
        console.log("  ─".repeat(38));
        console.log("    Status Code:", status);
        console.log("    Meaning:    ", STATUS[status] || "Unknown status");

        if (status === 1n || status === 1) {
            console.log("\n  🎉 FEE-ON-TRANSFER DETECTED!");
            console.log("     Uniswap's detector found that AQUARI takes a fee on transfers.");
            console.log("     The frontend will automatically use SupportingFeeOnTransfer functions.");
        } else if (status === 0n || status === 0) {
            console.log("\n  ℹ️  NO FEE DETECTED");
            if (!pairIsSet) {
                console.log("     This is EXPECTED because pair is NOT set in contract.");
                console.log("     Fees are only active when pairIsSet = true.");
            } else {
                console.log("     ⚠️  Unexpected! Pair is set but no fee detected.");
                console.log("     This could mean:");
                console.log("       - Tax rates are 0%");
                console.log("       - Detection failed for some reason");
            }
        } else if (status === 2n || status === 2) {
            console.log("\n  ❌ TRANSFER FAILED");
            console.log("     The detector couldn't transfer tokens.");
            console.log("     Check if trading is enabled and no restrictions apply.");
        }

    } catch (error) {
        console.log("\n  ❌ Detection failed:", error.message);
        
        if (error.message.includes("insufficient")) {
            console.log("     The pair may not have enough liquidity for the test.");
        }
    }

    // =========================================================================
    // TEST 2: If pair not set, set it and test again
    // =========================================================================
    const currentPairIsSet = await aquari.pairIsSet();
    
    if (!currentPairIsSet) {
        console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
        console.log("║  TEST 2: SET PAIR AND RE-CHECK DETECTION                               ║");
        console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

        console.log("  Pair is NOT set. Setting it now to activate fees...");

        try {
            // Check if we're the owner
            const owner = await aquari.owner();
            if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
                console.log("  ⚠️  You are not the owner. Cannot set pair.");
                console.log("     Owner:", owner);
                console.log("     You:  ", deployer.address);
                return;
            }

            // Set the pair
            console.log("\n  📝 Setting pair...");
            const setPairTx = await aquari.setUniswapV2Pair(pairAddress);
            await setPairTx.wait();
            console.log("  ✅ Pair set successfully!");

            // Verify
            const newPairIsSet = await aquari.pairIsSet();
            console.log("  Pair Is Set:", newPairIsSet ? "✅ YES" : "❌ NO");

            // Re-run detection
            console.log("\n  📝 Re-running fee detection...");
            
            const amountToBorrow = ethers.parseEther("1");
            const newStatus = await feeDetector.validate.staticCall(
                AQUARI,
                [BASE.weth],
                amountToBorrow
            );

            console.log("\n  📊 NEW DETECTION RESULT (After Setting Pair)");
            console.log("  ─".repeat(38));
            console.log("    Status Code:", newStatus);
            console.log("    Meaning:    ", STATUS[newStatus] || "Unknown status");

            if (newStatus === 1n || newStatus === 1) {
                console.log("\n  🎉 SUCCESS! FEE-ON-TRANSFER NOW DETECTED!");
                console.log("     Before pair set: Not detected");
                console.log("     After pair set:  DETECTED ✅");
                console.log("");
                console.log("     This confirms:");
                console.log("     • Your tax logic is working correctly");
                console.log("     • Uniswap will auto-detect your token's fees");
                console.log("     • Users will see fee warnings in the UI");
            } else {
                console.log("\n  ⚠️  Fee still not detected after setting pair.");
                console.log("     This is unexpected. Possible reasons:");
                console.log("     • Tax rates might be 0");
                console.log("     • Tax logic might have a bug");
                console.log("     • Detector might not work on fork");
            }

        } catch (error) {
            console.log("  ❌ Error:", error.message);
        }
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║  SUMMARY                                                               ║");
    console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

    const finalPairIsSet = await aquari.pairIsSet();
    const finalBurnTax = await aquari.burnTax();
    const finalFoundationFee = await aquari.foundationFee();

    console.log("  📊 FINAL STATE");
    console.log("  ─".repeat(38));
    console.log("    Token:         ", AQUARI);
    console.log("    Pair:          ", pairAddress);
    console.log("    Pair Is Set:   ", finalPairIsSet ? "✅ YES (fees ACTIVE)" : "❌ NO (fees NOT active)");
    console.log("    Burn Tax:      ", `${Number(finalBurnTax) / 100}%`);
    console.log("    Foundation:    ", `${Number(finalFoundationFee) / 100}%`);
    console.log("    Total Tax:     ", `${(Number(finalBurnTax) + Number(finalFoundationFee)) / 100}%`);

    console.log("\n  📝 HOW UNISWAP FRONTEND USES THIS");
    console.log("  ─".repeat(38));
    console.log("    1. User selects AQUARI to swap");
    console.log("    2. Frontend calls FeeOnTransferDetector.validate()");
    console.log("    3. Detector returns FOT (status 1) if fees detected");
    console.log("    4. Frontend shows warning: 'This token has a fee'");
    console.log("    5. Frontend uses SupportingFeeOnTransfer router function");
    console.log("    6. Swap succeeds with fees applied ✅");

    console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
    console.log("║  FEE DETECTION TEST COMPLETE                                           ║");
    console.log("╚════════════════════════════════════════════════════════════════════════╝\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Fatal Error:", error.message);
        process.exit(1);
    });