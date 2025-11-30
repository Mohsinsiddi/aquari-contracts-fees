const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TEST: swapExactTokensForETHSupportingFeeOnTransferTokens      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  const WETH = deploymentInfo.baseAddresses.weth;
  const ROUTER = deploymentInfo.baseAddresses.router;
  const PAIR = deploymentInfo.pairAddress;

  const [deployer, trader] = await ethers.getSigners();
  
  console.log("📋 CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Trader:", trader.address);
  console.log("AQUARI:", AQUARI);
  console.log("Router:", ROUTER);
  console.log("Pair:", PAIR);

  // Router ABI - including the SupportingFeeOnTransferTokens function
  const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)"
  ];

  const aquariABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function pairIsSet() external view returns (bool)",
    "function burnTax() external view returns (uint256)",
    "function foundationFee() external view returns (uint256)",
    "function foundationWallet() external view returns (address)"
  ];

  const router = await ethers.getContractAt(routerABI, ROUTER);
  const aquari = await ethers.getContractAt(aquariABI, AQUARI);

  // Get current state
  const pairIsSet = await aquari.pairIsSet();
  const burnTax = await aquari.burnTax();
  const foundationFee = await aquari.foundationFee();
  const foundationWallet = await aquari.foundationWallet();
  const totalTax = Number(burnTax) + Number(foundationFee);

  console.log("\n💸 TAX CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Pair Is Set:", pairIsSet ? "✅ YES" : "❌ NO");
  console.log("Burn Tax:", (Number(burnTax) / 100).toFixed(2) + "%");
  console.log("Foundation Fee:", (Number(foundationFee) / 100).toFixed(2) + "%");
  console.log("Total Tax:", (totalTax / 100).toFixed(2) + "%");

  // Check trader balance
  let traderBalance = await aquari.balanceOf(trader.address);
  console.log("\n📊 TRADER BALANCE");
  console.log("═".repeat(70));
  console.log("AQUARI:", ethers.formatEther(traderBalance));

  // If trader has no tokens, buy some first
  if (traderBalance < ethers.parseEther("100")) {
    console.log("\n📝 Trader needs tokens. Buying some first...");
    
    const buyPath = [WETH, AQUARI];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    
    const buyTx = await router.connect(trader).swapExactETHForTokens(
      0,
      buyPath,
      trader.address,
      deadline,
      { value: ethers.parseEther("0.2") }
    );
    await buyTx.wait();
    
    traderBalance = await aquari.balanceOf(trader.address);
    console.log("✅ Buy completed. New balance:", ethers.formatEther(traderBalance), "AQUARI");
  }

  // ==========================================================================
  // TEST 1: Regular swapExactTokensForETH (expected to FAIL)
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TEST 1: Regular swapExactTokensForETH (EXPECTED TO FAIL)      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const tokensToSell = ethers.parseEther("10");
  const sellPath = [AQUARI, WETH];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // Approve
  console.log("📝 Approving router for", ethers.formatEther(tokensToSell), "tokens...");
  const approveTx1 = await aquari.connect(trader).approve(ROUTER, tokensToSell);
  await approveTx1.wait();
  console.log("✅ Approved");

  // Snapshot before
  const ethBefore1 = await ethers.provider.getBalance(trader.address);
  const aquariBefore1 = await aquari.balanceOf(trader.address);
  const foundationBefore1 = await aquari.balanceOf(foundationWallet);
  const supplyBefore1 = await aquari.totalSupply();

  console.log("\n📝 Attempting regular swapExactTokensForETH...");
  try {
    const sellTx1 = await router.connect(trader).swapExactTokensForETH(
      tokensToSell,
      0,
      sellPath,
      trader.address,
      deadline
    );
    await sellTx1.wait();
    console.log("✅ UNEXPECTED SUCCESS! Regular swap worked.");
    
    // This means taxes aren't being applied (pair not set or excluded)
    console.log("⚠️  This suggests taxes are NOT being applied on this transfer.");
    
  } catch (error) {
    if (error.message.includes("UniswapV2: K")) {
      console.log("❌ FAILED AS EXPECTED: UniswapV2: K");
      console.log("   This confirms taxes ARE being deducted, breaking Uniswap's K invariant.");
    } else {
      console.log("❌ FAILED with different error:", error.message);
    }
  }

  // ==========================================================================
  // TEST 2: swapExactTokensForETHSupportingFeeOnTransferTokens (expected to WORK)
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TEST 2: SupportingFeeOnTransferTokens (EXPECTED TO WORK)      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Need to approve again (previous approval might have been used or we need more)
  const tokensToSell2 = ethers.parseEther("10");
  console.log("📝 Approving router for", ethers.formatEther(tokensToSell2), "tokens...");
  const approveTx2 = await aquari.connect(trader).approve(ROUTER, tokensToSell2);
  await approveTx2.wait();
  console.log("✅ Approved");

  // Snapshot before
  const ethBefore2 = await ethers.provider.getBalance(trader.address);
  const aquariBefore2 = await aquari.balanceOf(trader.address);
  const foundationBefore2 = await aquari.balanceOf(foundationWallet);
  const supplyBefore2 = await aquari.totalSupply();

  console.log("\n📝 Attempting swapExactTokensForETHSupportingFeeOnTransferTokens...");
  try {
    const sellTx2 = await router.connect(trader).swapExactTokensForETHSupportingFeeOnTransferTokens(
      tokensToSell2,
      0, // Accept any amount (for testing)
      sellPath,
      trader.address,
      deadline
    );
    
    console.log("Transaction hash:", sellTx2.hash);
    const receipt = await sellTx2.wait();
    console.log("✅ SUCCESS! Transaction confirmed.");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Calculate results
    const ethAfter2 = await ethers.provider.getBalance(trader.address);
    const aquariAfter2 = await aquari.balanceOf(trader.address);
    const foundationAfter2 = await aquari.balanceOf(foundationWallet);
    const supplyAfter2 = await aquari.totalSupply();

    const ethReceived = ethAfter2 - ethBefore2 + (receipt.gasUsed * receipt.gasPrice);
    const aquariSold = aquariBefore2 - aquariAfter2;
    const foundationReceived = foundationAfter2 - foundationBefore2;
    const tokensBurned = supplyBefore2 - supplyAfter2;

    console.log("\n📊 SELL RESULTS");
    console.log("═".repeat(70));
    console.log("AQUARI sold:", ethers.formatEther(aquariSold));
    console.log("ETH received (gross):", ethers.formatEther(ethReceived));
    console.log("Foundation received:", ethers.formatEther(foundationReceived), "AQUARI");
    console.log("Tokens burned:", ethers.formatEther(tokensBurned), "AQUARI");

    // Verify taxes
    if (foundationReceived > 0n || tokensBurned > 0n) {
      console.log("\n✅ TAXES WERE CORRECTLY APPLIED!");
      
      const actualFoundationBps = (Number(foundationReceived) * 10000 / Number(tokensToSell2)).toFixed(0);
      const actualBurnBps = (Number(tokensBurned) * 10000 / Number(tokensToSell2)).toFixed(0);

      console.log("\n🔍 TAX VERIFICATION");
      console.log("═".repeat(70));
      console.log("Expected Foundation:", foundationFee.toString(), "bps (" + (Number(foundationFee)/100).toFixed(2) + "%)");
      console.log("Actual Foundation:  ", actualFoundationBps, "bps (" + (Number(actualFoundationBps)/100).toFixed(2) + "%)");
      console.log("Expected Burn:      ", burnTax.toString(), "bps (" + (Number(burnTax)/100).toFixed(2) + "%)");
      console.log("Actual Burn:        ", actualBurnBps, "bps (" + (Number(actualBurnBps)/100).toFixed(2) + "%)");
      
      const foundationMatch = Math.abs(Number(actualFoundationBps) - Number(foundationFee)) < 5;
      const burnMatch = Math.abs(Number(actualBurnBps) - Number(burnTax)) < 5;
      
      if (foundationMatch && burnMatch) {
        console.log("\n🎉 PERFECT! Taxes match expected values!");
      } else {
        console.log("\n⚠️  Tax amounts don't match expected (minor variance may be OK)");
      }
    } else {
      console.log("\n⚠️  No taxes detected. Check if pair is set and taxes are configured.");
    }

  } catch (error) {
    console.log("\n❌ FAILED:", error.message);
    
    if (error.message.includes("UniswapV2: K")) {
      console.log("\n💡 Still getting K error. This means the issue is different than expected.");
      console.log("   The _update function might have a bug in how it handles the transfer.");
    } else if (error.message.includes("TRANSFER_FAILED")) {
      console.log("\n💡 Transfer failed. Check _update function for issues.");
    }
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  SUMMARY                                                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("If TEST 1 failed with 'UniswapV2: K' and TEST 2 succeeded:");
  console.log("  → Your contract is FINE! Just use SupportingFeeOnTransferTokens for sells.");
  console.log("  → Most DEX frontends (Uniswap, 1inch, etc.) automatically detect this.");
  console.log("");
  console.log("If BOTH tests failed:");
  console.log("  → There's a bug in the _update function that needs fixing.");
  console.log("  → The contract needs to be upgraded.");
  console.log("");
  console.log("If BOTH tests succeeded:");
  console.log("  → Taxes might not be applying (check pairIsSet and exclusions).");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });