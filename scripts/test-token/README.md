# AquariTest - Base Mainnet Test Token

Deploy and test AquariTest (AQTEST) on Base mainnet to verify fee-on-transfer behavior.

## Quick Start

```bash
# 1. Deploy token
npx hardhat run scripts/test-token/1_deploy.js --network base

# 2. Add liquidity (0.01 ETH + 1M tokens)
npx hardhat run scripts/test-token/2_add_liquidity.js --network base

# 3. Verify state
npx hardhat run scripts/test-token/3_verify_state.js --network base

# 4. Configure fees (foundation wallet, pair, tax config)
npx hardhat run scripts/test-token/4_configure.js --network base
```

## Scripts

| Script | Description |
|--------|-------------|
| `1_deploy.js` | Deploy AquariTest as UUPS proxy |
| `2_add_liquidity.js` | Create Uniswap V2 pair, add 0.01 ETH + 1M tokens |
| `3_verify_state.js` | Verify contract state (READ ONLY) |
| `4_configure.js` | Set foundation wallet, pair, and tax config |

## Workflow

```
1_deploy.js          → Deploy AQTEST token
                        ↓
2_add_liquidity.js   → Create LP pair (0.01 ETH + 1M tokens)
                        ↓
3_verify_state.js    → Check state (optional)
                        ↓
[TEST ON UNISWAP UI] → Trade WITHOUT fees (pairIsSet=false)
                        ↓
4_configure.js       → Set foundation, pair, fees (IRREVERSIBLE!)
                        ↓
[TEST ON UNISWAP UI] → Trade WITH 2.5% fees (pairIsSet=true)
```

## Configuration

Edit `config.js` to change:

```javascript
const CONFIG = {
    liquidityETH: "0.01",           // ETH for LP
    liquidityTokens: "1000000",     // Tokens for LP
    newFoundationWallet: "0x802D8097eC1D49808F3c2c866020442891adde57",
    taxConfig: {
        burnTax: 125,        // 1.25%
        foundationFee: 125,  // 1.25%
    },
};
```

## State File

Contract addresses are saved to `state.json`:

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

## Testing Fee Behavior

### Before `4_configure.js` (fees inactive)

1. Go to [Uniswap](https://app.uniswap.org)
2. Select Base network
3. Import token: `<proxy address from state.json>`
4. Swap ETH → AQTEST or AQTEST → ETH
5. **Expected: 0% fee** (pairIsSet = false)

### After `4_configure.js` (fees active)

1. Run `4_configure.js` to enable fees
2. Trade on Uniswap
3. **Expected: 2.5% fee** (1.25% burn + 1.25% to foundation)

## Token Details

| Property | Value |
|----------|-------|
| Name | Aquari Test |
| Symbol | AQTEST |
| Decimals | 18 |
| Initial Supply | 100,000,000 |
| Contract | UUPS Upgradeable Proxy |

## Important Notes

- `setUniswapV2Pair()` is **IRREVERSIBLE** - cannot change pair after setting
- Test trades WITHOUT fees first to verify LP works
- Foundation wallet receives 1.25% of each trade
- 1.25% of each trade is burned (removed from supply)
- Owner is excluded from fees
