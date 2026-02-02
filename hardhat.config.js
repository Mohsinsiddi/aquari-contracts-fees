require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: { enabled: true, runs: 100 },
    },
  },

  networks: {
    // Local Hardhat node (for unit tests)
    hardhat: {
      chainId: 8453,
    },

    // Connect to Docker fork node (Anvil)
    // Anvil generates 10 deterministic accounts with 10000 ETH each
    fork: {
      url: "http://localhost:8545",
      chainId: 8453,
      // Use "remote" to allow impersonation of any account
      // Anvil's default accounts are still available via getSigners()
      accounts: "remote",
    },

    // Base Mainnet (production)
    base: {
      url: process.env.BASE_RPC || "https://base-mainnet.public.blastapi.io",
      chainId: 8453,
      accounts: process.env.ADMIN_KEY ? [process.env.ADMIN_KEY] : [],
    },
  },

  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
    },
  },
};
