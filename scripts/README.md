# AQUARI Scripts

## Disclaimer

```
⚠️  IMPORTANT - READ BEFORE RUNNING ANY SCRIPT ⚠️
═══════════════════════════════════════════════════

1. You must be the CONTRACT OWNER or have ADMIN ACCESS
2. Verify your private key is correctly set in .env file
3. setUniswapV2Pair() is IRREVERSIBLE - cannot be undone!
4. If you set the WRONG pair address, fees will NEVER work

If you are NOT the owner, transactions will FAIL.
```

---

## Commands Overview

### Available Networks

| Network Flag | Description | Use For |
|-------------|-------------|---------|
| `--network fork` | Anvil fork of Base mainnet | Testing (RECOMMENDED) |
| `--network base` | Real Base mainnet | Production (CAREFUL!) |

---

## All Commands & Test Status

### Simulation Scripts (--network fork)

| Command | Description | Tested | Result |
|---------|-------------|--------|--------|
| `npx hardhat run scripts/simulation/0_deploy.js --network fork` | Deploy test token | ✅ | PASS |
| `npx hardhat run scripts/simulation/1_add_liquidity.js --network fork` | Create pair + add LP | ✅ | PASS |
| `npx hardhat run scripts/simulation/2_set_tax_config.js --network fork` | Set burn + foundation fees | ✅ | PASS |
| `npx hardhat run scripts/simulation/2b_test_before_fees.js --network fork` | Test BUY/SELL before fees (V4) | ✅ | PASS (0%) |
| `npx hardhat run scripts/simulation/3_set_pair.js --network fork` | Enable fees (IRREVERSIBLE!) | ✅ | PASS |
| `npx hardhat run scripts/simulation/4_test_buy.js --network fork` | Test BUY via V4 Router | ✅ | PASS (2.49%) |
| `npx hardhat run scripts/simulation/5_test_sell.js --network fork` | Test SELL via V4 + Permit2 | ✅ | PASS (2.50%) |
| `npx hardhat run scripts/simulation/6_verify_state.js --network fork` | Verify final state | ✅ | PASS |
| `npx hardhat run scripts/simulation/status.js --network fork` | Show all simulation status | ✅ | PASS |
| `npx hardhat run scripts/simulation/run_all_simulations.js --network fork` | Run all 5 simulations | ✅ | 5/5 PASS |

### Fork Test Suite - Modes (--network fork)

| Mode | Command | Owner Key | Tested | Result |
|------|---------|-----------|--------|--------|
| Default | `npx hardhat run scripts/fork-test/run-all.js --network fork` | ❌ Not needed | ✅ | 28/28 PASS |
| `NEW_TOKEN=true` | `NEW_TOKEN=true npx hardhat run ... --network fork` | ❌ Not needed | ✅ | 28/28 PASS |
| `TEST_MODE=simulate` | `TEST_MODE=simulate npx hardhat run ... --network fork` | ❌ Not needed | ✅ | 28/28 PASS |
| `TEST_MODE=mainnet` | `TEST_MODE=mainnet npx hardhat run ... --network fork` | ✅ Required | ❌ | Needs owner key |
| **Impersonate Owner** | `npx hardhat run scripts/fork-test/test-real-aquari.js --network fork` | ❌ Not needed | ✅ | **Tests REAL contract!** |

**Mode Details:**

| Mode | What It Does | You Are Owner? | Tests All Edge Cases? |
|------|--------------|----------------|----------------------|
| **Default** | Deploys fresh `AquariProtocol` (same code as mainnet) | ✅ YES | ✅ YES |
| **`NEW_TOKEN=true`** | Same as default, explicit flag | ✅ YES | ✅ YES |
| **`TEST_MODE=simulate`** | Deploys fresh contract for isolated testing | ✅ YES | ✅ YES |
| **`TEST_MODE=mainnet`** | Tests REAL AQUARI (`0x7f0e9971...`) | ❌ NO | ❌ Limited |

**Important:** Default/NEW_TOKEN/simulate modes deploy a **fresh contract** where **YOU become the owner**. No external private key needed - tests the full admin flow including:
- `setTaxConfig()` - set fees
- `setUniswapV2Pair()` - enable fees (one-time)
- `setFoundationWallet()` - change wallet
- All edge cases (0%, 10%, 50% fees)

**Note:** Use environment variables since hardhat doesn't support `--` arg passing.

### Mainnet Scripts (--network base)

| Command | Description | Tested | Result |
|---------|-------------|--------|--------|
| `npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base` | Pre-flight checks (READ ONLY) | ✅ | PASS |
| `npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base` | Set tax configuration | ⚠️ | Ready |
| `npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base` | Enable fees (IRREVERSIBLE!) | ⚠️ | Ready |
| `npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base` | Post-enable verification | ⚠️ | Ready |

**Legend:** ✅ Fully Tested | ⚠️ Not Yet Executed (ready for production)

---

## Quick Start (3 Steps)

### 1. Setup Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env file - add your key for mainnet operations (optional for fork tests)
# ADMIN_KEY=your_private_key_here
```

### 2. Start Docker Fork

```bash
# Start Anvil fork of Base mainnet (uses docker-compose.yml)
docker compose up -d

# Verify it's running (should show "healthy")
docker ps | grep aquari-fork

# Restart fork for fresh state (between test runs)
docker restart aquari-fork
```

### 3. Run Tests

```bash
# Quick test (28/28 tests, deploys fresh token)
npx hardhat run scripts/fork-test/run-all.js --network fork

# Test REAL mainnet AQUARI (impersonates owner - RECOMMENDED!)
npx hardhat run scripts/fork-test/test-real-aquari.js --network fork

# Or with explicit mode
NEW_TOKEN=true npx hardhat run scripts/fork-test/run-all.js --network fork
TEST_MODE=simulate npx hardhat run scripts/fork-test/run-all.js --network fork
```

---

## All Commands

### Start/Stop Docker Fork

```bash
docker compose up -d        # Start fork
docker compose down         # Stop fork
docker restart aquari-fork  # Restart for fresh state
docker logs aquari-fork     # View logs
```

### 2. Run Individual Simulation Steps

```bash
# Edit config.js - set ACTIVE_SIMULATION = 1 (or 2,3,4,5)

npx hardhat run scripts/simulation/0_deploy.js --network fork
npx hardhat run scripts/simulation/1_add_liquidity.js --network fork
npx hardhat run scripts/simulation/2_set_tax_config.js --network fork
npx hardhat run scripts/simulation/2b_test_before_fees.js --network fork  # Verify 0% before enable
npx hardhat run scripts/simulation/3_set_pair.js --network fork           # ⚠️ IRREVERSIBLE
npx hardhat run scripts/simulation/4_test_buy.js --network fork           # V4 Universal Router
npx hardhat run scripts/simulation/5_test_sell.js --network fork          # V4 + Permit2
npx hardhat run scripts/simulation/6_verify_state.js --network fork
```

### 3. Run All 5 Simulations (Recommended)

```bash
npx hardhat run scripts/simulation/run_all_simulations.js --network fork
```

### 4. Run Fork Test Suite (4 Modes)

```bash
# Mode 1: Default (Recommended) - Deploy fresh token, YOU are owner
npx hardhat run scripts/fork-test/run-all.js --network fork

# Mode 2: NEW_TOKEN=true - Explicit new token deployment
TEST_MODE=mainnet NEW_TOKEN=true npx hardhat run scripts/fork-test/run-all.js --network fork

# Mode 3: TEST_MODE=simulate - Edge case testing (isolated)
TEST_MODE=simulate npx hardhat run scripts/fork-test/run-all.js --network fork

# Mode 4: TEST_MODE=mainnet - Test REAL AQUARI (Requires owner key!)
TEST_MODE=mainnet npx hardhat run scripts/fork-test/run-all.js --network fork
```

### 5. Mainnet Execution (Production)

```bash
# Edit config.js - set MODE = "mainnet"

npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base  # ⚠️ IRREVERSIBLE!
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base
```

---

## Complete Test Matrix

### All Test Modes Status

| Category | Mode/Command | Tested | Result | Notes |
|----------|--------------|--------|--------|-------|
| **Simulation** | `run_all_simulations.js --network fork` | ✅ | 5/5 PASS | All 5 scenarios |
| **Fork Test** | Default (fresh deploy, you=owner) | ✅ | 28/28 PASS | Full edge cases |
| **Fork Test** | `NEW_TOKEN=true` (fresh deploy, you=owner) | ✅ | 28/28 PASS | Full edge cases |
| **Fork Test** | `TEST_MODE=simulate` (fresh deploy, you=owner) | ✅ | 28/28 PASS | Full edge cases |
| **Fork Test** | `TEST_MODE=mainnet` (real AQUARI) | ❌ | Not tested | Requires real owner key |
| **Mainnet** | `1_verify_before.js --network base` | ✅ | PASS | READ ONLY |
| **Mainnet** | `2_set_fees.js --network base` | ❌ | Not tested | Requires owner key |
| **Mainnet** | `3_enable_fees.js --network base` | ❌ | Not tested | Requires owner key |
| **Mainnet** | `4_verify_after.js --network base` | ❌ | Not tested | After fees enabled |

### Edge Cases Tested (in Default/NEW_TOKEN/simulate modes)

| Edge Case | Expected | Actual | Result |
|-----------|----------|--------|--------|
| Zero Fees (0/0) | 0% | 0% | ✅ PASS |
| Production Fees (2.5%) | 2.5% | 2.49-2.50% | ✅ PASS |
| High Fees (10%) | 10% | 9.99% | ✅ PASS |
| Extreme Fees (50%) | 50% | 49.99% | ✅ PASS |
| Owner Exclusion | No fees | No fees | ✅ PASS |
| Non-owner Security | Revert | Revert | ✅ PASS |
| Second setUniswapV2Pair | Revert | Revert | ✅ PASS |
| Regular swap for sell | Revert (K) | Revert (K) | ✅ PASS |

**Legend:** ✅ Tested & Passed | ❌ Not Yet Tested

---

## Test Results Summary

### Simulation Test Results (All 5 Pass)

| Sim | Purpose | BUY Fee | SELL Fee | Precision Loss | Split |
|-----|---------|---------|----------|----------------|-------|
| #1 | Baseline - correct setup | 2.49% | 2.50% | 0.01% / 0.00% | 50/50 |
| #2 | Wrong pair address | 0.00% | 0.00% | 2.50% (expected) | N/A |
| #3 | Wrong order (pair before fees) | 2.49% | 2.50% | 0.01% / 0.00% | 50/50 |
| #4 | High fees (50%) | 49.99% | 50.00% | 0.01% / 0.00% | 50/50 |
| #5 | Final rehearsal | 2.49% | 2.50% | 0.01% / 0.00% | 50/50 |

### Comprehensive Fork Test Results (32 Tests)

```
Total Tests:    32
Passed:         28 ✓
Failed:         0 ✗
Info:           4 ℹ

████  ALL TESTS PASSED  ████
```

#### Tests Covered

| Category | Tests | Status |
|----------|-------|--------|
| Pre-Flight Checks | PF01-PF05 | ✅ All Pass |
| Owner & Access Control | T01-T03 | ✅ All Pass |
| Security Validations | S01-S03 | ✅ All Pass |
| Fee Configuration | T04-T05b | ✅ All Pass |
| Trading Tests | T06-T09 | ✅ All Pass |
| State Verification | T10-T11 | ✅ All Pass |
| Exclusion Tests | T13 | ✅ Pass |
| Edge Cases | E01-E04 | ✅ All Pass |
| Admin Functions | A01-A02 | ✅ All Pass |

#### Edge Cases Tested

| Edge Case | Expected | Actual | Result |
|-----------|----------|--------|--------|
| Zero Fees (0/0) | 0% | 0% | ✅ PASS |
| High Fees (10%) | 10% | 9.99% | ✅ PASS |
| Extreme Fees (50%) | 50% | 49.99% | ✅ PASS |
| Production (2.5%) | 2.5% | 2.49-2.50% | ✅ PASS |
| Owner Exclusion | No fees | No fees | ✅ PASS |
| Non-owner Security | Revert | Revert | ✅ PASS |

---

## Folder Structure

```
scripts/
├── config.js                    ← Configuration (MODE, addresses, simulations)
├── README.md                    ← This file
│
├── simulation/                  ← Step-by-step simulation scripts (V4 Router)
│   ├── 0_deploy.js              Deploy test token (AquariSim1-5)
│   ├── 1_add_liquidity.js       Create pair + add liquidity
│   ├── 2_set_tax_config.js      Set burn + foundation fees
│   ├── 2b_test_before_fees.js   Test buy/sell BEFORE fees (verify 0%)
│   ├── 3_set_pair.js            Enable fees (IRREVERSIBLE!)
│   ├── 4_test_buy.js            Test BUY via V4 Universal Router
│   ├── 5_test_sell.js           Test SELL via V4 + Permit2
│   ├── 6_verify_state.js        Verify final state
│   ├── status.js                Show all simulations status
│   └── run_all_simulations.js   Master script (runs all 5 sims)
│
├── utils/                       ← Utility modules
│   └── universalRouter.js       V4 Universal Router + Permit2 helpers
│
├── fork-test/                   ← Comprehensive automated testing
│   ├── run-all.js               Main test runner (32 tests)
│   ├── config.js                Fork test configuration
│   ├── reports/                 Generated test reports (JSON + TXT)
│   └── lib/                     Test utilities
│       ├── mode.js              Mode detection & context setup
│       ├── assertions.js        Test assertions
│       ├── report.js            Report generation
│       └── state.js             State management
│
├── mainnet-execution/           ← Production scripts (real AQUARI)
│   ├── 1_verify_before.js       Pre-flight checks (READ ONLY)
│   ├── 2_set_fees.js            Set tax configuration
│   ├── 3_enable_fees.js         Enable fees (⚠️ IRREVERSIBLE!)
│   └── 4_verify_after.js        Post-enable verification
│
└── legacy/                      ← Old scripts (reference only)
    └── *.js
```

---

## V4 Universal Router (Uniswap UI Swaps)

All swap tests use the **V4 Universal Router** - the same router used by Uniswap's web interface.

### Router Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| V4 Universal Router | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| V2 Router (legacy) | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |

### BUY Flow (ETH → Token)

```javascript
const { buyTokensWithETH, getUniversalRouter } = require("./utils/universalRouter");

const router = getUniversalRouter(signer);
await buyTokensWithETH(router, tokenAddress, wethAddress, recipient, ethAmount, 0n, deadline);
```

### SELL Flow (Token → ETH)

**Important:** V4 Universal Router uses Permit2 for token approvals:

```javascript
const { sellFeeTokensForETH, setupPermit2ForSell, getUniversalRouter } = require("./utils/universalRouter");

// Step 1: Setup Permit2 (one-time)
await setupPermit2ForSell(tokenContract, tokenAddress, signer);

// Step 2: Execute sell
const router = getUniversalRouter(signer);
await sellFeeTokensForETH(router, tokenAddress, wethAddress, recipient, tokenAmount, 0n, deadline);
```

### Fee Precision Results

| Operation | Expected | Actual | Precision Loss |
|-----------|----------|--------|----------------|
| BUY via V4 | 2.50% | 2.49% | 0.01% |
| SELL via V4 | 2.50% | 2.50% | 0.00% |

---

## Configuration (config.js)

### Switch Mode

```javascript
const MODE = "simulation";  // For testing
// or
const MODE = "mainnet";     // For real AQUARI
```

### Select Simulation

```javascript
const ACTIVE_SIMULATION = 1;  // Options: 1, 2, 3, 4, 5
```

### Tax Configuration

```javascript
// Target: 1.25% burn + 1.25% foundation = 2.5% total
const MAINNET = {
    taxConfig: {
        burnTax: 125,        // 1.25% (125 basis points)
        foundationFee: 125,  // 1.25% (125 basis points)
    },
};
```

---

## Gas Usage

| Operation | Gas Used |
|-----------|----------|
| setTaxConfig | ~59,264 |
| setUniswapV2Pair | ~52,398 |
| BUY swap (V4) | ~218,328 |
| SELL swap (V4) | ~171,961 |
| **Total for fee enablement** | ~111,662 |

---

## After Fee Enablement

### What Admin CAN Change (anytime)

```javascript
// Change tax rates
await token.setTaxConfig(200, 200);  // 2% + 2%

// Remove all fees
await token.setTaxConfig(0, 0);

// Change foundation wallet
await token.setFoundationWallet("0xNEW");

// Disable trading
await token.setTradingEnabled(false);

// Emergency pause
await token.pause();
```

### What Admin CANNOT Change

```javascript
// ❌ Cannot call again - pair is permanently set
await token.setUniswapV2Pair(address);  // Will REVERT with "PairAlreadySet"
```

---

## Reports Location

Test reports are saved to:

```
scripts/fork-test/reports/
├── report-mainnet-YYYY-MM-DDTHH-MM-SS.txt   (Human readable)
└── report-mainnet-YYYY-MM-DDTHH-MM-SS.json  (Machine readable)

simulation_report.txt                         (5 simulations summary)
```

---

## Troubleshooting

### "You are NOT the owner"
- Check your private key in .env matches the contract owner
- Verify on BaseScan who the owner is

### "PairAlreadySet"
- Fees are already enabled
- You cannot change the pair address

### "K" error on sell (V2 Router)
- This is EXPECTED for fee-on-transfer tokens with V2 Router
- Use `swapExactTokensForETHSupportingFeeOnTransferTokens` for V2
- Or use V4 Universal Router (recommended)

### Fees not applying
- Check `pairIsSet` is true
- Verify stored pair matches factory pair
- Check trader is not in `_excludedAddresses` or `isExcludedFromTax`

### Tests show 0% fees after enable
- Make sure buyer/seller is NOT the owner (owner is excluded)
- Use Account #1 or #2 for testing (not Account #0)

### V4 Sell failing
- Ensure Permit2 is approved: `await setupPermit2ForSell(token, tokenAddress, signer)`
- Check token balance is sufficient

---

## Safety Checklist

Before running mainnet scripts:

- [ ] Run ALL 5 simulations successfully (`run_all_simulations.js`)
- [ ] Run comprehensive fork test (`fork-test/run-all.js`)
- [ ] Verify all 32 tests pass
- [ ] Check fee precision is within tolerance (< 0.02%)
- [ ] Verify you are the owner
- [ ] Verify pair address matches factory
- [ ] Verify tax config is correct (125 + 125 = 250 bps = 2.5%)
- [ ] Understand that setUniswapV2Pair is IRREVERSIBLE
- [ ] Have someone double-check addresses
- [ ] Test with non-owner account to verify fees apply
