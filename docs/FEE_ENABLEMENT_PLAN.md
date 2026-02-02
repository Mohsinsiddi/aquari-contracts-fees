# AQUARI Fee Enablement Plan

## Goal (Simple)

Enable fees on mainnet AQUARI token. That's it.

### What We Need To Do

| Step | Action | Changeable Later? |
|------|--------|-------------------|
| 1 | Set burn tax: **1.25%** (125 bps) | ✅ YES - admin can change anytime |
| 2 | Set foundation fee: **1.25%** (125 bps) | ✅ YES - admin can change anytime |
| 3 | Set foundation wallet | ✅ YES - admin can change anytime |
| 4 | Set pair address (enables fees) | ❌ NO - **IRREVERSIBLE** |

### Key Point

**Only `setUniswapV2Pair()` is irreversible.** Everything else can be changed by admin later:
- `setTaxConfig(newBurnTax, newFoundationFee)` - change fees anytime
- `setFoundationWallet(newWallet)` - change wallet anytime

---

## Project Status

| Phase | Status |
|-------|--------|
| 1. Contract Verification | ✅ DONE |
| 2. Simulation Contracts | ✅ DONE |
| 3. Scripts Created | ✅ DONE |
| 4. Fork Testing | ⏳ PENDING |
| 5. Mainnet Execution | ⏳ PENDING |

---

## Mainnet Contract

| Item | Value |
|------|-------|
| **Token (Proxy)** | `0x7f0e9971d3320521fc88f863e173a4cddbb051ba` |
| **Implementation** | `0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05` |
| **Pair Address** | `0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F` |
| **Foundation Wallet** | `0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235` |
| **Network** | Base Mainnet (8453) |

### Current State

| Parameter | Value | After Enablement |
|-----------|-------|------------------|
| `pairIsSet` | false | **true** |
| `burnTax` | 0 | **125** (1.25%) |
| `foundationFee` | 900 | **125** (1.25%) |
| `foundationWallet` | 0x13B9...235 | (same or updated) |

---

## Admin Functions (Can Change Anytime)

```solidity
// Change tax rates (can call multiple times)
function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee) external onlyOwner;

// Change foundation wallet (can call multiple times)
function setFoundationWallet(address newWallet) external onlyOwner;

// Enable fees - ONE TIME ONLY, IRREVERSIBLE
function setUniswapV2Pair(address pairAddress) external onlyOwner;
```

### Examples

```javascript
// Set fees to 1.25% + 1.25%
await token.setTaxConfig(125, 125);

// Later, change to 2% + 2%
await token.setTaxConfig(200, 200);

// Later, remove burn, keep 3% foundation
await token.setTaxConfig(0, 300);

// Change foundation wallet
await token.setFoundationWallet("0xNEW_WALLET");
```

---

## Risk: Only One Thing Can Go Wrong

| Risk | Impact | How to Avoid |
|------|--------|--------------|
| **Wrong pair address** | Fees NEVER work | Triple-verify address from factory |

Everything else is changeable. If fees are wrong → change them. If wallet is wrong → change it.

**BUT** if pair address is wrong → cannot fix, would need new token.

---

## Simulation Tests

| Contract | Symbol | Test |
|----------|--------|------|
| AquariSim1 | AQSIM1 | Correct setup (baseline) |
| AquariSim2 | AQSIM2 | Wrong pair address |
| AquariSim3 | AQSIM3 | Pair before fees (order test) |
| AquariSim4 | AQSIM4 | High fees (50%) |
| AquariSim5 | AQSIM5 | Final rehearsal |

All contracts are **839 lines** - identical to mainnet, only name/symbol differs.

---

## Execution Steps (For Client)

### Step 1: Verify State
```javascript
// Check current state
const pairIsSet = await token.pairIsSet();      // Should be false
const owner = await token.owner();               // Should be your address
const pair = await factory.getPair(token, WETH); // Get correct pair
```

### Step 2: Configure (Can Change Later)
```javascript
// Set foundation wallet (if needed)
await token.setFoundationWallet("0xFOUNDATION_WALLET");

// Set tax rates: 1.25% burn + 1.25% foundation
await token.setTaxConfig(125, 125);
```

### Step 3: Enable Fees (IRREVERSIBLE)
```javascript
// ⚠️ VERIFY PAIR ADDRESS BEFORE CALLING
// This can only be called ONCE
await token.setUniswapV2Pair("0xPAIR_ADDRESS");
```

### Step 4: Verify
```javascript
const pairIsSet = await token.pairIsSet();  // Should be true
const burnTax = await token.burnTax();       // Should be 125
const foundFee = await token.foundationFee(); // Should be 125
```

---

## After Enablement: What Admin Can Do

| Action | Command | Notes |
|--------|---------|-------|
| Change burn tax | `setTaxConfig(newBurn, currentFound)` | Anytime |
| Change foundation fee | `setTaxConfig(currentBurn, newFound)` | Anytime |
| Remove all fees | `setTaxConfig(0, 0)` | Anytime |
| Set max fees (99%) | `setTaxConfig(5000, 4900)` | Max total is 10000 |
| Change foundation wallet | `setFoundationWallet(newWallet)` | Anytime |
| Disable trading | `setTradingEnabled(false)` | Anytime |
| Pause contract | `pause()` | Anytime |

---

## Contract Structure

```
contracts/
├── mainnet/           ← Verified source (839 lines)
│   ├── AquariProtocol.sol
│   ├── FixedPointMathLib.sol
│   └── README.md
│
└── simulation/        ← Test contracts (839 lines each)
    ├── AquariSim1.sol (AQSIM1)
    ├── AquariSim2.sol (AQSIM2)
    ├── AquariSim3.sol (AQSIM3)
    ├── AquariSim4.sol (AQSIM4)
    ├── AquariSim5.sol (AQSIM5)
    ├── FixedPointMathLib.sol
    └── README.md
```

---

## Summary

1. **Goal:** Enable 2.5% fee (1.25% burn + 1.25% foundation)
2. **Admin can change:** Tax rates, foundation wallet (anytime)
3. **Admin cannot change:** Pair address (one-time, irreversible)
4. **Only risk:** Setting wrong pair address

---

*Last Updated: February 2, 2026*
