# AQUARI Token - Smart Contracts

AQUARI is a fee-on-transfer token deployed on Base mainnet with UUPS upgradeable proxy pattern.

---

## Quick Links

| Resource | Link |
|----------|------|
| **Scripts Documentation** | [`scripts/README.md`](scripts/README.md) |
| **Token Contract** | [BaseScan](https://basescan.org/address/0x7f0e9971d3320521fc88f863e173a4cddbb051ba) |
| **LP Pair** | [BaseScan](https://basescan.org/address/0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F) |

---

## Safety Warnings

```
╔════════════════════════════════════════════════════════════════════════════╗
║                         IMPORTANT SAFETY NOTICES                           ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   • NEVER share your admin private keys with anyone                        ║
║   • NEVER commit private keys to git or any repository                     ║
║   • ALWAYS test on fork before running on mainnet                          ║
║   • setUniswapV2Pair() is IRREVERSIBLE - cannot be changed after!          ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## Contract Addresses

### AQUARI Token (Mainnet)

| Contract | Address |
|----------|---------|
| Token (Proxy) | `0x7f0e9971d3320521fc88f863e173a4cddbb051ba` |
| Implementation | `0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05` |
| LP Pair | `0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F` |
| Foundation Wallet | `0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235` |
| Owner | `0x187ED96248Bbbbf4D5b059187e030B7511b67801` |

### Test Token (AQTEST)

| Contract | Address |
|----------|---------|
| Token (Proxy) | `0xDA1f4C0368E95211bd7884CeAB11d3517A783faE` |
| LP Pair | `0x7DB573840a722a07187F9FdAAecbbf8E1cfAa7A0` |

### Base Network Infrastructure

| Contract | Address |
|----------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V2 Factory | `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6` |
| Uniswap V2 Router | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |
| V4 Universal Router | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## Fee Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `burnTax` | 125 bps | 1.25% burned on each trade |
| `foundationFee` | 125 bps | 1.25% to foundation wallet |
| **Total** | **250 bps** | **2.5% total fee** |

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
ADMIN_KEY=your_private_key_here
BASE_RPC=https://mainnet.base.org
BASESCAN_API_KEY=your_api_key
```

### 3. Start Fork Node (for testing)

```bash
docker compose up -d
```

### 4. Run Scripts

See [`scripts/README.md`](scripts/README.md) for complete documentation.

**Quick Start - Fork Testing:**
```bash
docker restart aquari-fork && sleep 3
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network fork
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network fork
npx hardhat run scripts/mainnet-execution/2b_test_trading_before.js --network fork
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network fork
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network fork
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network fork
```

---

## Project Structure

```
aquari-contracts/
├── contracts/               # Solidity smart contracts
│   ├── Aquari.sol          # Main AQUARI token
│   └── AquariTest.sol      # Test token variant
│
├── scripts/                 # Deployment & testing scripts
│   ├── README.md           # ⭐ COMPREHENSIVE DOCUMENTATION
│   ├── mainnet-execution/  # Production scripts for AQUARI
│   ├── test-token/         # Test token deployment
│   ├── fork-test/          # Automated test suite (28+ tests)
│   ├── simulation/         # Simulation scenarios
│   └── utils/              # Shared utilities
│
├── test/                    # Hardhat tests
├── deployments/             # Deployment artifacts
└── docker-compose.yml       # Anvil fork configuration
```

---

## Available Scripts

### Fork Testing (No private key needed)

| Script | Purpose |
|--------|---------|
| `mainnet-execution/1_verify_before.js` | Pre-flight verification |
| `mainnet-execution/2_set_fees.js` | Set tax configuration |
| `mainnet-execution/2b_test_trading_before.js` | Test trades (0% fee) |
| `mainnet-execution/3_enable_fees.js` | Enable fees (IRREVERSIBLE) |
| `mainnet-execution/4_verify_after.js` | Verify fees enabled |
| `mainnet-execution/5_test_trading_after.js` | Test trades (2.5% fee) |

### Test Token (Base Mainnet)

| Script | Purpose |
|--------|---------|
| `test-token/1_deploy.js` | Deploy AQTEST token |
| `test-token/2_add_liquidity.js` | Create LP pair |
| `test-token/3_verify_state.js` | Verify deployment |
| `test-token/4_configure.js` | Enable fees |

### Automated Test Suite

```bash
npx hardhat run scripts/fork-test/run-all.js --network fork
npx hardhat run scripts/fork-test/test-real-aquari.js --network fork
```

---

## Documentation

For complete documentation including:
- Step-by-step fork testing with expected outputs
- Test token deployment workflow
- Mainnet execution guide
- All 28+ test cases
- Troubleshooting

**See: [`scripts/README.md`](scripts/README.md)**

---

## Support

For issues or questions, contact the development team.
