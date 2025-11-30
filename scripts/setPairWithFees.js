const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║         SET PAIR AND CONFIGURE TAX FEES (2.5% TOTAL)          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  const WETH = deploymentInfo.baseAddresses.weth;
  const FACTORY = deploymentInfo.baseAddresses.factory;

  const [deployer] = await ethers.getSigners();
  
  console.log("📋 CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log("AQUARI Token:", AQUARI);
  console.log("WETH:", WETH);
  console.log("Factory:", FACTORY);

  // Factory ABI
  const factoryABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function createPair(address tokenA, address tokenB) external returns (address pair)"
  ];

  // Aquari ABI
  const aquariABI = [
    "function setUniswapV2Pair(address _pair) external",
    "function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee) external",
    "function uniswapV2Pair() external view returns (address)",
    "function pairIsSet() external view returns (bool)",
    "function burnTax() external view returns (uint256)",
    "function foundationFee() external view returns (uint256)",
    "function foundationWallet() external view returns (address)",
    "function owner() external view returns (address)"
  ];

  const factory = await ethers.getContractAt(factoryABI, FACTORY);
  const aquari = await ethers.getContractAt(aquariABI, AQUARI);

  // Verify ownership
  const owner = await aquari.owner();
  console.log("\n🔐 OWNERSHIP CHECK");
  console.log("═".repeat(70));
  console.log("Contract Owner:", owner);
  console.log("Deployer:", deployer.address);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ ERROR: Deployer is not the contract owner!");
    console.log("Only the owner can set the pair and configure taxes.");
    process.exit(1);
  }
  console.log("✅ Deployer is the owner");

  // ==========================================================================
  // STEP 1: Check/Create Pair
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 1: CHECK/CREATE UNISWAP V2 PAIR                         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("Checking if pair exists...");
  let pairAddress = await factory.getPair(AQUARI, WETH);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("❌ Pair does not exist. Creating pair...");
    
    const createTx = await factory.createPair(AQUARI, WETH);
    console.log("Transaction hash:", createTx.hash);
    console.log("Waiting for confirmation...");
    await createTx.wait();
    
    pairAddress = await factory.getPair(AQUARI, WETH);
    console.log("✅ Pair created at:", pairAddress);
  } else {
    console.log("✅ Pair already exists at:", pairAddress);
  }

  // ==========================================================================
  // STEP 2: Check Current State
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 2: CHECK CURRENT CONTRACT STATE                         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const currentPair = await aquari.uniswapV2Pair();
  const pairIsSet = await aquari.pairIsSet();
  const currentBurnTax = await aquari.burnTax();
  const currentFoundationFee = await aquari.foundationFee();
  const foundationWallet = await aquari.foundationWallet();

  console.log("💸 CURRENT STATE");
  console.log("═".repeat(70));
  console.log("Current Pair Address:", currentPair);
  console.log("Pair Is Set:", pairIsSet);
  console.log("Current Burn Tax:", currentBurnTax.toString(), "bps =", (Number(currentBurnTax) / 100).toFixed(2) + "%");
  console.log("Current Foundation Fee:", currentFoundationFee.toString(), "bps =", (Number(currentFoundationFee) / 100).toFixed(2) + "%");
  console.log("Current Total Tax:", (Number(currentBurnTax) + Number(currentFoundationFee)).toString(), "bps =", ((Number(currentBurnTax) + Number(currentFoundationFee)) / 100).toFixed(2) + "%");
  console.log("Foundation Wallet:", foundationWallet);

  // ==========================================================================
  // STEP 3: Set Tax Configuration FIRST (Before Setting Pair)
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 3: CONFIGURE TAX FEES                                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const DESIRED_BURN_TAX = 125;        // 1.25% = 125 basis points
  const DESIRED_FOUNDATION_FEE = 125;  // 1.25% = 125 basis points
  const TOTAL_TAX = DESIRED_BURN_TAX + DESIRED_FOUNDATION_FEE; // 2.5% = 250 bps

  console.log("🎯 DESIRED TAX CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Desired Burn Tax:", DESIRED_BURN_TAX, "bps =", (DESIRED_BURN_TAX / 100).toFixed(2) + "%");
  console.log("Desired Foundation Fee:", DESIRED_FOUNDATION_FEE, "bps =", (DESIRED_FOUNDATION_FEE / 100).toFixed(2) + "%");
  console.log("Total Tax:", TOTAL_TAX, "bps =", (TOTAL_TAX / 100).toFixed(2) + "%");

  // Check if we need to update taxes
  const needsTaxUpdate = (Number(currentBurnTax) !== DESIRED_BURN_TAX) || 
                         (Number(currentFoundationFee) !== DESIRED_FOUNDATION_FEE);

  if (needsTaxUpdate) {
    console.log("\n📝 Setting tax configuration...");
    console.log("Burn Tax: 0% →", (DESIRED_BURN_TAX / 100).toFixed(2) + "%");
    console.log("Foundation Fee:", (Number(currentFoundationFee) / 100).toFixed(2) + "% →", (DESIRED_FOUNDATION_FEE / 100).toFixed(2) + "%");
    
    try {
      const setTaxTx = await aquari.setTaxConfig(DESIRED_BURN_TAX, DESIRED_FOUNDATION_FEE);
      console.log("Transaction hash:", setTaxTx.hash);
      console.log("Waiting for confirmation...");
      await setTaxTx.wait();
      console.log("✅ Tax configuration updated successfully!");

      // Verify tax update
      const newBurnTax = await aquari.burnTax();
      const newFoundationFee = await aquari.foundationFee();
      
      console.log("\n🔍 VERIFICATION");
      console.log("═".repeat(70));
      console.log("New Burn Tax:", newBurnTax.toString(), "bps =", (Number(newBurnTax) / 100).toFixed(2) + "%");
      console.log("New Foundation Fee:", newFoundationFee.toString(), "bps =", (Number(newFoundationFee) / 100).toFixed(2) + "%");
      console.log("Total Tax:", (Number(newBurnTax) + Number(newFoundationFee)).toString(), "bps =", ((Number(newBurnTax) + Number(newFoundationFee)) / 100).toFixed(2) + "%");

      if (Number(newBurnTax) === DESIRED_BURN_TAX && Number(newFoundationFee) === DESIRED_FOUNDATION_FEE) {
        console.log("✅ Tax rates match desired configuration!");
      } else {
        console.log("⚠️  Tax rates don't match. Something went wrong.");
      }
    } catch (error) {
      console.error("\n❌ Failed to set tax configuration");
      console.error("Error:", error.message);
      throw error;
    }
  } else {
    console.log("\n✅ Tax configuration already matches desired values!");
  }

  // ==========================================================================
  // STEP 4: Set Pair in Contract
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 4: SET PAIR IN CONTRACT                                  ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  if (!pairIsSet) {
    console.log("📝 Setting pair in Aquari contract...");
    console.log("Pair Address:", pairAddress);
    
    try {
      const setPairTx = await aquari.setUniswapV2Pair(pairAddress);
      console.log("Transaction hash:", setPairTx.hash);
      console.log("Waiting for confirmation...");
      await setPairTx.wait();
      console.log("✅ Pair set successfully!");

      // Verify pair setting
      const newPair = await aquari.uniswapV2Pair();
      const newPairIsSet = await aquari.pairIsSet();
      
      console.log("\n🔍 VERIFICATION");
      console.log("═".repeat(70));
      console.log("New Pair Address:", newPair);
      console.log("Pair Is Set:", newPairIsSet);
      console.log("Pair Match:", newPair.toLowerCase() === pairAddress.toLowerCase());

      if (newPairIsSet && newPair.toLowerCase() === pairAddress.toLowerCase()) {
        console.log("✅ Pair configuration verified!");
      } else {
        console.log("⚠️  Pair configuration mismatch. Check contract state.");
      }
    } catch (error) {
      console.error("\n❌ Failed to set pair");
      console.error("Error:", error.message);
      
      if (error.message.includes("PairAlreadySet")) {
        console.log("\n💡 The pair is already set and cannot be changed.");
        console.log("This is a security feature to prevent pair manipulation.");
      }
      
      throw error;
    }
  } else {
    console.log("✅ Pair is already set in contract!");
    console.log("Current Pair:", currentPair);
    console.log("Target Pair:", pairAddress);
    
    if (currentPair.toLowerCase() !== pairAddress.toLowerCase()) {
      console.log("\n⚠️  WARNING: Current pair doesn't match expected pair!");
      console.log("The pair can only be set once and cannot be changed.");
    }
  }

  // ==========================================================================
  // STEP 5: Update Deployment Info
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  STEP 5: UPDATE DEPLOYMENT INFO                                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  deploymentInfo.pairAddress = pairAddress;
  deploymentInfo.taxConfiguration = {
    burnTax: DESIRED_BURN_TAX,
    foundationFee: DESIRED_FOUNDATION_FEE,
    totalTax: TOTAL_TAX,
    burnTaxPercent: (DESIRED_BURN_TAX / 100).toFixed(2) + "%",
    foundationFeePercent: (DESIRED_FOUNDATION_FEE / 100).toFixed(2) + "%",
    totalTaxPercent: (TOTAL_TAX / 100).toFixed(2) + "%",
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Deployment info updated with pair address and tax configuration");

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  FINAL SUMMARY                                                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const finalBurnTax = await aquari.burnTax();
  const finalFoundationFee = await aquari.foundationFee();
  const finalPairIsSet = await aquari.pairIsSet();
  const finalPair = await aquari.uniswapV2Pair();

  console.log("📊 FINAL CONTRACT STATE");
  console.log("═".repeat(70));
  console.log("Pair Address:", finalPair);
  console.log("Pair Is Set:", finalPairIsSet);
  console.log("Burn Tax:", finalBurnTax.toString(), "bps =", (Number(finalBurnTax) / 100).toFixed(2) + "%");
  console.log("Foundation Fee:", finalFoundationFee.toString(), "bps =", (Number(finalFoundationFee) / 100).toFixed(2) + "%");
  console.log("Total Tax:", (Number(finalBurnTax) + Number(finalFoundationFee)).toString(), "bps =", ((Number(finalBurnTax) + Number(finalFoundationFee)) / 100).toFixed(2) + "%");
  console.log("Foundation Wallet:", foundationWallet);

  console.log("\n⚠️  IMPORTANT NOTES");
  console.log("═".repeat(70));
  console.log("✅ Taxes are now configured: 1.25% burn + 1.25% foundation = 2.5% total");
  console.log("✅ The pair is set - taxes will be applied to all buy/sell trades");
  console.log("✅ Excluded addresses (like deployer) still won't pay taxes");
  console.log("✅ The pair CANNOT be changed once set (security feature)");
  console.log("\n📝 Next Steps:");
  console.log("   1. Test swaps with: npx hardhat run scripts/testSwapsDeployer.js --network localhost");
  console.log("   2. Verify taxes are being applied correctly");
  console.log("   3. Deploy to mainnet when ready");

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║           CONFIGURATION COMPLETED SUCCESSFULLY                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });