# AQUARI Fee Enablement Guide

## Quick Start

```bash
# Run all unit tests (no fork needed)
npx hardhat test

# Run fork tests (requires docker)
docker-compose up -d
npx hardhat run scripts/fork-test/run-all.js --network fork -- --mainnet --new-token
```

---

## Test Coverage

| Test File | Tests | Description |
|-----------|-------|-------------|
| `test/fork-test-unit.test.js` | 41 | Config validation, report generation, fee math |
| `test/handlers.test.js` | 76 | All assertion handlers, state management |
| `test/e2e-contract.test.js` | 37 | Full contract E2E flow |
| **Total** | **154** | All passing |

### What's Tested
- Deployment & initialization
- Owner-only function access control
- `setUniswapV2Pair` irreversibility
- Tax configuration
- Transfers with/without fees
- Exclusion from tax
- Edge cases: 0%, 10%, 50% fees
- Burn-only and Foundation-only scenarios
- Gas usage tracking

---

## FORK TESTING (Safe - localhost)

### 1. Start Fork
```bash
docker-compose up -d
```

### 2. Choose Test Mode

| Command | Use Case |
|---------|----------|
| `--mainnet --new-token` | Deploy fresh token, YOU are owner, test full admin flow |
| `--mainnet` | Test real AQUARI (requires actual owner key) |
| `--simulate` | Edge case testing with AquariSim contracts |

**Recommended: Start with `--mainnet --new-token`**

```bash
npx hardhat run scripts/fork-test/run-all.js --network fork -- --mainnet --new-token
```

This tests the EXACT client flow:
1. Deploy token (same code as mainnet)
2. Add liquidity
3. Trade (no fees yet)
4. Set tax config (2.5%)
5. Enable fees (set pair)
6. Trade (verify fees work)
7. Change foundation wallet
8. Trade (verify fees go to new wallet)

---

## REAL MAINNET EXECUTION (Client runs this)

### Prerequisites
```bash
# .env file
ADMIN_KEY=<owner_private_key>
BASE_RPC=https://mainnet.base.org
```

### Execution Steps

**Step 1: Verify (READ ONLY)**
```bash
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base
```

**Step 2: Set Fees**
```bash
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base
```

**Step 3: Enable Fees (IRREVERSIBLE!)**
```bash
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base
```

**Step 4: Verify Success**
```bash
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base
```

---

## Configuration

**Fee Config** (`scripts/config.js`):
```javascript
taxConfig: {
    burnTax: 125,        // 1.25%
    foundationFee: 125,  // 1.25%
}
// Total: 2.5%
```

**Addresses** (`scripts/config.js`):
```javascript
MAINNET = {
    token: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
    implementation: "0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05",
    pair: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",
    foundationWallet: "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235",
}
```

**Network**: Base Mainnet (Chain ID: 8453)
**DEX**: Uniswap V2 (NOT V4)

---

## Project Structure

```
scripts/
├── config.js              # Main config (simulation & mainnet)
├── fork-test/             # Automated fork test suite
│   ├── config.js          # Fork test config
│   ├── run-all.js         # Main test runner
│   └── lib/               # Helpers (mode, state, report, assertions)
├── mainnet-execution/     # Production scripts (1-4)
├── simulation/            # Step-by-step manual scripts (0-6)
└── legacy/                # Old/deprecated scripts

contracts/
├── mainnet/
│   └── AquariProtocol.sol # Real mainnet contract (839 lines)
└── test/
    ├── AquariTest.sol     # Test contract (839 lines, same as mainnet)
    └── AquariMock.sol     # Simplified mock for unit tests

test/
├── fork-test-unit.test.js # Unit tests for fork test utilities
├── handlers.test.js       # Handler function tests
└── e2e-contract.test.js   # E2E contract flow tests
```

---

## Important Notes

- `setUniswapV2Pair()` is **IRREVERSIBLE** - cannot change pair after set
- Tax rates **CAN** be changed anytime with `setTaxConfig()`
- Foundation wallet **CAN** be changed anytime with `setFoundationWallet()`
- Owner is excluded from fees by default
- Use `SupportingFeeOnTransferTokens` swap methods for sells

---

## Gas Costs (from tests)

| Operation | Gas |
|-----------|-----|
| `setTaxConfig` | ~69,463 |
| `setUniswapV2Pair` | ~30,283 |
| Transfer with fees | ~97,146 |
