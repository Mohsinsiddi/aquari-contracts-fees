# AQUARI Fee Enablement Scripts

Complete documentation for enabling the fee-on-transfer mechanism on the AQUARI token on Base mainnet.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Configuration - What to Update for Mainnet](#configuration---what-to-update-for-mainnet)
4. [Local Fork Testing (Recommended First Step)](#local-fork-testing-recommended-first-step)
5. [Test Token Deployment (Optional - Real Mainnet Testing)](#test-token-deployment-optional---real-mainnet-testing)
6. [Mainnet Execution](#mainnet-execution)
7. [Available Test Suites](#available-test-suites)
8. [Contract Addresses](#contract-addresses)
9. [Fee Configuration Details](#fee-configuration-details)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What This Does

These scripts enable the fee-on-transfer mechanism on the AQUARI token:
- **2.5% total fee** on every trade (1.25% burned + 1.25% to foundation wallet)
- Fees apply to BUY and SELL trades on Uniswap
- Owner and excluded addresses are exempt from fees

### Critical Information

```
+==============================================================================+
|  IMPORTANT: setUniswapV2Pair() is IRREVERSIBLE                               |
|                                                                              |
|  - Once the pair is set, it CANNOT be changed                                |
|  - If wrong pair is set, fees will NEVER work correctly                      |
|  - ALWAYS test on fork first before mainnet execution                        |
+==============================================================================+
```

### Workflow Summary

```
                    LOCAL FORK TESTING
                    (No private key needed)
                           |
                           v
+-----------------------------------------------------------------+
|  1. docker restart aquari-fork                                   |
|  2. Run scripts/mainnet-execution/1_verify_before.js            |
|  3. Run scripts/mainnet-execution/2_set_fees.js                 |
|  4. Run scripts/mainnet-execution/2b_test_trading_before.js     |
|  5. Run scripts/mainnet-execution/3_enable_fees.js              |
|  6. Run scripts/mainnet-execution/4_verify_after.js             |
|  7. Run scripts/mainnet-execution/5_test_trading_after.js       |
+-----------------------------------------------------------------+
                           |
                           | All tests pass?
                           v
                    MAINNET EXECUTION
                    (Requires owner key)
```

---

## Prerequisites

### 1. Install Dependencies

```bash
cd aquari-contracts
npm install
```

### 2. Environment Setup

Create `.env` file in project root:

```bash
# Copy example (if exists) or create new
cp .env.example .env
```

**Required environment variables:**

```env
# For mainnet execution (owner's private key)
ADMIN_KEY=your_private_key_here

# RPC endpoint
BASE_RPC=https://mainnet.base.org

# For contract verification (optional)
BASESCAN_API_KEY=your_api_key
```

### 3. Docker Installation

Docker is required for local fork testing.

**Install Docker:**
- macOS: [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
- Linux: `sudo apt install docker.io docker-compose`

**Verify installation:**
```bash
docker --version
docker compose version
```

### 4. Start Fork Node

```bash
# Start the Anvil fork of Base mainnet
docker compose up -d

# Verify it's running
docker ps | grep aquari-fork

# Check logs
docker logs aquari-fork
```

**Docker Commands Reference:**

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start fork node in background |
| `docker compose down` | Stop fork node |
| `docker restart aquari-fork` | **Restart for fresh blockchain state** |
| `docker logs aquari-fork` | View node logs |
| `docker logs -f aquari-fork` | Follow logs in real-time |
| `docker ps` | Check running containers |

---

## Configuration - What to Update for Mainnet

### Files to Review Before Mainnet

#### 1. Main Configuration (`scripts/config.js`)

```javascript
// MAINNET CONFIGURATION - Verify these addresses are correct!
const MAINNET = {
    token: {
        address: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",  // AQUARI proxy
    },
    pair: {
        address: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",  // LP pair (AQUARI/WETH)
    },
    owner: "0x187ED96248Bbbbf4D5b059187e030B7511b67801",  // Contract owner
    foundationWallet: "0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235",  // Fee recipient
    taxConfig: {
        burnTax: 125,        // 1.25% (125 basis points)
        foundationFee: 125,  // 1.25% (125 basis points)
    },
};
```

#### 2. Fork Test Configuration (`scripts/fork-test/config.js`)

Same addresses used for fork testing - should match mainnet config.

#### 3. Test Token Configuration (`scripts/test-token/config.js`)

```javascript
const CONFIG = {
    liquidityETH: "0.01",           // ETH for LP
    liquidityTokens: "1000000",     // 1M tokens for LP
    newFoundationWallet: "0x802D8097eC1D49808F3c2c866020442891adde57",  // Test foundation
    taxConfig: {
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
};
```

### What You May Want to Change

| Parameter | Location | Current Value | Description |
|-----------|----------|---------------|-------------|
| `burnTax` | config.js | 125 (1.25%) | Percentage burned on each trade |
| `foundationFee` | config.js | 125 (1.25%) | Percentage sent to foundation |
| `foundationWallet` | config.js | 0x13B9... | Wallet receiving foundation fees |

### What You CANNOT Change After Deployment

| Parameter | Reason |
|-----------|--------|
| `uniswapV2Pair` | **IRREVERSIBLE** - set once via `setUniswapV2Pair()` |
| Token proxy address | Already deployed on mainnet |

---

## Local Fork Testing (Recommended First Step)

Fork testing allows you to test the **exact mainnet contracts** locally without spending real ETH. The fork simulates the real Base blockchain state.

### Step 1: Start Fresh Fork

```bash
# Always restart for clean state before testing
docker restart aquari-fork && sleep 3
```

### Step 2: Run Pre-Flight Verification

```bash
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network fork
```

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════════════╗
║ STEP 1: VERIFY BEFORE FEE ENABLEMENT                                 ║
╚══════════════════════════════════════════════════════════════════════╝

▶ Contract State
──────────────────────────────────────────────────
  pairIsSet:    FALSE (fees NOT active)
  Trading:      ENABLED
  Paused:       NO

▶ Pre-Flight Checklist
──────────────────────────────────────────────────
  ✓ You ARE the owner (impersonated on fork)
  ✓ pairIsSet is false - ready to enable
  ✓ Trading is enabled
  ✓ Contract is not paused
```

### Step 3: Set Tax Configuration

```bash
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network fork
```

**Expected Output:**
```
  ✓ Tax configuration set!
  Burn Tax:       125 bps (1.25%)
  Foundation Fee: 125 bps (1.25%)
  Total:          250 bps (2.5%)
```

### Step 4: Test Trading BEFORE Fees Enabled

```bash
npx hardhat run scripts/mainnet-execution/2b_test_trading_before.js --network fork
```

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════════════╗
║ TEST TRADING BEFORE FEES ENABLED                                     ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────┬────────────────┬───────────────┬────────────┐
│ Type    │ Amount In      │ Amount Out    │ Fee %      │
├─────────┼────────────────┼───────────────┼────────────┤
│ BUY     │ 0.001 ETH      │ 1,234 AQUARI  │ 0.00%      │
│ SELL    │ 500 AQUARI     │ 0.0004 ETH    │ 0.00%      │
└─────────┴────────────────┴───────────────┴────────────┘

  ✅ BUY fee is 0.00% (expected: 0% before fees enabled)
  ✅ SELL fee is 0.00% (expected: 0% before fees enabled)
```

### Step 5: Enable Fees (Set Pair)

```bash
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network fork
```

**Expected Output:**
```
  ⚠️ WARNING: This action is IRREVERSIBLE on mainnet!

  🔵 FORK MODE: Auto-proceeding (no confirmation needed)

  Setting Uniswap V2 pair...
  TX: 0x...
  ✓ Pair set! FEES ARE NOW ACTIVE!
```

### Step 6: Verify Fees Are Enabled

```bash
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network fork
```

**Expected Output:**
```
▶ Contract State (After)
──────────────────────────────────────────────────
  pairIsSet:      TRUE ✅ FEES ACTIVE
  Stored Pair:    0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F
  Burn Tax:       125 bps (1.25%)
  Foundation Fee: 125 bps (1.25%)
```

### Step 7: Test Trading AFTER Fees Enabled

```bash
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network fork
```

**Expected Output:**
```
╔══════════════════════════════════════════════════════════════════════╗
║ TEST TRADING AFTER FEES ENABLED                                      ║
╚══════════════════════════════════════════════════════════════════════╝

┌─────────┬────────────────┬───────────────┬────────────┐
│ Type    │ Amount In      │ Amount Out    │ Fee %      │
├─────────┼────────────────┼───────────────┼────────────┤
│ BUY     │ 0.001 ETH      │ 1,203 AQUARI  │ 2.50%      │
│ SELL    │ 500 AQUARI     │ 0.00039 ETH   │ 2.50%      │
└─────────┴────────────────┴───────────────┴────────────┘

  ✅ BUY fee is 2.50% (expected: 2.50%)
  ✅ SELL fee is 2.50% (expected: 2.50%)
  ✅ Foundation wallet received tokens
  ✅ Tokens were burned (supply decreased)

  🎉 FEE SYSTEM IS FULLY OPERATIONAL! 🎉
```

### One-Line Full Fork Test

Run all steps in sequence:

```bash
docker restart aquari-fork && sleep 3 && \
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network fork && \
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network fork && \
npx hardhat run scripts/mainnet-execution/2b_test_trading_before.js --network fork && \
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network fork && \
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network fork && \
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network fork
```

---

## Test Token Deployment (Optional - Real Mainnet Testing)

Deploy a **separate test token** (AQTEST) on real Base mainnet to verify fee behavior via Uniswap UI without risking the real AQUARI contract.

### Why Use Test Token?

- Trade on **real Uniswap UI** (not scripted trades)
- Test user experience with slippage, confirmations, etc.
- Verify fee display and actual received amounts
- No risk to real AQUARI contract
- Cost: ~0.02 ETH (deployment + LP + gas)

### Test Token Workflow

```bash
# Step 1: Deploy AquariTest (AQTEST) token
npx hardhat run scripts/test-token/1_deploy.js --network base

# Step 2: Add liquidity (0.01 ETH + 1M AQTEST)
npx hardhat run scripts/test-token/2_add_liquidity.js --network base

# Step 3: Verify deployment state
npx hardhat run scripts/test-token/3_verify_state.js --network base

# ============================================
# NOW TEST ON UNISWAP UI (WITHOUT FEES)
# ============================================
# 1. Go to https://app.uniswap.org
# 2. Select Base network
# 3. Import token: <proxy address from scripts/test-token/state.json>
# 4. Swap ETH -> AQTEST or AQTEST -> ETH
# 5. Verify: 0% fee (you receive full expected amount)

# Step 4: Enable fees (foundation wallet + pair + tax config)
npx hardhat run scripts/test-token/4_configure.js --network base

# ============================================
# NOW TEST ON UNISWAP UI (WITH FEES)
# ============================================
# 1. Trade on Uniswap again
# 2. Verify: ~2.5% less tokens received
# 3. Check foundation wallet received tokens
# 4. Check total supply decreased (burn)
```

### Test Token State File

Deployed addresses are saved to `scripts/test-token/state.json`:

```json
{
  "deployed": true,
  "proxy": "0x...",
  "implementation": "0x...",
  "owner": "0x...",
  "pair": "0x...",
  "lpAdded": true,
  "feesEnabled": true,
  "deployedAt": "2026-02-03T..."
}
```

---

## Mainnet Execution

### Pre-Flight Checklist

Before executing on mainnet, verify:

- [ ] All fork tests passed successfully
- [ ] You have the owner's private key in `.env`
- [ ] You have sufficient ETH for gas (~0.001 ETH)
- [ ] You understand `setUniswapV2Pair` is **IRREVERSIBLE**
- [ ] Addresses in config have been triple-verified
- [ ] Someone else has reviewed the addresses

### Mainnet Commands

```bash
# Step 1: Verify current state (READ ONLY - safe to run)
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base

# Step 2: Set tax configuration (CAN be changed later)
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base

# Step 3: Enable fees (⚠️ IRREVERSIBLE!)
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base
# You will be prompted: Type 'ENABLE FEES' to confirm

# Step 4: Verify fees are active (READ ONLY)
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base

# Step 5: Test trading (costs real ETH - optional)
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network base
```

### What Happens at Each Step

| Step | Script | Action | Reversible |
|------|--------|--------|------------|
| 1 | 1_verify_before.js | Read contract state | READ ONLY |
| 2 | 2_set_fees.js | Set burnTax=125, foundationFee=125 | ✅ Yes |
| 3 | 3_enable_fees.js | Call `setUniswapV2Pair()` | ❌ **NO** |
| 4 | 4_verify_after.js | Verify pairIsSet=true | READ ONLY |
| 5 | 5_test_trading_after.js | Execute test trades | READ ONLY* |

*Step 5 executes real trades on mainnet and costs ETH.

---

## Available Test Suites

### 1. Mainnet Execution Scripts

Location: `scripts/mainnet-execution/`

| Script | Purpose |
|--------|---------|
| `1_verify_before.js` | Pre-flight checks (owner, state, pair) |
| `2_set_fees.js` | Set tax configuration |
| `2b_test_trading_before.js` | Test BUY/SELL before fees (expect 0%) |
| `3_enable_fees.js` | Enable fees by setting pair (IRREVERSIBLE) |
| `4_verify_after.js` | Verify fees are enabled |
| `5_test_trading_after.js` | Test BUY/SELL after fees (expect 2.5%) |

### 2. Comprehensive Automated Test Suite

Location: `scripts/fork-test/`

```bash
# Run all 28+ tests
npx hardhat run scripts/fork-test/run-all.js --network fork
```

**Test Categories:**

| Category | Tests | Description |
|----------|-------|-------------|
| Pre-Flight | PF01-PF05 | Fork running, network, balance, paused, trading |
| Access Control | T01-T03 | Owner validation, pairIsSet, pair address |
| Security | S01-S03 | Non-owner cannot call admin functions |
| Configuration | T04-T05b | setTaxConfig, setUniswapV2Pair one-time |
| Trading | T06-T09 | Buy/sell fees, math accuracy, swap failures |
| State | T10-T11 | Burn verification, foundation receives |
| Exclusion | T12-T13 | Excluded addresses skip fees |
| Edge Cases | E01-E04 | Zero fees, high fees, extreme fees |
| Admin | A01-A02 | Can change config after enable |
| Gas | G01-G04 | Gas cost tracking |

### 3. Real AQUARI Test Script

Location: `scripts/fork-test/test-real-aquari.js`

```bash
# Test the real AQUARI contract on fork
npx hardhat run scripts/fork-test/test-real-aquari.js --network fork
```

### 4. Simulation Scenarios

Location: `scripts/simulation/`

```bash
# Run all 5 simulation scenarios
npx hardhat run scripts/simulation/run_all_simulations.js --network fork
```

**Scenarios:**

| # | Name | Purpose |
|---|------|---------|
| 1 | Baseline | Correct workflow test |
| 2 | Wrong Pair | Set wrong pair address |
| 3 | Wrong Order | Set pair before fees |
| 4 | High Fees | 50% total fees stress test |
| 5 | Final Rehearsal | Exact mainnet replica |

### 5. Test Token Scripts

Location: `scripts/test-token/`

| Script | Purpose |
|--------|---------|
| `1_deploy.js` | Deploy AQTEST as UUPS proxy |
| `2_add_liquidity.js` | Create LP (0.01 ETH + 1M tokens) |
| `3_verify_state.js` | Verify deployment (READ ONLY) |
| `4_configure.js` | Set foundation, fees, enable |

---

## Contract Addresses

### AQUARI Token (Mainnet)

| Contract | Address | Verified |
|----------|---------|----------|
| Token Proxy | `0x7f0e9971d3320521fc88f863e173a4cddbb051ba` | [BaseScan](https://basescan.org/address/0x7f0e9971d3320521fc88f863e173a4cddbb051ba) |
| Implementation | `0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05` | [BaseScan](https://basescan.org/address/0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05) |
| LP Pair | `0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F` | [BaseScan](https://basescan.org/address/0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F) |
| Foundation Wallet | `0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235` | - |
| Owner | `0x187ED96248Bbbbf4D5b059187e030B7511b67801` | - |

### Base Network Infrastructure

| Contract | Address |
|----------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V2 Factory | `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6` |
| Uniswap V2 Router | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |
| V4 Universal Router | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## Fee Configuration Details

### Current Fee Structure

| Parameter | Value | Description |
|-----------|-------|-------------|
| `burnTax` | 125 bps | 1.25% of each trade is burned |
| `foundationFee` | 125 bps | 1.25% of each trade goes to foundation |
| **Total** | **250 bps** | **2.5% total fee on each trade** |

### Example Trade

```
User trades 1,000 AQUARI:
├── 12.5 tokens → BURNED (removed from total supply)
├── 12.5 tokens → Foundation wallet
└── 975 tokens → Trader receives (97.5%)
```

### What Admin CAN Change (After Enable)

```javascript
// Change fee percentages
await token.setTaxConfig(100, 100);  // Lower to 2% total
await token.setTaxConfig(0, 0);      // Remove all fees

// Change foundation wallet
await token.setFoundationWallet("0xNewAddress...");

// Trading controls
await token.setTradingEnabled(false);  // Disable trading
await token.pause();                   // Emergency pause

// Fee exclusions
await token.excludeFromTax("0xAddress...");
await token.includeInTax("0xAddress...");
```

### What Admin CANNOT Change

```javascript
// This REVERTS after first call - pair is permanently set
await token.setUniswapV2Pair(newAddress);  // Error: "PairAlreadySet"
```

---

## Troubleshooting

### "You are NOT the owner"

**On Fork:**
- Docker must be running: `docker ps`
- Restart if needed: `docker restart aquari-fork`

**On Mainnet:**
- Check `ADMIN_KEY` in `.env` matches owner address
- Verify owner: `0x187ED96248Bbbbf4D5b059187e030B7511b67801`

### "PairAlreadySet"

- Fees are already enabled on this contract
- This is expected if running `3_enable_fees.js` twice
- The pair address cannot be changed after setting

### Fork Node Not Responding

```bash
# Check status
docker ps

# Restart with fresh state
docker restart aquari-fork
sleep 5
```

### "K" Error on Sell

- This is expected behavior for fee tokens with standard V2 swaps
- Our scripts use V4 Universal Router which handles this correctly
- If using V2 Router directly, use `swapExactTokensForETHSupportingFeeOnTransferTokens`

### 0% Fees After Enabling

- Verify `pairIsSet` is `true` (run `4_verify_after.js`)
- Make sure trader is NOT the owner (owner is excluded from fees)
- Fork testing uses Account #1 for trades, not the owner account

### Transaction Failing on Mainnet

1. Check ETH balance for gas
2. Verify network is Base (chain ID 8453)
3. Check [BaseScan](https://basescan.org) for error details
4. Verify gas price is reasonable

### "Invalid nonce" or "replacement transaction underpriced"

```bash
# On fork: restart to reset state
docker restart aquari-fork
```

---

## Folder Structure

```
scripts/
├── README.md                       # This documentation
├── config.js                       # Main configuration (simulations + mainnet)
│
├── mainnet-execution/              # Production scripts for real AQUARI
│   ├── 1_verify_before.js          # Pre-flight checks
│   ├── 2_set_fees.js               # Set tax configuration
│   ├── 2b_test_trading_before.js   # Test trades (0% fee expected)
│   ├── 3_enable_fees.js            # Enable fees (IRREVERSIBLE!)
│   ├── 4_verify_after.js           # Verify state
│   └── 5_test_trading_after.js     # Test trades (2.5% fee expected)
│
├── test-token/                     # Deploy test token on Base mainnet
│   ├── 1_deploy.js                 # Deploy AQTEST
│   ├── 2_add_liquidity.js          # Create LP pair
│   ├── 3_verify_state.js           # Verify deployment
│   ├── 4_configure.js              # Enable fees
│   ├── config.js                   # Test token configuration
│   └── state.json                  # Saved addresses
│
├── fork-test/                      # Comprehensive automated test suite
│   ├── run-all.js                  # Main test runner (28+ tests)
│   ├── test-real-aquari.js         # Real AQUARI tests
│   ├── config.js                   # Fork test configuration
│   └── lib/                        # Utility modules
│
├── simulation/                     # Step-by-step simulation scenarios
│   ├── 0_deploy.js → 6_verify.js   # Individual steps
│   └── run_all_simulations.js      # Run all scenarios
│
├── utils/                          # Shared utilities
│   └── universalRouter.js          # V4 Universal Router helpers
│
└── legacy/                         # Older scripts (reference only)
```

---

## Quick Reference

```bash
# ═══════════════════════════════════════════════════════════════════════
# FORK TESTING (No private key needed)
# ═══════════════════════════════════════════════════════════════════════
docker restart aquari-fork && sleep 3
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network fork
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network fork
npx hardhat run scripts/mainnet-execution/2b_test_trading_before.js --network fork
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network fork
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network fork
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network fork

# ═══════════════════════════════════════════════════════════════════════
# TEST TOKEN DEPLOYMENT (Base mainnet - costs ~0.02 ETH)
# ═══════════════════════════════════════════════════════════════════════
npx hardhat run scripts/test-token/1_deploy.js --network base
npx hardhat run scripts/test-token/2_add_liquidity.js --network base
npx hardhat run scripts/test-token/3_verify_state.js --network base
# Trade on Uniswap UI - verify 0% fee
npx hardhat run scripts/test-token/4_configure.js --network base
# Trade on Uniswap UI - verify 2.5% fee

# ═══════════════════════════════════════════════════════════════════════
# MAINNET EXECUTION (Requires owner key in .env)
# ═══════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base  # IRREVERSIBLE!
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base

# ═══════════════════════════════════════════════════════════════════════
# COMPREHENSIVE TEST SUITE
# ═══════════════════════════════════════════════════════════════════════
npx hardhat run scripts/fork-test/run-all.js --network fork
npx hardhat run scripts/fork-test/test-real-aquari.js --network fork
```

---

## Support

For issues or questions, contact the development team.
