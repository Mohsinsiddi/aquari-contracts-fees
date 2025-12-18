const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║              ADDING LIQUIDITY TO UNISWAP V2                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Load deployment info
  const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'));
  const AQUARI = deploymentInfo.proxyAddress || deploymentInfo.contractAddress;
  const WETH = deploymentInfo.baseAddresses.weth;
  const ROUTER = deploymentInfo.baseAddresses.router;
  const FACTORY = deploymentInfo.baseAddresses.factory;

  const [deployer] = await ethers.getSigners();
  
  console.log("📋 CONFIGURATION");
  console.log("═".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log("AQUARI Token:", AQUARI);
  console.log("WETH:", WETH);
  console.log("Router:", ROUTER);
  console.log("Factory:", FACTORY);
  console.log("Deployer ETH Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Factory ABI
  const factoryABI = [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function createPair(address tokenA, address tokenB) external returns (address pair)"
  ];

  // Router ABI
  const routerABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)"
  ];

  // Token ABI
  const tokenABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
  ];

  const factory = await ethers.getContractAt(factoryABI, FACTORY);
  const router = await ethers.getContractAt(routerABI, ROUTER);
  const aquari = await ethers.getContractAt(tokenABI, AQUARI);

  // Step 1: Check/Create pair
  console.log("📝 Step 1: Checking Uniswap V2 pair...");
  let pairAddress = await factory.getPair(AQUARI, WETH);

  if (pairAddress === "0x0000000000000000000000000000000000000000") {
    console.log("❌ Pair does not exist. Creating pair...");
    
    const createTx = await factory.createPair(AQUARI, WETH);
    console.log("Transaction hash:", createTx.hash);
    await createTx.wait();
    
    pairAddress = await factory.getPair(AQUARI, WETH);
    console.log("✅ Pair created at:", pairAddress);
  } else {
    console.log("✅ Pair exists at:", pairAddress);
  }

  // Save pair address
  deploymentInfo.pairAddress = pairAddress;
  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));

  // Check token balance
  const aquariBalance = await aquari.balanceOf(deployer.address);
  console.log("\n📊 CURRENT BALANCES");
  console.log("═".repeat(70));
  console.log("AQUARI Balance:", ethers.formatEther(aquariBalance));

  // Define liquidity amounts
  const tokenAmount = ethers.parseEther("10000"); // 1M AQUARI
  const ethAmount = ethers.parseEther("0.01"); // 1 ETH

  console.log("\n💰 LIQUIDITY TO ADD");
  console.log("═".repeat(70));
  console.log("AQUARI:", ethers.formatEther(tokenAmount));
  console.log("ETH:", ethers.formatEther(ethAmount));

  if (aquariBalance < tokenAmount) {
    console.log("\n❌ Insufficient AQUARI balance!");
    console.log("Required:", ethers.formatEther(tokenAmount));
    console.log("Available:", ethers.formatEther(aquariBalance));
    return;
  }

  // Step 2: Approve router
  console.log("\n📝 Step 2: Approving router to spend AQUARI...");
  const currentAllowance = await aquari.allowance(deployer.address, ROUTER);
  console.log("Current allowance:", ethers.formatEther(currentAllowance));

  if (currentAllowance < tokenAmount) {
    const approveTx = await aquari.approve(ROUTER, tokenAmount);
    console.log("Approval transaction:", approveTx.hash);
    await approveTx.wait();
    console.log("✅ Approval confirmed");
  } else {
    console.log("✅ Already approved");
  }

  // Step 3: Add liquidity
  console.log("\n📝 Step 3: Adding liquidity to Uniswap V2...");
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

  try {
    const addLiquidityTx = await router.addLiquidityETH(
      AQUARI,
      tokenAmount,
      0, // min tokens - set to 0 for testing
      0, // min ETH - set to 0 for testing
      deployer.address,
      deadline,
      { value: ethAmount }
    );

    console.log("Transaction hash:", addLiquidityTx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await addLiquidityTx.wait();
    console.log("✅ Liquidity added successfully!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Step 4: Check pair info
    console.log("\n📊 PAIR INFORMATION");
    console.log("═".repeat(70));
    
    const pairABI = [
      "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
      "function token0() external view returns (address)",
      "function token1() external view returns (address)",
      "function balanceOf(address account) external view returns (uint256)",
      "function totalSupply() external view returns (uint256)"
    ];
    
    const pair = await ethers.getContractAt(pairABI, pairAddress);
    const [reserve0, reserve1] = await pair.getReserves();
    const token0 = await pair.token0();
    const token1 = await pair.token1();
    const lpBalance = await pair.balanceOf(deployer.address);
    const lpTotalSupply = await pair.totalSupply();

    console.log("Pair Address:", pairAddress);
    console.log("Token0:", token0);
    console.log("Token1:", token1);
    
    if (token0.toLowerCase() === AQUARI.toLowerCase()) {
      console.log("Reserve AQUARI:", ethers.formatEther(reserve0));
      console.log("Reserve WETH:", ethers.formatEther(reserve1));
      console.log("Price: 1 ETH =", ethers.formatEther(reserve0) / ethers.formatEther(reserve1), "AQUARI");
    } else {
      console.log("Reserve WETH:", ethers.formatEther(reserve0));
      console.log("Reserve AQUARI:", ethers.formatEther(reserve1));
      console.log("Price: 1 ETH =", ethers.formatEther(reserve1) / ethers.formatEther(reserve0), "AQUARI");
    }
    
    console.log("\n💎 LP TOKEN INFO");
    console.log("═".repeat(70));
    console.log("Your LP Balance:", ethers.formatEther(lpBalance));
    console.log("Total LP Supply:", ethers.formatEther(lpTotalSupply));
    console.log("Your Share:", ((Number(lpBalance) / Number(lpTotalSupply)) * 100).toFixed(2) + "%");

    // Update deployment info
    deploymentInfo.liquidityAdded = {
      timestamp: new Date().toISOString(),
      aquariAmount: ethers.formatEther(tokenAmount),
      ethAmount: ethers.formatEther(ethAmount),
      lpTokenBalance: ethers.formatEther(lpBalance),
      pairAddress: pairAddress,
      txHash: addLiquidityTx.hash
    };

    fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
    console.log("\n✅ Deployment info updated");

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║  LIQUIDITY ADDED SUCCESSFULLY!                                 ║");
    console.log("╚════════════════════════════════════════════════════════════════╝");

    console.log("\n📝 NOTE:");
    console.log("═".repeat(70));
    console.log("The pair exists on Uniswap but is NOT set in the AQUARI contract.");
    console.log("Trades will work, but taxes may not be applied correctly.");
    console.log("To set the pair in the contract, run:");
    console.log("npx hardhat run scripts/setPair.js --network localhost");

  } catch (error) {
    console.error("\n❌ Error adding liquidity:");
    console.error("Error:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error.message);
    process.exit(1);
  });