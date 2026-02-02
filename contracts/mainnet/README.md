# AQUARI Mainnet Contract (Verified Source)

## Contract Addresses

| Contract | Address | Explorer |
|----------|---------|----------|
| **Proxy (AQUARI Token)** | `0x7f0e9971d3320521fc88f863e173a4cddbb051ba` | [BaseScan](https://basescan.org/token/0x7f0e9971d3320521fc88f863e173a4cddbb051ba) |
| **Implementation** | `0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05` | [BaseScan](https://basescan.org/address/0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05#code) |

## Network Details

| Field | Value |
|-------|-------|
| Network | Base Mainnet |
| Chain ID | 8453 |
| Token Name | Aquari |
| Token Symbol | AQUARI |
| Decimals | 18 |
| Total Supply | 100,000,000 AQUARI |

## Source Verification

This contract source was fetched from **Sourcify** (verified with "perfect" match status).

### How We Fetched This Source

```bash
# Check verification status
curl -s "https://sourcify.dev/server/check-all-by-addresses?addresses=0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05&chainIds=8453"

# Fetch source files
curl -s "https://sourcify.dev/server/files/8453/0x0bb57147519d8b997c7c6bca8ff3c0251f82fb05" | jq -r '.[] | select(.name == "AquariProtocol.sol") | .content'
```

### Verification Date
- Fetched: February 2, 2026
- Sourcify Status: `perfect` (exact bytecode match)

## Current Contract State (as of deployment)

| Parameter | Initial Value | Current Status |
|-----------|---------------|----------------|
| `burnTax` | 0 (0%) | Configurable by owner |
| `foundationFee` | 900 (9%) | Configurable by owner |
| `foundationWallet` | `0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235` | Configurable by owner |
| `tradingEnabled` | true | Trading is live |
| `pairIsSet` | **false** | FEES NOT YET ENABLED |

## Important: Fees Are NOT Enabled Yet

The mainnet AQUARI token has been trading for ~1 year **WITHOUT fees**.

To enable fees, the owner must call:
1. `setTaxConfig(burnTax, foundationFee)` - Set the tax rates
2. `setUniswapV2Pair(pairAddress)` - Enable fees (IRREVERSIBLE)

## Key Functions

### Owner Functions (for enabling fees)

```solidity
// Step 1: Set tax configuration
function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee) external onlyOwner;

// Step 2: Set pair address (ENABLES FEES - CAN ONLY BE CALLED ONCE)
function setUniswapV2Pair(address newPairAddress) external onlyOwner;

// Optional: Change foundation wallet
function setFoundationWallet(address newWallet) external onlyOwner;
```

### Tax Logic (in _update function)

Taxes only apply when ALL conditions are met:
1. `pairIsSet == true`
2. Transfer involves `uniswapV2Pair` (buy or sell)
3. Neither `from` nor `to` is in `_excludedAddresses`
4. Neither `from` nor `to` has `isExcludedFromTax[address] == true`

## Compiler Settings

| Setting | Value |
|---------|-------|
| Solidity Version | 0.8.21 |
| Optimizer | Enabled |
| Runs | 100 |
| EVM Version | Default (Paris) |

## Dependencies

- OpenZeppelin Contracts Upgradeable v5.1.0
- FixedPointMathLib (Solmate)

## Files in This Folder

| File | Description |
|------|-------------|
| `AquariProtocol.sol` | Main token contract (verified source) |
| `FixedPointMathLib.sol` | Math utility library |
| `README.md` | This documentation |

---

**IMPORTANT**: Compare this contract with simulation contracts. The logic is IDENTICAL - only `name` and `symbol` differ in the `initialize()` function.

---

## Related Documentation

- [Fee Enablement Plan](../../docs/FEE_ENABLEMENT_PLAN.md) - Full project status, goals, edge cases
- [Simulation README](../simulation/README.md) - Test scenarios and verification
