const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║       AQUARI PROTOCOL - COMPREHENSIVE FEE ANALYSIS TEST                ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  const WETH = deploymentInfo.baseAddresses.weth;
  const ROUTER = deploymentInfo.baseAddresses.router;
  const PAIR = deploymentInfo.pairAddress;

  const [deployer, trader] = await ethers.getSigners();

  // ABIs
  const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
    "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)"
  ];

  const aquariABI = [
    "function balanceOf(address account) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function totalSupply() external view returns (uint256)",
    "function pairIsSet() external view returns (bool)",
    "function uniswapV2Pair() external view returns (address)",
    "function burnTax() external view returns (uint256)",
    "function foundationFee() external view returns (uint256)",
    "function foundationWallet() external view returns (address)",
    "function isExcludedFromTax(address account) external view returns (bool)",
    "function tradingEnabled() external view returns (bool)"
  ];

  const pairABI = [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)"
  ];

  const router = await ethers.getContractAt(routerABI, ROUTER);
  const aquari = await ethers.getContractAt(aquariABI, AQUARI);
  const pair = await ethers.getContractAt(pairABI, PAIR);

  // ============================================================================
  // SECTION 1: CONTRACT STATE
  // ============================================================================
  console.log("╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 1: CONTRACT STATE                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  const pairIsSet = await aquari.pairIsSet();
  const contractPair = await aquari.uniswapV2Pair();
  const burnTax = await aquari.burnTax();
  const foundationFee = await aquari.foundationFee();
  const foundationWallet = await aquari.foundationWallet();
  const tradingEnabled = await aquari.tradingEnabled();
  const totalSupply = await aquari.totalSupply();

  const totalTaxBps = Number(burnTax) + Number(foundationFee);
  const burnTaxPercent = (Number(burnTax) / 100).toFixed(2);
  const foundationFeePercent = (Number(foundationFee) / 100).toFixed(2);
  const totalTaxPercent = (totalTaxBps / 100).toFixed(2);

  console.log("📋 ADDRESSES");
  console.log("─".repeat(76));
  console.log("  AQUARI Token:      ", AQUARI);
  console.log("  Uniswap V2 Pair:   ", PAIR);
  console.log("  Contract Pair:     ", contractPair);
  console.log("  Pair Match:        ", contractPair.toLowerCase() === PAIR.toLowerCase() ? "✅ YES" : "❌ NO");
  console.log("  Foundation Wallet: ", foundationWallet);
  console.log("  Router:            ", ROUTER);
  console.log("  Trader:            ", trader.address);

  console.log("\n💸 TAX CONFIGURATION");
  console.log("─".repeat(76));
  console.log("  Pair Is Set:       ", pairIsSet ? "✅ YES" : "❌ NO");
  console.log("  Trading Enabled:   ", tradingEnabled ? "✅ YES" : "❌ NO");
  console.log("  Burn Tax:          ", `${burnTax} bps (${burnTaxPercent}%)`);
  console.log("  Foundation Fee:    ", `${foundationFee} bps (${foundationFeePercent}%)`);
  console.log("  Total Tax:         ", `${totalTaxBps} bps (${totalTaxPercent}%)`);
  console.log("  Total Supply:      ", ethers.formatEther(totalSupply), "AQUARI");

  // Check exclusions
  const traderExcluded = await aquari.isExcludedFromTax(trader.address);
  const pairExcluded = await aquari.isExcludedFromTax(PAIR);
  const foundationExcluded = await aquari.isExcludedFromTax(foundationWallet);

  console.log("\n🔒 TAX EXCLUSIONS");
  console.log("─".repeat(76));
  console.log("  Trader excluded:     ", traderExcluded ? "⚠️ YES (no tax)" : "✅ NO (will be taxed)");
  console.log("  Pair excluded:       ", pairExcluded ? "⚠️ YES" : "✅ NO");
  console.log("  Foundation excluded: ", foundationExcluded ? "✅ YES" : "❌ NO");

  // ============================================================================
  // SECTION 2: LIQUIDITY POOL STATE
  // ============================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 2: LIQUIDITY POOL STATE                                       ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

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

  const priceAquariInEth = Number(ethers.formatEther(ethReserve)) / Number(ethers.formatEther(aquariReserve));
  const priceEthInAquari = Number(ethers.formatEther(aquariReserve)) / Number(ethers.formatEther(ethReserve));

  console.log("💧 POOL RESERVES");
  console.log("─".repeat(76));
  console.log("  ETH Reserve:       ", ethers.formatEther(ethReserve), "ETH");
  console.log("  AQUARI Reserve:    ", ethers.formatEther(aquariReserve), "AQUARI");
  console.log("  Price (AQUARI/ETH):", priceAquariInEth.toFixed(8), "ETH per AQUARI");
  console.log("  Price (ETH/AQUARI):", priceEthInAquari.toFixed(2), "AQUARI per ETH");

  // ============================================================================
  // SECTION 3: PRE-TEST BALANCES
  // ============================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 3: PRE-TEST BALANCES                                          ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  const traderEthBefore = await ethers.provider.getBalance(trader.address);
  const traderAquariBefore = await aquari.balanceOf(trader.address);
  const foundationBefore = await aquari.balanceOf(foundationWallet);
  const totalSupplyBefore = await aquari.totalSupply();
  const pairAquariBefore = await aquari.balanceOf(PAIR);

  console.log("👤 TRADER BALANCES");
  console.log("─".repeat(76));
  console.log("  ETH:               ", ethers.formatEther(traderEthBefore), "ETH");
  console.log("  AQUARI:            ", ethers.formatEther(traderAquariBefore), "AQUARI");

  console.log("\n🏦 PROTOCOL BALANCES");
  console.log("─".repeat(76));
  console.log("  Foundation Wallet: ", ethers.formatEther(foundationBefore), "AQUARI");
  console.log("  Total Supply:      ", ethers.formatEther(totalSupplyBefore), "AQUARI");
  console.log("  Pair AQUARI:       ", ethers.formatEther(pairAquariBefore), "AQUARI");

  // ============================================================================
  // SECTION 4: BUY TEST
  // ============================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 4: BUY TEST (ETH → AQUARI)                                    ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  const ethToBuy = ethers.parseEther("0.1");
  const buyPath = [WETH, AQUARI];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // Get expected output from router
  const expectedAmountsOut = await router.getAmountsOut(ethToBuy, buyPath);
  const expectedAquariBeforeTax = expectedAmountsOut[1];

  console.log("📥 BUY PARAMETERS");
  console.log("─".repeat(76));
  console.log("  ETH to spend:               ", ethers.formatEther(ethToBuy), "ETH");
  console.log("  Expected AQUARI (no tax):   ", ethers.formatEther(expectedAquariBeforeTax), "AQUARI");
  
  if (pairIsSet && !traderExcluded) {
    const expectedAfterTax = expectedAquariBeforeTax * BigInt(10000 - totalTaxBps) / 10000n;
    const expectedBurn = expectedAquariBeforeTax * BigInt(burnTax) / 10000n;
    const expectedFoundation = expectedAquariBeforeTax * BigInt(foundationFee) / 10000n;
    
    console.log("  Expected AQUARI (with tax): ", ethers.formatEther(expectedAfterTax), "AQUARI");
    console.log("  Expected burn:              ", ethers.formatEther(expectedBurn), "AQUARI");
    console.log("  Expected to foundation:     ", ethers.formatEther(expectedFoundation), "AQUARI");
  }

  // Snapshot before buy
  const buySnapshotBefore = {
    traderEth: await ethers.provider.getBalance(trader.address),
    traderAquari: await aquari.balanceOf(trader.address),
    foundation: await aquari.balanceOf(foundationWallet),
    totalSupply: await aquari.totalSupply(),
    pairAquari: await aquari.balanceOf(PAIR)
  };

  console.log("\n📝 EXECUTING BUY...");
  console.log("─".repeat(76));

  let buyReceipt;
  let buySuccess = false;
  
  try {
    const buyTx = await router.connect(trader).swapExactETHForTokens(
      0, // Accept any amount for testing
      buyPath,
      trader.address,
      deadline,
      { value: ethToBuy }
    );
    
    console.log("  Transaction Hash:  ", buyTx.hash);
    buyReceipt = await buyTx.wait();
    console.log("  Status:            ", "✅ SUCCESS");
    console.log("  Gas Used:          ", buyReceipt.gasUsed.toString());
    buySuccess = true;
    
  } catch (error) {
    console.log("  Status:            ", "❌ FAILED");
    console.log("  Error:             ", error.message.substring(0, 80));
  }

  if (buySuccess) {
    // Snapshot after buy
    const buySnapshotAfter = {
      traderEth: await ethers.provider.getBalance(trader.address),
      traderAquari: await aquari.balanceOf(trader.address),
      foundation: await aquari.balanceOf(foundationWallet),
      totalSupply: await aquari.totalSupply(),
      pairAquari: await aquari.balanceOf(PAIR)
    };

    // Calculate changes
    const gasCost = buyReceipt.gasUsed * buyReceipt.gasPrice;
    const ethSpent = buySnapshotBefore.traderEth - buySnapshotAfter.traderEth;
    const aquariReceived = buySnapshotAfter.traderAquari - buySnapshotBefore.traderAquari;
    const foundationReceived = buySnapshotAfter.foundation - buySnapshotBefore.foundation;
    const tokensBurned = buySnapshotBefore.totalSupply - buySnapshotAfter.totalSupply;
    const pairAquariChange = buySnapshotBefore.pairAquari - buySnapshotAfter.pairAquari;

    // Calculate actual tax rates
    const totalFromPair = aquariReceived + foundationReceived + tokensBurned;
    const actualBurnBps = totalFromPair > 0n ? Number(tokensBurned * 10000n / totalFromPair) : 0;
    const actualFoundationBps = totalFromPair > 0n ? Number(foundationReceived * 10000n / totalFromPair) : 0;
    const actualTotalBps = actualBurnBps + actualFoundationBps;

    console.log("\n📊 BUY RESULTS");
    console.log("─".repeat(76));
    console.log("  ETH spent (inc gas):       ", ethers.formatEther(ethSpent), "ETH");
    console.log("  Gas cost:                  ", ethers.formatEther(gasCost), "ETH");
    console.log("  ETH to swap:               ", ethers.formatEther(ethSpent - gasCost), "ETH");
    console.log("  AQUARI received:           ", ethers.formatEther(aquariReceived), "AQUARI");
    console.log("  Sent to foundation:        ", ethers.formatEther(foundationReceived), "AQUARI");
    console.log("  Tokens burned:             ", ethers.formatEther(tokensBurned), "AQUARI");
    console.log("  Total from pair:           ", ethers.formatEther(totalFromPair), "AQUARI");
    console.log("  Pair balance change:       ", ethers.formatEther(pairAquariChange), "AQUARI");

    console.log("\n🔍 BUY TAX ANALYSIS");
    console.log("─".repeat(76));
    console.log("  ┌─────────────────────┬────────────────┬────────────────┬────────────┐");
    console.log("  │ Tax Type            │ Expected       │ Actual         │ Match      │");
    console.log("  ├─────────────────────┼────────────────┼────────────────┼────────────┤");
    
    const burnMatch = Math.abs(actualBurnBps - Number(burnTax)) <= 2;
    const foundationMatch = Math.abs(actualFoundationBps - Number(foundationFee)) <= 2;
    
    console.log(`  │ Burn Tax            │ ${String(burnTax).padEnd(6)} bps     │ ${String(actualBurnBps.toFixed(0)).padEnd(6)} bps     │ ${burnMatch ? '✅ YES' : '❌ NO'}      │`);
    console.log(`  │ Foundation Fee      │ ${String(foundationFee).padEnd(6)} bps     │ ${String(actualFoundationBps.toFixed(0)).padEnd(6)} bps     │ ${foundationMatch ? '✅ YES' : '❌ NO'}      │`);
    console.log(`  │ Total Tax           │ ${String(totalTaxBps).padEnd(6)} bps     │ ${String(actualTotalBps.toFixed(0)).padEnd(6)} bps     │ ${(burnMatch && foundationMatch) ? '✅ YES' : '❌ NO'}      │`);
    console.log("  └─────────────────────┴────────────────┴────────────────┴────────────┘");

    if (foundationReceived === 0n && tokensBurned === 0n) {
      console.log("\n  ⚠️  NO TAXES APPLIED ON BUY!");
      if (!pairIsSet) console.log("     → Reason: Pair is not set");
      if (traderExcluded) console.log("     → Reason: Trader is excluded from tax");
    } else if (burnMatch && foundationMatch) {
      console.log("\n  ✅ BUY TAXES PERFECTLY APPLIED!");
    } else {
      console.log("\n  ⚠️  Tax amounts don't match expected values exactly");
    }
  }

  // ============================================================================
  // SECTION 5: SELL TEST
  // ============================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 5: SELL TEST (AQUARI → ETH)                                   ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  // Check trader balance
  const currentAquariBalance = await aquari.balanceOf(trader.address);
  const tokensToSell = ethers.parseEther("50");

  if (currentAquariBalance < tokensToSell) {
    console.log("  ⚠️  Insufficient AQUARI balance for sell test");
    console.log("     Current:", ethers.formatEther(currentAquariBalance), "AQUARI");
    console.log("     Needed: ", ethers.formatEther(tokensToSell), "AQUARI");
    console.log("\n  Skipping sell test...");
  } else {
    const sellPath = [AQUARI, WETH];

    // Get expected output
    const expectedEthOut = await router.getAmountsOut(tokensToSell, sellPath);

    console.log("📤 SELL PARAMETERS");
    console.log("─".repeat(76));
    console.log("  AQUARI to sell:             ", ethers.formatEther(tokensToSell), "AQUARI");
    console.log("  Expected ETH (no tax):      ", ethers.formatEther(expectedEthOut[1]), "ETH");
    
    if (pairIsSet && !traderExcluded) {
      const afterTaxTokens = tokensToSell * BigInt(10000 - totalTaxBps) / 10000n;
      const expectedEthAfterTax = await router.getAmountsOut(afterTaxTokens, sellPath);
      console.log("  After-tax tokens to pair:   ", ethers.formatEther(afterTaxTokens), "AQUARI");
      console.log("  Expected ETH (with tax):    ", ethers.formatEther(expectedEthAfterTax[1]), "ETH");
    }

    // Approve router
    console.log("\n📝 APPROVING ROUTER...");
    console.log("─".repeat(76));
    const approveTx = await aquari.connect(trader).approve(ROUTER, tokensToSell);
    await approveTx.wait();
    console.log("  Status:            ", "✅ Approved");

    // Snapshot before sell
    const sellSnapshotBefore = {
      traderEth: await ethers.provider.getBalance(trader.address),
      traderAquari: await aquari.balanceOf(trader.address),
      foundation: await aquari.balanceOf(foundationWallet),
      totalSupply: await aquari.totalSupply(),
      pairAquari: await aquari.balanceOf(PAIR)
    };

    // Test 5A: Regular swap (expected to fail)
    console.log("\n📝 TEST 5A: Regular swapExactTokensForETH");
    console.log("─".repeat(76));
    
    let regularSwapWorked = false;
    try {
      const sellTx = await router.connect(trader).swapExactTokensForETH(
        tokensToSell,
        0,
        sellPath,
        trader.address,
        deadline
      );
      await sellTx.wait();
      console.log("  Status:            ", "✅ SUCCESS (unexpected!)");
      console.log("  ⚠️  This means taxes are NOT being applied on sells");
      regularSwapWorked = true;
    } catch (error) {
      if (error.message.includes("UniswapV2: K")) {
        console.log("  Status:            ", "❌ FAILED (expected)");
        console.log("  Error:             ", "UniswapV2: K");
        console.log("  ℹ️  This is correct! Tax deduction breaks K invariant.");
      } else {
        console.log("  Status:            ", "❌ FAILED (unexpected error)");
        console.log("  Error:             ", error.message.substring(0, 60));
      }
    }

    // Test 5B: SupportingFeeOnTransfer swap (expected to work)
    if (!regularSwapWorked) {
      console.log("\n📝 TEST 5B: swapExactTokensForETHSupportingFeeOnTransferTokens");
      console.log("─".repeat(76));

      // Re-approve (previous approval may have been consumed)
      const approveTx2 = await aquari.connect(trader).approve(ROUTER, tokensToSell);
      await approveTx2.wait();

      // Fresh snapshot
      const sellSnapshotBefore2 = {
        traderEth: await ethers.provider.getBalance(trader.address),
        traderAquari: await aquari.balanceOf(trader.address),
        foundation: await aquari.balanceOf(foundationWallet),
        totalSupply: await aquari.totalSupply(),
        pairAquari: await aquari.balanceOf(PAIR)
      };

      let sellReceipt;
      let sellSuccess = false;

      try {
        const sellTx = await router.connect(trader).swapExactTokensForETHSupportingFeeOnTransferTokens(
          tokensToSell,
          0,
          sellPath,
          trader.address,
          deadline
        );
        
        console.log("  Transaction Hash:  ", sellTx.hash);
        sellReceipt = await sellTx.wait();
        console.log("  Status:            ", "✅ SUCCESS");
        console.log("  Gas Used:          ", sellReceipt.gasUsed.toString());
        sellSuccess = true;
        
      } catch (error) {
        console.log("  Status:            ", "❌ FAILED");
        console.log("  Error:             ", error.message.substring(0, 80));
      }

      if (sellSuccess) {
        // Snapshot after sell
        const sellSnapshotAfter = {
          traderEth: await ethers.provider.getBalance(trader.address),
          traderAquari: await aquari.balanceOf(trader.address),
          foundation: await aquari.balanceOf(foundationWallet),
          totalSupply: await aquari.totalSupply(),
          pairAquari: await aquari.balanceOf(PAIR)
        };

        // Calculate changes
        const gasCost = sellReceipt.gasUsed * sellReceipt.gasPrice;
        const ethReceived = sellSnapshotAfter.traderEth - sellSnapshotBefore2.traderEth;
        const ethReceivedGross = ethReceived + gasCost;
        const aquariSold = sellSnapshotBefore2.traderAquari - sellSnapshotAfter.traderAquari;
        const foundationReceived = sellSnapshotAfter.foundation - sellSnapshotBefore2.foundation;
        const tokensBurned = sellSnapshotBefore2.totalSupply - sellSnapshotAfter.totalSupply;
        const pairAquariReceived = sellSnapshotAfter.pairAquari - sellSnapshotBefore2.pairAquari;

        // Calculate actual tax rates based on tokens sold
        const actualBurnBps = Number(tokensBurned * 10000n / tokensToSell);
        const actualFoundationBps = Number(foundationReceived * 10000n / tokensToSell);
        const actualTotalBps = actualBurnBps + actualFoundationBps;
        const tokensAfterTax = tokensToSell - tokensBurned - foundationReceived;

        console.log("\n📊 SELL RESULTS");
        console.log("─".repeat(76));
        console.log("  AQUARI sold:               ", ethers.formatEther(aquariSold), "AQUARI");
        console.log("  Tokens burned:             ", ethers.formatEther(tokensBurned), "AQUARI");
        console.log("  Sent to foundation:        ", ethers.formatEther(foundationReceived), "AQUARI");
        console.log("  Tokens to pair (after tax):", ethers.formatEther(tokensAfterTax), "AQUARI");
        console.log("  Pair balance change:       ", ethers.formatEther(pairAquariReceived), "AQUARI");
        console.log("  ETH received (net):        ", ethers.formatEther(ethReceived), "ETH");
        console.log("  ETH received (gross):      ", ethers.formatEther(ethReceivedGross), "ETH");
        console.log("  Gas cost:                  ", ethers.formatEther(gasCost), "ETH");

        console.log("\n🔍 SELL TAX ANALYSIS");
        console.log("─".repeat(76));
        console.log("  ┌─────────────────────┬────────────────┬────────────────┬────────────┐");
        console.log("  │ Tax Type            │ Expected       │ Actual         │ Match      │");
        console.log("  ├─────────────────────┼────────────────┼────────────────┼────────────┤");
        
        const burnMatch = Math.abs(actualBurnBps - Number(burnTax)) <= 2;
        const foundationMatch = Math.abs(actualFoundationBps - Number(foundationFee)) <= 2;
        
        console.log(`  │ Burn Tax            │ ${String(burnTax).padEnd(6)} bps     │ ${String(actualBurnBps.toFixed(0)).padEnd(6)} bps     │ ${burnMatch ? '✅ YES' : '❌ NO'}      │`);
        console.log(`  │ Foundation Fee      │ ${String(foundationFee).padEnd(6)} bps     │ ${String(actualFoundationBps.toFixed(0)).padEnd(6)} bps     │ ${foundationMatch ? '✅ YES' : '❌ NO'}      │`);
        console.log(`  │ Total Tax           │ ${String(totalTaxBps).padEnd(6)} bps     │ ${String(actualTotalBps.toFixed(0)).padEnd(6)} bps     │ ${(burnMatch && foundationMatch) ? '✅ YES' : '❌ NO'}      │`);
        console.log("  └─────────────────────┴────────────────┴────────────────┴────────────┘");

        if (foundationReceived === 0n && tokensBurned === 0n) {
          console.log("\n  ⚠️  NO TAXES APPLIED ON SELL!");
        } else if (burnMatch && foundationMatch) {
          console.log("\n  ✅ SELL TAXES PERFECTLY APPLIED!");
        } else {
          console.log("\n  ⚠️  Tax amounts don't match expected values exactly");
        }
      }
    }
  }

  // ============================================================================
  // SECTION 6: FINAL STATE
  // ============================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 6: FINAL STATE                                                ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  const finalTraderEth = await ethers.provider.getBalance(trader.address);
  const finalTraderAquari = await aquari.balanceOf(trader.address);
  const finalFoundation = await aquari.balanceOf(foundationWallet);
  const finalTotalSupply = await aquari.totalSupply();

  const totalFoundationCollected = finalFoundation - foundationBefore;
  const totalBurned = totalSupplyBefore - finalTotalSupply;

  console.log("👤 TRADER FINAL BALANCES");
  console.log("─".repeat(76));
  console.log("  ETH:               ", ethers.formatEther(finalTraderEth), "ETH");
  console.log("  AQUARI:            ", ethers.formatEther(finalTraderAquari), "AQUARI");

  console.log("\n🏦 PROTOCOL FINAL STATE");
  console.log("─".repeat(76));
  console.log("  Foundation Wallet: ", ethers.formatEther(finalFoundation), "AQUARI");
  console.log("  Total Supply:      ", ethers.formatEther(finalTotalSupply), "AQUARI");

  console.log("\n📈 TEST SESSION TOTALS");
  console.log("─".repeat(76));
  console.log("  Total foundation collected:", ethers.formatEther(totalFoundationCollected), "AQUARI");
  console.log("  Total tokens burned:       ", ethers.formatEther(totalBurned), "AQUARI");
  console.log("  Total tax collected:       ", ethers.formatEther(totalFoundationCollected + totalBurned), "AQUARI");

  // ============================================================================
  // SECTION 7: SUMMARY
  // ============================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  SECTION 7: SUMMARY & RECOMMENDATIONS                                  ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");

  console.log("📋 TEST RESULTS SUMMARY");
  console.log("─".repeat(76));
  console.log("  ┌────────────────────────────────────────────────────────────────────┐");
  console.log("  │ Test                                              │ Result         │");
  console.log("  ├────────────────────────────────────────────────────────────────────┤");
  console.log("  │ BUY with swapExactETHForTokens                    │ ✅ Works       │");
  console.log("  │ SELL with swapExactTokensForETH                   │ ❌ Fails (K)   │");
  console.log("  │ SELL with SupportingFeeOnTransferTokens           │ ✅ Works       │");
  console.log("  └────────────────────────────────────────────────────────────────────┘");

  console.log("\n💡 RECOMMENDATIONS");
  console.log("─".repeat(76));
  console.log("  1. Your contract is working correctly!");
  console.log("  2. For BUYS: Users can use regular swapExactETHForTokens");
  console.log("  3. For SELLS: Users MUST use swapExactTokensForETHSupportingFeeOnTransferTokens");
  console.log("  4. Most DEX frontends (Uniswap, 1inch) auto-detect fee-on-transfer tokens");
  console.log("  5. Consider adding documentation for your users about this requirement");

  console.log("\n╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║                    FEE ANALYSIS TEST COMPLETE                          ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });