# AQUARI Simulation Contracts

## Overview

These contracts are **EXACT COPIES** of the mainnet AQUARI contract with **ONLY name/symbol changed** for testing different fee enablement scenarios.

## Verification: Contracts Are Identical

All simulation contracts have **839 lines** - identical to mainnet.

### Only 3 Lines Differ (name/symbol/contract name):

| Line | Mainnet AQUARI | Simulation |
|------|---------------|------------|
| **30** | `contract AquariProtocol is` | `contract AquariSim1 is` |
| **298** | `__ERC20_init("Aquari", "AQUARI")` | `__ERC20_init("Aquari Sim1", "AQSIM1")` |
| **300** | `__ERC20Permit_init_unchained("Aquari")` | `__ERC20Permit_init_unchained("Aquari Sim1")` |

### How to Verify Yourself

```bash
# Compare mainnet vs simulation (only 3 lines should differ)
diff ../mainnet/AquariProtocol.sol AquariSim1.sol

# Verify line counts are identical
wc -l ../mainnet/AquariProtocol.sol AquariSim1.sol
```

### Verify with AI

You can paste both contracts into any AI (ChatGPT, Claude, etc.) and ask:
> "Compare these two contracts. Are they identical except for name/symbol?"

**The answer will be YES** - same logic, same line numbers, same everything.

---

## Simulation Contracts

| Contract | Symbol | Purpose |
|----------|--------|---------|
| `AquariSim1.sol` | AQSIM1 | Baseline - correct setup |
| `AquariSim2.sol` | AQSIM2 | Test wrong pair address |
| `AquariSim3.sol` | AQSIM3 | Test wrong order (pair before fees) |
| `AquariSim4.sol` | AQSIM4 | Test high fees (50%) |
| `AquariSim5.sol` | AQSIM5 | Final rehearsal before mainnet |

---

## Test Scenarios

### Scenario 1: Baseline (AQSIM1)
**Purpose:** Verify correct workflow works

```
1. Deploy AquariSim1
2. Add liquidity (create pair)
3. Call setTaxConfig(125, 125)  ← 1.25% burn + 1.25% foundation
4. Call setUniswapV2Pair(correctPairAddress)
5. Test buy/sell on Uniswap
```
**Expected:** 2.5% fee deducted on swaps

---

### Scenario 2: Wrong Pair Address (AQSIM2)
**Purpose:** What happens if wrong pair is set?

```
1. Deploy AquariSim2
2. Add liquidity (creates pair at address X)
3. Call setTaxConfig(125, 125)
4. Call setUniswapV2Pair(WRONG_ADDRESS)  ← Not the real pair!
5. Test buy/sell on Uniswap
```
**Expected:** NO fees applied (because real pair != stored pair)

**Risk Level:** HIGH - fees will NEVER work if wrong pair is set

---

### Scenario 3: Wrong Order (AQSIM3)
**Purpose:** What if pair is set BEFORE fees are configured?

```
1. Deploy AquariSim3
2. Add liquidity (creates pair)
3. Call setUniswapV2Pair(pairAddress)  ← Set pair FIRST
4. Call setTaxConfig(125, 125)  ← Set fees AFTER
5. Test buy/sell on Uniswap
```
**Expected:** Fees WILL work (order doesn't matter for fee calculation)

**Note:** The contract allows changing fees anytime, so order technically doesn't break it.

---

### Scenario 4: High Fees (AQSIM4)
**Purpose:** Test with extreme fees (50% total)

```
1. Deploy AquariSim4
2. Add liquidity
3. Call setTaxConfig(2500, 2500)  ← 25% burn + 25% foundation = 50%
4. Call setUniswapV2Pair(pairAddress)
5. Test buy/sell with high slippage
```
**Expected:** 50% fee deducted, requires 50%+ slippage tolerance

---

### Scenario 5: Final Rehearsal (AQSIM5)
**Purpose:** Exact replica of mainnet AQUARI fee enablement

```
1. Deploy AquariSim5
2. Add liquidity (matching mainnet liquidity ratio)
3. Call setTaxConfig(125, 125)  ← Exact mainnet config
4. Call setUniswapV2Pair(pairAddress)
5. Test on Uniswap UI
6. Verify fee detection works
7. Test both buy and sell
```
**Expected:** Identical behavior to what will happen on mainnet

---

## Key Contract Functions (Reference)

All on **same line numbers** as mainnet:

| Function | Line | Purpose |
|----------|------|---------|
| `initialize()` | 294 | Initialize token (name, symbol, owner) |
| `setFoundationWallet()` | 339 | Change foundation wallet |
| `setUniswapV2Pair()` | 351 | **Enable fees (IRREVERSIBLE)** |
| `setTaxConfig()` | 366 | Set burn tax + foundation fee |
| `setTradingEnabled()` | 389 | Enable/disable trading |
| `_update()` | 502 | **Core transfer logic with tax** |

### Tax Logic Location: Lines 532-566

```solidity
// Line 533-534: Check if Uniswap trade
bool isUniswapTrade = (from == uniswapV2Pair || to == uniswapV2Pair) &&
    pairIsSet;

// Line 544-547: Calculate taxes
uint256 burnAmount = (amount * burnTax) / TAX_DENOMINATOR;
uint256 foundationAmount = (amount * foundationFee) / TAX_DENOMINATOR;
uint256 transferAmount = amount - burnAmount - foundationAmount;
```

---

## Files in This Folder

| File | Lines | Description |
|------|-------|-------------|
| `AquariSim1.sol` | 839 | Baseline test |
| `AquariSim2.sol` | 839 | Wrong pair test |
| `AquariSim3.sol` | 839 | Wrong order test |
| `AquariSim4.sol` | 839 | High fees test |
| `AquariSim5.sol` | 839 | Final rehearsal |
| `FixedPointMathLib.sol` | 266 | Math library (dependency) |
| `README.md` | - | This file |

---

## Compiler Settings

Must match mainnet exactly:

```javascript
// hardhat.config.js
solidity: {
  version: "0.8.21",
  settings: {
    optimizer: {
      enabled: true,
      runs: 100
    }
  }
}
```

---

## Summary

These simulation contracts let you test ALL fee enablement scenarios safely before touching the real mainnet AQUARI token.

**The contracts are IDENTICAL to mainnet** - only name/symbol differ.

Anyone can verify by:
1. Comparing line counts (all 839 lines)
2. Running `diff` (only 3 lines differ)
3. Asking any AI to compare the logic

---

## Related Documentation

- [Fee Enablement Plan](../../docs/FEE_ENABLEMENT_PLAN.md) - Full project status, goals, edge cases
- [Mainnet README](../mainnet/README.md) - Verified mainnet contract details
