# AQUARI Scripts

Complete guide for testing and deploying AQUARI fee-on-transfer token on Base mainnet.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start - Fork Testing](#quick-start---fork-testing)
3. [Test Token (AQTEST) Deployment](#test-token-aqtest-deployment)
4. [Mainnet AQUARI Fee Enablement](#mainnet-aquari-fee-enablement)
5. [All Commands Reference](#all-commands-reference)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env - add your private key (required for mainnet, optional for fork)
# ADMIN_KEY=your_private_key_here
# BASE_RPC=https://mainnet.base.org
# BASESCAN_API_KEY=your_api_key
```

### 3. Start Docker Fork (Required for Testing)

```bash
# Start Anvil fork of Base mainnet
docker compose up -d

# Verify it's running (should show "healthy")
docker ps | grep aquari-fork

# Check logs if needed
docker logs aquari-fork
```

### 4. Docker Commands Reference

```bash
docker compose up -d        # Start fork node
docker compose down         # Stop fork node
docker restart aquari-fork  # Restart for FRESH state (important!)
docker logs aquari-fork     # View logs
docker ps                   # Check status
```

> ⚠️ **IMPORTANT:** Always run `docker restart aquari-fork` before starting a new test sequence to get fresh blockchain state!

---

## Quick Start - Fork Testing

Test the REAL mainnet AQUARI contract on a fork (no private key needed - impersonates owner).

### End-to-End Fork Test (5 minutes)

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Start fresh fork
# ═══════════════════════════════════════════════════════════════════════════════
docker restart aquari-fork && sleep 3

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Verify current state (READ ONLY)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network fork

# Expected output:
#   ✅ You ARE the owner (impersonated)
#   ✅ pairIsSet is false
#   ✅ Trading is enabled

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Set tax configuration (125 bps burn + 125 bps foundation = 2.5%)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network fork

# Expected output:
#   ✅ Tax configuration set!
#   burnTax: 125 bps (1.25%)
#   foundationFee: 125 bps (1.25%)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Test trading BEFORE fees enabled (should be 0% fee)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/2b_test_trading_before.js --network fork

# Expected output:
#   ✅ BUY fee is 0.00%
#   ✅ SELL fee is 0.00%
#   (pairIsSet = false, so fees don't apply yet)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Enable fees (set pair address) - IRREVERSIBLE on mainnet!
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network fork

# Expected output:
#   🔵 FORK MODE: Auto-proceeding (no confirmation needed)
#   ✅ Pair set! FEES ARE NOW ACTIVE!

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: Verify fees are enabled
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network fork

# Expected output:
#   pairIsSet: true ✅ FEES ENABLED
#   Burn Tax: 125 bps (1.25%)
#   Foundation Fee: 125 bps (1.25%)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: Test trading AFTER fees enabled (should be 2.5% fee)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network fork

# Expected output:
#   ✅ BUY fee is 2.50%
#   ✅ SELL fee is 2.50%
#   ✅ Foundation received tokens
#   ✅ Tokens were burned
#   🎉 FEE SYSTEM IS FULLY OPERATIONAL! 🎉
```

### One-Line Full Test

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

## Test Token (AQTEST) Deployment

Deploy a test token on Base mainnet to verify fee behavior via Uniswap UI trades.

### Why Use Test Token?

- Test on **real Base mainnet** (not fork)
- Trade via **Uniswap UI** to verify real user experience
- Test fees **before** and **after** enabling
- No risk to real AQUARI contract

### End-to-End Test Token Deployment

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Deploy AquariTest (AQTEST) to Base mainnet
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/test-token/1_deploy.js --network base

# Expected output:
#   ✅ Deployment successful!
#   Proxy: 0x...
#   Name: Aquari Test (AQTEST)
#   Total Supply: 100,000,000 AQTEST
#   State saved to: scripts/test-token/state.json

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Add liquidity (0.01 ETH + 1,000,000 AQTEST)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/test-token/2_add_liquidity.js --network base

# Expected output:
#   ✅ Liquidity added!
#   Pair Address: 0x...
#   AQTEST Reserve: 1,000,000
#   ETH Reserve: 0.01
#   State saved to: scripts/test-token/state.json

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Verify state
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/test-token/3_verify_state.js --network base

# Expected output:
#   ✅ Contract deployed
#   ✅ LP created
#   ✅ Trading enabled
#   ○ Fees enabled (pairIsSet = false)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: TEST ON UNISWAP UI (WITHOUT FEES)
# ═══════════════════════════════════════════════════════════════════════════════
# 1. Go to https://app.uniswap.org
# 2. Connect wallet, select Base network
# 3. Import token using proxy address from state.json
# 4. Swap ETH → AQTEST (BUY) or AQTEST → ETH (SELL)
# 5. Verify: NO FEE deducted (you receive 100% of expected tokens)

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Enable fees (set foundation wallet + pair + tax config)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/test-token/4_configure.js --network base

# Expected output:
#   ✅ Foundation wallet updated! (0x802D8097eC1D49808F3c2c866020442891adde57)
#   ✅ Tax config updated! (125 + 125 = 2.5%)
#   ✅ Pair set! FEES ARE NOW ACTIVE!
#   🎉 Ready to trade on Uniswap UI with 2.5% fees! 🎉

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: TEST ON UNISWAP UI (WITH FEES)
# ═══════════════════════════════════════════════════════════════════════════════
# 1. Trade on Uniswap again
# 2. Verify: 2.5% FEE deducted (you receive ~97.5% of expected tokens)
# 3. Check foundation wallet received 1.25%
# 4. Check total supply decreased (1.25% burned)
```

### Test Token Configuration

Edit `scripts/test-token/config.js` to change settings:

```javascript
const CONFIG = {
    liquidityETH: "0.01",           // ETH for initial LP
    liquidityTokens: "1000000",     // Tokens for initial LP (1 million)
    newFoundationWallet: "0x802D8097eC1D49808F3c2c866020442891adde57",
    taxConfig: {
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
};
```

### Test Token State File

All addresses are saved to `scripts/test-token/state.json`:

```json
{
  "deployed": true,
  "proxy": "0x...",
  "implementation": "0x...",
  "owner": "0x...",
  "pair": "0x...",
  "lpAdded": true,
  "feesEnabled": true
}
```

---

## Mainnet AQUARI Fee Enablement

Enable fees on the **real AQUARI token** on Base mainnet.

### ⚠️ IMPORTANT WARNINGS

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  1. You must be the CONTRACT OWNER                                             ║
║  2. setUniswapV2Pair() is IRREVERSIBLE - cannot be changed after!             ║
║  3. If you set WRONG pair address, fees will NEVER work                       ║
║  4. TEST ON FORK FIRST before running on mainnet!                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Pre-Flight Checklist

- [ ] Tested all scripts on fork successfully
- [ ] Verified you are the owner
- [ ] Verified pair address matches factory pair
- [ ] Verified tax config is correct (125 + 125 = 250 bps = 2.5%)
- [ ] Have someone double-check all addresses
- [ ] Understand that setUniswapV2Pair is IRREVERSIBLE

### Mainnet Execution

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Verify current state (READ ONLY)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Set tax configuration
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Enable fees (⚠️ IRREVERSIBLE!)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base

# You will be prompted: Type 'ENABLE FEES' to proceed

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: Verify fees are enabled
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: Test trading (optional - costs real ETH)
# ═══════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network base
```

---

## All Commands Reference

### Docker Commands

| Command | Description |
|---------|-------------|
| `docker compose up -d` | Start fork node |
| `docker compose down` | Stop fork node |
| `docker restart aquari-fork` | **Restart for fresh state** |
| `docker logs aquari-fork` | View logs |
| `docker ps` | Check status |

### Fork Testing (--network fork)

| Script | Description | Owner Key |
|--------|-------------|-----------|
| `scripts/mainnet-execution/1_verify_before.js` | Pre-flight checks | ❌ No (impersonates) |
| `scripts/mainnet-execution/2_set_fees.js` | Set tax config | ❌ No (impersonates) |
| `scripts/mainnet-execution/2b_test_trading_before.js` | Test trades (0% fee) | ❌ No |
| `scripts/mainnet-execution/3_enable_fees.js` | Enable fees | ❌ No (auto-proceeds) |
| `scripts/mainnet-execution/4_verify_after.js` | Verify state | ❌ No (impersonates) |
| `scripts/mainnet-execution/5_test_trading_after.js` | Test trades (2.5% fee) | ❌ No |

### Test Token (--network base)

| Script | Description |
|--------|-------------|
| `scripts/test-token/1_deploy.js` | Deploy AQTEST proxy |
| `scripts/test-token/2_add_liquidity.js` | Create LP (0.01 ETH + 1M tokens) |
| `scripts/test-token/3_verify_state.js` | Verify contract state |
| `scripts/test-token/4_configure.js` | Set foundation, fees, enable |

### Mainnet Execution (--network base)

| Script | Description | Reversible |
|--------|-------------|------------|
| `scripts/mainnet-execution/1_verify_before.js` | Pre-flight checks | READ ONLY |
| `scripts/mainnet-execution/2_set_fees.js` | Set tax config | ✅ Yes |
| `scripts/mainnet-execution/3_enable_fees.js` | Enable fees | ⚠️ **NO** |
| `scripts/mainnet-execution/4_verify_after.js` | Verify state | READ ONLY |
| `scripts/mainnet-execution/5_test_trading_after.js` | Test trades | READ ONLY |

### Additional Test Scripts

| Script | Description |
|--------|-------------|
| `scripts/fork-test/run-all.js` | Comprehensive 28-test suite |
| `scripts/fork-test/test-real-aquari.js` | Test real AQUARI with impersonation |
| `scripts/simulation/run_all_simulations.js` | Run all 5 simulation scenarios |

---

## Contract Addresses

### AQUARI Mainnet

| Contract | Address |
|----------|---------|
| Token (Proxy) | `0x7f0e9971d3320521fc88f863e173a4cddbb051ba` |
| LP Pair | `0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F` |
| Foundation Wallet | `0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235` |
| Owner | `0x187ED96248Bbbbf4D5b059187e030B7511b67801` |

### Base Network

| Contract | Address |
|----------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V2 Factory | `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6` |
| Uniswap V2 Router | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |
| V4 Universal Router | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## Fee Configuration

### Tax Settings

| Parameter | Value | Description |
|-----------|-------|-------------|
| burnTax | 125 bps | 1.25% burned on each trade |
| foundationFee | 125 bps | 1.25% to foundation wallet |
| **Total** | **250 bps** | **2.5% total fee** |

### What Happens on Each Trade

```
User trades 1000 tokens:
├── 12.5 tokens BURNED (removed from supply)
├── 12.5 tokens to FOUNDATION wallet
└── 975 tokens to TRADER (97.5%)
```

### What Admin CAN Change (anytime)

```javascript
await token.setTaxConfig(200, 200);        // Change to 4% total
await token.setTaxConfig(0, 0);            // Remove all fees
await token.setFoundationWallet("0x...");  // Change wallet
await token.setTradingEnabled(false);      // Disable trading
await token.pause();                       // Emergency pause
```

### What Admin CANNOT Change

```javascript
// ❌ Cannot call again - pair is permanently set
await token.setUniswapV2Pair(address);  // REVERTS with "PairAlreadySet"
```

---

## Troubleshooting

### "You are NOT the owner"

- On fork: Should auto-impersonate, check Docker is running
- On mainnet: Verify `ADMIN_KEY` in `.env` matches owner address

### "PairAlreadySet"

- Fees are already enabled
- This is expected if running script twice
- Cannot change pair address after setting

### Fork node not responding

```bash
docker restart aquari-fork
sleep 5  # Wait for node to start
```

### "K" error on sell

- This is EXPECTED for fee tokens with regular V2 swaps
- Scripts use V4 Universal Router which handles this correctly

### 0% fees after enabling

- Make sure trader is NOT the owner (owner is excluded from fees)
- Fork testing uses Account #1, not Account #0

### Transaction failing on mainnet

- Check ETH balance for gas
- Verify you're on Base network (chain ID 8453)
- Check BaseScan for error details

---

## Folder Structure

```
scripts/
├── README.md                    ← This file
├── config.js                    ← Shared configuration
│
├── mainnet-execution/           ← REAL AQUARI scripts
│   ├── 1_verify_before.js       Pre-flight checks
│   ├── 2_set_fees.js            Set tax configuration
│   ├── 2b_test_trading_before.js  Test BUY/SELL (0% fee)
│   ├── 3_enable_fees.js         Enable fees (⚠️ IRREVERSIBLE!)
│   ├── 4_verify_after.js        Verify state
│   └── 5_test_trading_after.js  Test BUY/SELL (2.5% fee)
│
├── test-token/                  ← Test token (AQTEST) scripts
│   ├── 1_deploy.js              Deploy to Base mainnet
│   ├── 2_add_liquidity.js       Create LP pair
│   ├── 3_verify_state.js        Verify state
│   ├── 4_configure.js           Enable fees
│   ├── config.js                Test token config
│   └── state.json               Saved addresses
│
├── fork-test/                   ← Comprehensive test suite
│   ├── run-all.js               28-test runner
│   ├── test-real-aquari.js      Real AQUARI test
│   └── config.js                Fork test config
│
├── simulation/                  ← Simulation scenarios
│   └── *.js                     5 different test scenarios
│
└── utils/                       ← Shared utilities
    └── universalRouter.js       V4 router helpers
```

---

## Quick Reference Card

```bash
# ════════════════════════════════════════════════════════════════════════════
# FORK TESTING (No private key needed)
# ════════════════════════════════════════════════════════════════════════════
docker restart aquari-fork && sleep 3
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network fork
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network fork
npx hardhat run scripts/mainnet-execution/2b_test_trading_before.js --network fork
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network fork
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network fork
npx hardhat run scripts/mainnet-execution/5_test_trading_after.js --network fork

# ════════════════════════════════════════════════════════════════════════════
# TEST TOKEN DEPLOYMENT (Base mainnet)
# ════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/test-token/1_deploy.js --network base
npx hardhat run scripts/test-token/2_add_liquidity.js --network base
npx hardhat run scripts/test-token/3_verify_state.js --network base
# Trade on Uniswap UI - verify 0% fee
npx hardhat run scripts/test-token/4_configure.js --network base
# Trade on Uniswap UI - verify 2.5% fee

# ════════════════════════════════════════════════════════════════════════════
# MAINNET EXECUTION (Requires owner key in .env)
# ════════════════════════════════════════════════════════════════════════════
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base  # ⚠️ IRREVERSIBLE!
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base
```
