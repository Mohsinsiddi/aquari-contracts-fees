const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║         PAIR EXCLUSION DIAGNOSTIC (CRITICAL CHECK)             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  const PAIR = deploymentInfo.pairAddress;

  const [deployer, trader] = await ethers.getSigners();

  console.log("📋 ADDRESSES");
  console.log("═".repeat(70));
  console.log("AQUARI Token:", AQUARI);
  console.log("Pair Address:", PAIR);
  console.log("Deployer:", deployer.address);
  console.log("Trader:", trader.address);

  const aquariABI = [
    "function getExcludedAddresses() external view returns (address[] memory)",
    "function isExcludedFromTax(address account) external view returns (bool)",
    "function pairIsSet() external view returns (bool)",
    "function uniswapV2Pair() external view returns (address)",
    "function burnTax() external view returns (uint256)",
    "function foundationFee() external view returns (uint256)"
  ];

  const aquari = await ethers.getContractAt(aquariABI, AQUARI);

  // Check if pair is set
  const pairIsSet = await aquari.pairIsSet();
  const contractPair = await aquari.uniswapV2Pair();

  console.log("\n💸 PAIR STATUS");
  console.log("═".repeat(70));
  console.log("Pair Is Set:", pairIsSet);
  console.log("Contract Pair:", contractPair);
  console.log("Expected Pair:", PAIR);
  console.log("Match:", contractPair.toLowerCase() === PAIR.toLowerCase());

  // Get tax config
  const burnTax = await aquari.burnTax();
  const foundationFee = await aquari.foundationFee();

  console.log("\n💰 TAX CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Burn Tax:", (Number(burnTax) / 100).toFixed(2) + "%");
  console.log("Foundation Fee:", (Number(foundationFee) / 100).toFixed(2) + "%");
  console.log("Total Tax:", ((Number(burnTax) + Number(foundationFee)) / 100).toFixed(2) + "%");

  // Get all excluded addresses
  console.log("\n📋 EXCLUDED ADDRESSES (_excludedAddresses set)");
  console.log("═".repeat(70));
  
  let excludedAddresses;
  try {
    excludedAddresses = await aquari.getExcludedAddresses();
    console.log("Total excluded addresses:", excludedAddresses.length);
    console.log("");
    
    for (let i = 0; i < excludedAddresses.length; i++) {
      const addr = excludedAddresses[i];
      let label = "";
      
      if (addr.toLowerCase() === deployer.address.toLowerCase()) {
        label = " ← DEPLOYER";
      } else if (addr.toLowerCase() === AQUARI.toLowerCase()) {
        label = " ← CONTRACT ITSELF";
      } else if (addr.toLowerCase() === PAIR.toLowerCase()) {
        label = " ← ⚠️  PAIR ADDRESS (THIS IS THE KEY!)";
      } else if (addr === "0x0000000000000000000000000000000000000000") {
        label = " ← ZERO ADDRESS";
      }
      
      console.log(`  ${i + 1}. ${addr}${label}`);
    }
  } catch (error) {
    console.log("❌ Could not fetch excluded addresses:", error.message);
    excludedAddresses = [];
  }

  // Check specific addresses
  console.log("\n🔍 TAX EXCLUSION STATUS (isExcludedFromTax mapping)");
  console.log("═".repeat(70));
  
  const deployerTaxExcluded = await aquari.isExcludedFromTax(deployer.address);
  const traderTaxExcluded = await aquari.isExcludedFromTax(trader.address);
  const pairTaxExcluded = await aquari.isExcludedFromTax(PAIR);
  const contractTaxExcluded = await aquari.isExcludedFromTax(AQUARI);

  console.log("Deployer excluded from tax:", deployerTaxExcluded ? "✅ YES" : "❌ NO");
  console.log("Trader excluded from tax:", traderTaxExcluded ? "✅ YES" : "❌ NO");
  console.log("Pair excluded from tax:", pairTaxExcluded ? "✅ YES" : "❌ NO");
  console.log("Contract excluded from tax:", contractTaxExcluded ? "✅ YES" : "❌ NO");

  // THE CRITICAL CHECK
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  CRITICAL DIAGNOSIS                                            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const isPairInExcludedSet = excludedAddresses.some(
    addr => addr.toLowerCase() === PAIR.toLowerCase()
  );

  console.log("🔍 ANALYSIS");
  console.log("═".repeat(70));
  console.log("Is Pair in _excludedAddresses?", isPairInExcludedSet ? "✅ YES" : "❌ NO");
  console.log("Is Pair in isExcludedFromTax?", pairTaxExcluded ? "✅ YES" : "❌ NO");

  console.log("\n📊 WHAT THIS MEANS FOR TAX LOGIC");
  console.log("═".repeat(70));

  // Simulate BUY scenario
  console.log("\n1️⃣  BUY SCENARIO (Pair → Trader):");
  console.log("    from = Pair (" + PAIR + ")");
  console.log("    to = Trader (" + trader.address + ")");
  console.log("");
  console.log("    Conditions for tax:");
  console.log("    ✓ isUniswapTrade:", pairIsSet ? "true" : "false");
  console.log("    ✓ !_excludedAddresses.contains(from):", !isPairInExcludedSet ? "true" : "false");
  console.log("    ✓ !_excludedAddresses.contains(to):", "true (trader not in set)");
  console.log("    ✓ !isExcludedFromTax[from]:", !pairTaxExcluded ? "true" : "false");
  console.log("    ✓ !isExcludedFromTax[to]:", !traderTaxExcluded ? "true" : "false");
  console.log("");
  
  const buyTaxApplied = pairIsSet && !isPairInExcludedSet && !pairTaxExcluded && !traderTaxExcluded;
  console.log("    → Taxes applied on BUY:", buyTaxApplied ? "✅ YES" : "❌ NO");

  // Simulate SELL scenario
  console.log("\n2️⃣  SELL SCENARIO (Trader → Pair):");
  console.log("    from = Trader (" + trader.address + ")");
  console.log("    to = Pair (" + PAIR + ")");
  console.log("");
  console.log("    Conditions for tax:");
  console.log("    ✓ isUniswapTrade:", pairIsSet ? "true" : "false");
  console.log("    ✓ !_excludedAddresses.contains(from):", "true (trader not in set)");
  console.log("    ✓ !_excludedAddresses.contains(to):", !isPairInExcludedSet ? "true" : "false");
  console.log("    ✓ !isExcludedFromTax[from]:", !traderTaxExcluded ? "true" : "false");
  console.log("    ✓ !isExcludedFromTax[to]:", !pairTaxExcluded ? "true" : "false");
  console.log("");
  
  const sellTaxApplied = pairIsSet && !isPairInExcludedSet && !pairTaxExcluded && !traderTaxExcluded;
  console.log("    → Taxes applied on SELL:", sellTaxApplied ? "✅ YES" : "❌ NO");

  // CONCLUSION
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  CONCLUSION                                                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  if (isPairInExcludedSet) {
    console.log("🎯 FOUND THE ISSUE!");
    console.log("═".repeat(70));
    console.log("The PAIR is in the _excludedAddresses set.");
    console.log("This means:");
    console.log("  • Taxes are NOT applied when pair is sender (BUYs)");
    console.log("  • Taxes are NOT applied when pair is receiver (SELLs)");
    console.log("  • This is why SELLs work - no taxes are being taken!");
    console.log("");
    console.log("⚠️  YOUR CONTRACT IS NOT COLLECTING TAXES ON ANY TRADES!");
    console.log("");
    console.log("Solution: Remove the pair from _excludedAddresses");
  } else if (!buyTaxApplied && !sellTaxApplied) {
    console.log("⚠️  TAXES ARE NOT BEING APPLIED");
    console.log("═".repeat(70));
    console.log("Neither buys nor sells are being taxed.");
    console.log("Check the exclusion logic in the contract.");
  } else if (buyTaxApplied && !sellTaxApplied) {
    console.log("⚠️  ASYMMETRIC TAX APPLICATION");
    console.log("═".repeat(70));
    console.log("Taxes apply on buys but not sells.");
    console.log("This shouldn't happen with the current logic.");
  } else if (!buyTaxApplied && sellTaxApplied) {
    console.log("⚠️  ASYMMETRIC TAX APPLICATION");
    console.log("═".repeat(70));
    console.log("Taxes apply on sells but not buys.");
    console.log("This shouldn't happen with the current logic.");
  } else {
    console.log("❓ UNEXPECTED CONFIGURATION");
    console.log("═".repeat(70));
    console.log("Both buys and sells should be taxed according to logic,");
    console.log("but your test showed sells fail with 'UniswapV2: K'.");
    console.log("");
    console.log("This suggests there's a different issue in the _update logic");
    console.log("that only triggers when taxes are actually calculated.");
  }

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║              DIAGNOSTIC COMPLETE                               ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });