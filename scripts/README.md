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

### For Simulation (Testing)

```bash
# Edit config.js - set MODE = "simulation" and activeContract = 1-5

# Step 0: Deploy test token
npx hardhat run scripts/simulation/0_deploy.js --network hardhat

# Step 1: Add liquidity (creates pair)
npx hardhat run scripts/simulation/1_add_liquidity.js --network hardhat

# Step 2: Set tax config (can change later)
npx hardhat run scripts/simulation/2_set_tax_config.js --network hardhat

# Step 3: Enable fees (IRREVERSIBLE!)
npx hardhat run scripts/simulation/3_set_pair.js --network hardhat

# Step 4: Test buy
npx hardhat run scripts/simulation/4_test_buy.js --network hardhat

# Step 5: Test sell
npx hardhat run scripts/simulation/5_test_sell.js --network hardhat

# Step 6: Verify final state
npx hardhat run scripts/simulation/6_verify_state.js --network hardhat
```

### For Mainnet (Real AQUARI)

```bash
# Edit config.js - set MODE = "mainnet"

# Step 1: Verify state (READ ONLY)
npx hardhat run scripts/mainnet-execution/1_verify_before.js --network baseMainnet

# Step 2: Set tax config (can change later)
npx hardhat run scripts/mainnet-execution/2_set_fees.js --network baseMainnet

# Step 3: Enable fees (⚠️ IRREVERSIBLE!)
npx hardhat run scripts/mainnet-execution/3_enable_fees.js --network baseMainnet

# Step 4: Verify everything works
npx hardhat run scripts/mainnet-execution/4_verify_after.js --network baseMainnet
```

---

## Folder Structure

```
scripts/
├── config.js                    ← Configuration file (MODE, addresses, etc.)
├── README.md                    ← This file
│
├── simulation/                  ← Test scripts (fork/testnet)
│   ├── 0_deploy.js              Deploy test token
│   ├── 1_add_liquidity.js       Create pair + add liquidity
│   ├── 2_set_tax_config.js      Set burn + foundation fees
│   ├── 3_set_pair.js            Enable fees (IRREVERSIBLE)
│   ├── 4_test_buy.js            Test buying tokens
│   ├── 5_test_sell.js           Test selling tokens
│   └── 6_verify_state.js        Verify final state
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

## Configuration (config.js)

### Switch Mode

```javascript
const MODE = "simulation";  // For testing
// or
const MODE = "mainnet";     // For real AQUARI
```

### Simulation Contracts

```javascript
const SIMULATION = {
    activeContract: 1,  // Which sim contract (1-5)
    contracts: {
        1: { purpose: "Baseline - correct setup" },
        2: { purpose: "Wrong pair address test" },
        3: { purpose: "Wrong order test" },
        4: { purpose: "High fees test (50%)" },
        5: { purpose: "Final rehearsal" },
    },
    // ...
};
```

### Tax Configuration

```javascript
// Target: 1.25% burn + 1.25% foundation = 2.5% total
const MAINNET = {
    taxConfig: {
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
    // ...
};
```

---

## What Each Script Does

### Simulation Scripts

| Script | Action | Reversible? |
|--------|--------|-------------|
| 0_deploy.js | Deploys test token | N/A |
| 1_add_liquidity.js | Creates pair, adds LP | N/A |
| 2_set_tax_config.js | Sets burn + foundation fees | ✅ YES |
| 3_set_pair.js | Enables fees on trades | ❌ NO! |
| 4_test_buy.js | Tests buy, verifies fees | N/A |
| 5_test_sell.js | Tests sell, verifies fees | N/A |
| 6_verify_state.js | Shows final state | N/A |

### Mainnet Scripts

| Script | Action | Reversible? |
|--------|--------|-------------|
| 1_verify_before.js | Checks state (READ ONLY) | N/A |
| 2_set_fees.js | Sets tax configuration | ✅ YES |
| 3_enable_fees.js | Enables fees (sets pair) | ❌ NO! |
| 4_verify_after.js | Verifies everything (READ ONLY) | N/A |

---

## Simulation Test Scenarios

| Sim | Purpose | What to Test |
|-----|---------|--------------|
| 1 | Baseline | Everything correct - fees should work |
| 2 | Wrong pair | Set wrong pair address - fees won't apply |
| 3 | Wrong order | Set pair before fees - still works |
| 4 | High fees | 50% total fee - test high slippage |
| 5 | Rehearsal | Exact mainnet config - final test |

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
await token.setUniswapV2Pair(address);  // Will REVERT!
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
- Check trader is not excluded from tax

---

## Safety Checklist

Before running mainnet scripts:

- [ ] Test ALL scenarios on simulation first
- [ ] Verify you are the owner
- [ ] Verify pair address matches factory
- [ ] Verify tax config is correct
- [ ] Understand that setUniswapV2Pair is IRREVERSIBLE
- [ ] Have someone double-check addresses
