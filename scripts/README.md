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

## Quick Start

### 1. Start Fork (Docker)

```bash
# Start Anvil fork of Base mainnet
docker compose up -d

# Verify fork is running
docker compose ps
```

### 2. Run Simulation Tests (Recommended First)

```bash
# Edit config.js - set ACTIVE_SIMULATION = 1 (or 2,3,4,5)

# Run all steps for simulation
npx hardhat run scripts/simulation/0_deploy.js --network fork
npx hardhat run scripts/simulation/1_add_liquidity.js --network fork
npx hardhat run scripts/simulation/2_set_tax_config.js --network fork
npx hardhat run scripts/simulation/2b_test_before_fees.js --network fork  # NEW: Verify 0% before enable
npx hardhat run scripts/simulation/3_set_pair.js --network fork           # ⚠️ IRREVERSIBLE
npx hardhat run scripts/simulation/4_test_buy.js --network fork
npx hardhat run scripts/simulation/5_test_sell.js --network fork
npx hardhat run scripts/simulation/6_verify_state.js --network fork

# Or run all 5 simulations automatically
node scripts/simulation/run_all_simulations.js
```

### 3. Fork Test with New Token

```bash
# Deploy fresh AquariProtocol on fork, test as owner
npx hardhat run scripts/fork-test/run-all.js --network fork
```

### 4. Mainnet Execution (Production)

```bash
# Edit config.js - set MODE = "mainnet"

# Step 1: Verify state (READ ONLY)
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network base

# Step 2: Set tax config (can change later)
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network base

# Step 3: Enable fees (⚠️ IRREVERSIBLE!)
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network base

# Step 4: Verify everything works
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network base
```

---

## Folder Structure

```
scripts/
├── config.js                    ← Configuration (MODE, addresses, simulations)
├── README.md                    ← This file
│
├── simulation/                  ← Step-by-step simulation scripts
│   ├── 0_deploy.js              Deploy test token (AquariSim1-5)
│   ├── 1_add_liquidity.js       Create pair + add liquidity
│   ├── 2_set_tax_config.js      Set burn + foundation fees
│   ├── 2b_test_before_fees.js   ★ Test buy/sell BEFORE fees (verify 0%)
│   ├── 3_set_pair.js            Enable fees (IRREVERSIBLE!)
│   ├── 4_test_buy.js            Test buying tokens (verify fees)
│   ├── 5_test_sell.js           Test selling tokens (verify fees)
│   ├── 6_verify_state.js        Verify final state
│   └── run_all_simulations.js   ★ Master script (runs all 5 sims)
│
├── fork-test/                   ← Automated fork testing
│   ├── run-all.js               Main test runner
│   ├── config.js                Fork test configuration
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

## Simulation Test Scenarios

| Sim | Contract | Purpose | Tax Config |
|-----|----------|---------|------------|
| 1 | AquariSim1 | Baseline - correct setup | 2.5% (1.25% + 1.25%) |
| 2 | AquariSim2 | Wrong pair address test | 2.5% |
| 3 | AquariSim3 | Wrong order test (pair before fees) | 2.5% |
| 4 | AquariSim4 | High fees test | 50% (25% + 25%) |
| 5 | AquariSim5 | Final rehearsal (exact mainnet config) | 2.5% |

### Test Results (All Pass)

| Sim | Before Fees | After Fees | Result |
|-----|-------------|------------|--------|
| 1 | 0% ✓ | 2.5% ✓ | **PASS** |
| 2 | 0% ✓ | 0% ✓ (wrong pair) | **PASS** |
| 3 | 0% ✓ | 2.5% ✓ | **PASS** |
| 4 | 0% ✓ | 50% ✓ | **PASS** |
| 5 | 0% ✓ | 2.5% ✓ | **PASS** |

---

## What Each Script Does

### Simulation Scripts

| Script | Action | Reversible? |
|--------|--------|-------------|
| 0_deploy.js | Deploys test token | N/A |
| 1_add_liquidity.js | Creates pair, adds LP | N/A |
| 2_set_tax_config.js | Sets burn + foundation fees | ✅ YES |
| **2b_test_before_fees.js** | Tests buy/sell with 0% fees | N/A |
| 3_set_pair.js | Enables fees on trades | ❌ NO! |
| 4_test_buy.js | Tests buy, verifies fees applied | N/A |
| 5_test_sell.js | Tests sell, verifies fees applied | N/A |
| 6_verify_state.js | Shows final state | N/A |

### Mainnet Scripts

| Script | Action | Reversible? |
|--------|--------|-------------|
| 1_verify_before.js | Checks state (READ ONLY) | N/A |
| 2_set_fees.js | Sets tax configuration | ✅ YES |
| 3_enable_fees.js | Enables fees (sets pair) | ❌ NO! |
| 4_verify_after.js | Verifies everything (READ ONLY) | N/A |

---

## Key Findings from Testing

### 1. Fee Enablement Flow

```
setTaxConfig() → Sets fee rates (can change anytime)
setUniswapV2Pair() → Enables fees (ONE TIME, IRREVERSIBLE!)
```

### 2. Before vs After Fees

| State | pairIsSet | Buy Fee | Sell Fee | Regular Swap |
|-------|-----------|---------|----------|--------------|
| Before enable | false | 0% | 0% | Works |
| After enable | true | 2.5% | 2.5% | FAILS (use Supporting) |

### 3. Excluded Addresses

- Owner is excluded from fees by default
- Test with non-owner account (Account #1) for accurate results

### 4. Sell Method

```javascript
// ❌ Regular swap FAILS for fee tokens
router.swapExactTokensForETH(...)  // FAILS with "K" error

// ✅ Use SupportingFeeOnTransferTokens
router.swapExactTokensForETHSupportingFeeOnTransferTokens(...)  // WORKS
```

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
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
};
```

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

## Troubleshooting

### "You are NOT the owner"
- Check your private key in .env matches the contract owner
- Verify on BaseScan who the owner is

### "PairAlreadySet"
- Fees are already enabled
- You cannot change the pair address

### "K" error on sell
- This is EXPECTED for fee-on-transfer tokens
- Use `swapExactTokensForETHSupportingFeeOnTransferTokens`
- Uniswap UI handles this automatically

### Fees not applying
- Check `pairIsSet` is true
- Verify stored pair matches factory pair
- Check trader is not in `_excludedAddresses` or `isExcludedFromTax`

### Tests show 0% fees after enable
- Make sure buyer/seller is NOT the owner (owner is excluded)
- Use Account #1 or #2 for testing (not Account #0)

---

## Safety Checklist

Before running mainnet scripts:

- [ ] Run ALL 5 simulations successfully
- [ ] Test `--mainnet --new-token` on fork
- [ ] Verify you are the owner
- [ ] Verify pair address matches factory
- [ ] Verify tax config is correct (125 + 125 = 250 bps = 2.5%)
- [ ] Understand that setUniswapV2Pair is IRREVERSIBLE
- [ ] Have someone double-check addresses
- [ ] Test with non-owner account to verify fees apply
