const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║              AQUARI CONTRACT STATE INSPECTOR                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Load deployment info
  let deploymentInfo;
  try {
    deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  } catch (error) {
    console.log("❌ ERROR: deployment-info.json not found");
    console.log("Please deploy the contract first.");
    process.exit(1);
  }

  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  const WETH = deploymentInfo.baseAddresses?.weth;
  const ROUTER = deploymentInfo.baseAddresses?.router;
  const FACTORY = deploymentInfo.baseAddresses?.factory;
  const SAVED_PAIR = deploymentInfo.pairAddress;

  const [deployer, trader] = await ethers.getSigners();

  console.log("📋 BASIC INFO");
  console.log("═".repeat(70));
  console.log("Contract Address:", AQUARI);
  console.log("Deployer Address:", deployer.address);
  console.log("Trader Address:", trader.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());

  // Complete Aquari ABI
  const aquariABI = [
    // ERC20 Standard
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    
    // Ownership
    "function owner() external view returns (address)",
    
    // Tax Configuration
    "function burnTax() external view returns (uint256)",
    "function foundationFee() external view returns (uint256)",
    "function foundationWallet() external view returns (address)",
    
    // Pair Configuration
    "function uniswapV2Pair() external view returns (address)",
    "function pairIsSet() external view returns (bool)",
    
    // Trading
    "function tradingEnabled() external view returns (bool)",
    
    // Tax Exclusions
    "function isExcludedFromTax(address account) external view returns (bool)",
    
    // AntiBot
    "function isBotRestricted(address account) external view returns (bool)",
    
    // Pausing
    "function paused() external view returns (bool)",
    
    // Allocations
    "function getAllocatedBalance(address account) external view returns (uint256)",
    "function isAddressAllocated(address account) external view returns (bool)",
    
    // View Functions
    "function getExcludedAddressCount() external view returns (uint256)"
  ];

  const aquari = await ethers.getContractAt(aquariABI, AQUARI);

  // ==========================================================================
  // TOKEN INFORMATION
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TOKEN INFORMATION                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const name = await aquari.name();
    const symbol = await aquari.symbol();
    const decimals = await aquari.decimals();
    const totalSupply = await aquari.totalSupply();

    console.log("🪙 TOKEN DETAILS");
    console.log("═".repeat(70));
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals.toString());
    console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
    console.log("Total Supply (raw):", totalSupply.toString());
  } catch (error) {
    console.log("❌ Error fetching token info:", error.message);
  }

  // ==========================================================================
  // OWNERSHIP
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  OWNERSHIP                                                     ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const owner = await aquari.owner();
    
    console.log("👑 OWNER INFORMATION");
    console.log("═".repeat(70));
    console.log("Contract Owner:", owner);
    console.log("Is Deployer Owner?", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅ YES" : "❌ NO");
  } catch (error) {
    console.log("❌ Error fetching owner:", error.message);
  }

  // ==========================================================================
  // TAX CONFIGURATION
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TAX CONFIGURATION                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const burnTax = await aquari.burnTax();
    const foundationFee = await aquari.foundationFee();
    const foundationWallet = await aquari.foundationWallet();
    const totalTax = Number(burnTax) + Number(foundationFee);

    console.log("💰 TAX RATES");
    console.log("═".repeat(70));
    console.log("Burn Tax:");
    console.log("  - Basis Points:", burnTax.toString(), "bps");
    console.log("  - Percentage:", (Number(burnTax) / 100).toFixed(2) + "%");
    console.log("  - Decimal:", (Number(burnTax) / 10000).toFixed(4));
    console.log("");
    console.log("Foundation Fee:");
    console.log("  - Basis Points:", foundationFee.toString(), "bps");
    console.log("  - Percentage:", (Number(foundationFee) / 100).toFixed(2) + "%");
    console.log("  - Decimal:", (Number(foundationFee) / 10000).toFixed(4));
    console.log("");
    console.log("Total Tax:");
    console.log("  - Basis Points:", totalTax.toString(), "bps");
    console.log("  - Percentage:", (totalTax / 100).toFixed(2) + "%");
    console.log("  - Decimal:", (totalTax / 10000).toFixed(4));
    console.log("");
    console.log("Foundation Wallet:", foundationWallet);

    // Check foundation wallet balance
    const foundationBalance = await aquari.balanceOf(foundationWallet);
    console.log("Foundation Balance:", ethers.formatEther(foundationBalance), "AQUARI");
  } catch (error) {
    console.log("❌ Error fetching tax configuration:", error.message);
  }

  // ==========================================================================
  // PAIR CONFIGURATION
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  UNISWAP V2 PAIR CONFIGURATION                                 ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const pairAddress = await aquari.uniswapV2Pair();
    const pairIsSet = await aquari.pairIsSet();

    console.log("🔗 PAIR STATUS");
    console.log("═".repeat(70));
    console.log("Pair Is Set:", pairIsSet ? "✅ YES" : "❌ NO");
    console.log("Pair Address:", pairAddress);
    
    if (SAVED_PAIR) {
      console.log("Saved Pair (deployment-info.json):", SAVED_PAIR);
      console.log("Match:", pairAddress.toLowerCase() === SAVED_PAIR.toLowerCase() ? "✅ YES" : "⚠️  NO");
    }

    // If pair is set, check liquidity
    if (pairIsSet && pairAddress !== "0x0000000000000000000000000000000000000000") {
      const pairABI = [
        "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function totalSupply() external view returns (uint256)"
      ];

      try {
        const pair = await ethers.getContractAt(pairABI, pairAddress);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0 = await pair.token0();
        const token1 = await pair.token1();
        const lpTotalSupply = await pair.totalSupply();

        console.log("\n💧 LIQUIDITY INFO");
        console.log("═".repeat(70));
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("LP Total Supply:", ethers.formatEther(lpTotalSupply));

        let ethReserve, aquariReserve;
        if (token0.toLowerCase() === AQUARI.toLowerCase()) {
          aquariReserve = reserve0;
          ethReserve = reserve1;
        } else {
          ethReserve = reserve0;
          aquariReserve = reserve1;
        }

        console.log("");
        console.log("Reserves:");
        console.log("  - AQUARI:", ethers.formatEther(aquariReserve), "AQUARI");
        console.log("  - ETH:", ethers.formatEther(ethReserve), "ETH");

        if (ethReserve > 0n) {
          const price = Number(ethers.formatEther(aquariReserve)) / Number(ethers.formatEther(ethReserve));
          console.log("");
          console.log("Price: 1 ETH =", price.toFixed(2), "AQUARI");
          console.log("Price: 1 AQUARI =", (1 / price).toFixed(8), "ETH");
        }
      } catch (error) {
        console.log("\n⚠️  Could not fetch pair liquidity info:", error.message);
      }
    } else {
      console.log("\n⚠️  NO PAIR SET - Taxes will not be applied on trades");
    }
  } catch (error) {
    console.log("❌ Error fetching pair configuration:", error.message);
  }

  // ==========================================================================
  // TRADING STATUS
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TRADING STATUS                                                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const tradingEnabled = await aquari.tradingEnabled();
    const isPaused = await aquari.paused();

    console.log("📊 STATUS");
    console.log("═".repeat(70));
    console.log("Trading Enabled:", tradingEnabled ? "✅ YES" : "❌ NO");
    console.log("Contract Paused:", isPaused ? "⚠️  YES" : "✅ NO");

    if (!tradingEnabled) {
      console.log("\n⚠️  Trading is disabled. Only excluded addresses can transfer.");
    }
    if (isPaused) {
      console.log("\n⚠️  Contract is paused. No transfers are allowed.");
    }
  } catch (error) {
    console.log("❌ Error fetching trading status:", error.message);
  }

  // ==========================================================================
  // EXCLUSIONS AND RESTRICTIONS
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  EXCLUSIONS AND RESTRICTIONS                                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const isDeployerExcludedFromTax = await aquari.isExcludedFromTax(deployer.address);
    const isTraderExcludedFromTax = await aquari.isExcludedFromTax(trader.address);
    const isDeployerBotRestricted = await aquari.isBotRestricted(deployer.address);
    const isTraderBotRestricted = await aquari.isBotRestricted(trader.address);

    console.log("🚫 TAX EXCLUSIONS");
    console.log("═".repeat(70));
    console.log("Deployer excluded from tax:", isDeployerExcludedFromTax ? "✅ YES" : "❌ NO");
    console.log("Trader excluded from tax:", isTraderExcludedFromTax ? "✅ YES" : "❌ NO");

    console.log("\n🤖 ANTIBOT RESTRICTIONS");
    console.log("═".repeat(70));
    console.log("Deployer bot-restricted:", isDeployerBotRestricted ? "⚠️  YES" : "✅ NO");
    console.log("Trader bot-restricted:", isTraderBotRestricted ? "⚠️  YES" : "✅ NO");

    const excludedCount = await aquari.getExcludedAddressCount();
    console.log("\n📋 EXCLUDED ADDRESSES");
    console.log("═".repeat(70));
    console.log("Total Excluded Addresses:", excludedCount.toString());
  } catch (error) {
    console.log("❌ Error fetching exclusions:", error.message);
  }

  // ==========================================================================
  // BALANCES
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TOKEN BALANCES                                                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const deployerBalance = await aquari.balanceOf(deployer.address);
    const traderBalance = await aquari.balanceOf(trader.address);
    const contractBalance = await aquari.balanceOf(AQUARI);
    const foundationWallet = await aquari.foundationWallet();
    const foundationBalance = await aquari.balanceOf(foundationWallet);

    console.log("💼 AQUARI BALANCES");
    console.log("═".repeat(70));
    console.log("Deployer:", ethers.formatEther(deployerBalance), "AQUARI");
    console.log("Trader:", ethers.formatEther(traderBalance), "AQUARI");
    console.log("Contract:", ethers.formatEther(contractBalance), "AQUARI");
    console.log("Foundation:", ethers.formatEther(foundationBalance), "AQUARI");

    console.log("\n💵 ETH BALANCES");
    console.log("═".repeat(70));
    const deployerETH = await ethers.provider.getBalance(deployer.address);
    const traderETH = await ethers.provider.getBalance(trader.address);
    const contractETH = await ethers.provider.getBalance(AQUARI);
    
    console.log("Deployer:", ethers.formatEther(deployerETH), "ETH");
    console.log("Trader:", ethers.formatEther(traderETH), "ETH");
    console.log("Contract:", ethers.formatEther(contractETH), "ETH");
  } catch (error) {
    console.log("❌ Error fetching balances:", error.message);
  }

  // ==========================================================================
  // ALLOCATIONS
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TOKEN ALLOCATIONS                                             ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const deployerAllocated = await aquari.getAllocatedBalance(deployer.address);
    const traderAllocated = await aquari.getAllocatedBalance(trader.address);
    const isDeployerAllocated = await aquari.isAddressAllocated(deployer.address);
    const isTraderAllocated = await aquari.isAddressAllocated(trader.address);

    console.log("📦 ALLOCATED TOKENS (Not yet minted)");
    console.log("═".repeat(70));
    console.log("Deployer:");
    console.log("  - Has Allocation:", isDeployerAllocated ? "✅ YES" : "❌ NO");
    console.log("  - Allocated Amount:", ethers.formatEther(deployerAllocated), "AQUARI");
    console.log("");
    console.log("Trader:");
    console.log("  - Has Allocation:", isTraderAllocated ? "✅ YES" : "❌ NO");
    console.log("  - Allocated Amount:", ethers.formatEther(traderAllocated), "AQUARI");
  } catch (error) {
    console.log("❌ Error fetching allocations:", error.message);
  }

  // ==========================================================================
  // UNISWAP ADDRESSES
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  UNISWAP V2 ADDRESSES                                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("🦄 UNISWAP INFRASTRUCTURE");
  console.log("═".repeat(70));
  console.log("WETH:", WETH || "Not configured");
  console.log("Router:", ROUTER || "Not configured");
  console.log("Factory:", FACTORY || "Not configured");

  // ==========================================================================
  // TAX CALCULATION EXAMPLES
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  TAX CALCULATION EXAMPLES                                      ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const burnTax = await aquari.burnTax();
    const foundationFee = await aquari.foundationFee();
    const pairIsSet = await aquari.pairIsSet();

    if (pairIsSet) {
      console.log("💡 EXAMPLE: Buying 1000 AQUARI");
      console.log("═".repeat(70));
      
      const amount = 1000;
      const burnAmount = (amount * Number(burnTax)) / 10000;
      const foundationAmount = (amount * Number(foundationFee)) / 10000;
      const receivedAmount = amount - burnAmount - foundationAmount;

      console.log("Amount before tax:", amount, "AQUARI");
      console.log("Burn tax:", burnAmount.toFixed(4), "AQUARI");
      console.log("Foundation fee:", foundationAmount.toFixed(4), "AQUARI");
      console.log("Amount received:", receivedAmount.toFixed(4), "AQUARI");
      console.log("Effective rate:", ((amount - receivedAmount) / amount * 100).toFixed(2) + "%");
    } else {
      console.log("⚠️  Pair not set - No taxes will be applied");
    }
  } catch (error) {
    console.log("❌ Error calculating examples:", error.message);
  }

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║  SUMMARY                                                       ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    const pairIsSet = await aquari.pairIsSet();
    const tradingEnabled = await aquari.tradingEnabled();
    const isPaused = await aquari.paused();
    const burnTax = await aquari.burnTax();
    const foundationFee = await aquari.foundationFee();

    console.log("📋 CONTRACT STATUS");
    console.log("═".repeat(70));
    console.log(pairIsSet ? "✅" : "❌", "Pair is set");
    console.log(tradingEnabled ? "✅" : "❌", "Trading is enabled");
    console.log(!isPaused ? "✅" : "❌", "Contract is not paused");
    console.log(Number(burnTax) > 0 || Number(foundationFee) > 0 ? "✅" : "⚠️ ", "Taxes are configured");

    if (pairIsSet && tradingEnabled && !isPaused) {
      console.log("\n✅ CONTRACT IS FULLY OPERATIONAL");
      console.log("   Taxes: " + ((Number(burnTax) + Number(foundationFee)) / 100).toFixed(2) + "% total");
    } else {
      console.log("\n⚠️  CONTRACT SETUP INCOMPLETE:");
      if (!pairIsSet) console.log("   - Run setPairWithFees.js to set pair and enable taxes");
      if (!tradingEnabled) console.log("   - Trading needs to be enabled");
      if (isPaused) console.log("   - Contract is paused");
    }
  } catch (error) {
    console.log("❌ Error generating summary:", error.message);
  }

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║              STATE INSPECTION COMPLETE                         ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });