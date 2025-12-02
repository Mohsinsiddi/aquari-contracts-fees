require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    hardhat: {
      forking: {
        url: "https://base-mainnet.g.alchemy.com/v2/eQ_Axw8A_qkH4LzpV-gnOgilkiflVSam",
        enabled: true,
        blockNumber: 23000000 // Pin to specific block
      },
      chainId: 8453,
      chains: {
        8453: {
          hardforkHistory: {
            cancun: 1 // Base uses Cancun from block 1
          }
        }
      },
      accounts: {
        accountsBalance: "10000000000000000000000"
      }
    },
    baseMainnet: {
      url: "https://base-mainnet.g.alchemy.com/v2/eQ_Axw8A_qkH4LzpV-gnOgilkiflVSam",
      accounts: [process.env.ONCHAINKEY, process.env.ONCHAINKEY2],
      chainId: 8453,
      gas: 'auto',
      gasPrice: 'auto',
    },
    baseSepolia: {
      url: `https://sepolia.base.org`,
      accounts: [process.env.ONCHAINKEY],
      chainId: 84532,
      gas: 'auto',
      gasPrice: 'auto',
    },
    mainnet: {
      url: `https://bsc-dataseed.bnbchain.org/`,
      accounts: [process.env.ONCHAINKEY],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 8453,
      timeout: 60000
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: "CYUIGVTX1VKY3HVYCZYW2TVXXWGQU4VC1A",
      base: "CYUIGVTX1VKY3HVYCZYW2TVXXWGQU4VC1A"
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify.dev/server",
    browserUrl: "https://repo.sourcify.dev",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.21",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100
          },
          viaIR: false,
        },
      },
    ],
  },
};