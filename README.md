# AQUARI Token - Tax Configuration Scripts

## ⚠️ IMPORTANT SAFETY WARNINGS

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    🔐 ADMIN KEY SAFETY                                     ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   • NEVER share your admin private keys with anyone                        ║
║   • NEVER commit private keys to git or any repository                     ║
║   • ALWAYS double-check you are running the correct script                 ║
║   • ALWAYS verify contract addresses before running                        ║
║   • Scripts in /scripts/mainnet/ are for MAINNET - use with caution!       ║
║   • Other scripts in /scripts/ folder may exist - verify before running    ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## 📋 Contract Addresses

### TESTNET (AQUARIT) - For Testing
| Contract | Address |
|----------|---------|
| Token | `0x78D84c417bE56da7eA5694acAc5E85EE14E46138` |
| Pair | `0xcb02d34fBD34dC5af95bABb3AFE7bF23c376b6a7` |
| Foundation Wallet | `0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235` |

### MAINNET (AQUARI) - Production
| Contract | Address |
|----------|---------|
| Token | `0x7f0e9971d3320521fc88f863e173a4cddbb051ba` |
| Pair | `0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F` |
| Foundation Wallet | `[VERIFY BEFORE RUNNING]` |

### Base Chain Addresses (Same for both)
| Contract | Address |
|----------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| Uniswap V2 Router | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |
| Uniswap V2 Factory | `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6` |
| Universal Router V4 | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |

---

## 📁 Script Location

```
aquari-contracts/
├── scripts/
│   ├── mainnet/
│   │   └── 1_setPairAndFees.js    ← Set pair address & tax rates
│   └── [other scripts - VERIFY before running!]
```

⚠️ **WARNING:** Other scripts may exist in the `/scripts/` folder. Always verify you are running the correct script before using admin keys!

---

## 🔧 Setup

### 1. Environment Variables

Create a `.env` file in the project root:

```bash
# Admin wallet (Token Owner) - KEEP SAFE!
ONCHAINKEY=0x_YOUR_ADMIN_PRIVATE_KEY_HERE
```

### 2. Verify hardhat.config.js

Ensure your `hardhat.config.js` has the account:

```javascript
baseMainnet: {
  url: "https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY",
  accounts: [process.env.ONCHAINKEY],
  chainId: 8453,
},
```

---

## 📜 Script: Set Pair & Fees

**Location:** `scripts/mainnet/1_setPairAndFees.js`

**What it does:**
1. Sets tax configuration (burn tax + foundation fee)
2. Sets Uniswap V2 Pair address (enables taxes on swaps)

### Configuration (at top of script)

```javascript
const CONFIG = {
  // TESTNET (AQUARIT) - Current
  TOKEN: "0x78D84c417bE56da7eA5694acAc5E85EE14E46138",
  PAIR: "0xcb02d34fBD34dC5af95bABb3AFE7bF23c376b6a7",

  // MAINNET (AQUARI) - Uncomment for production
  // TOKEN: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
  // PAIR: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",
};

const TAX_CONFIG = {
  BURN_TAX_BPS: 125,           // 1.25%
  FOUNDATION_FEE_BPS: 125,     // 1.25%
  // Total Tax = 2.5%
};
```

### Run Command

```bash
# ⚠️ DOUBLE CHECK CONFIG BEFORE RUNNING!
npx hardhat run scripts/mainnet/1_setPairAndFees.js --network baseMainnet
```

---

## ✅ Expected Results

After running the script successfully:

```
✅ STEP 6: FINAL CONTRACT STATE
══════════════════════════════════════════════════════════════════════════════
Pair Is Set:        ✅ YES (TAXES NOW ACTIVE!)
Pair Address:       0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F
──────────────────────────────────────────────────────────────────────────────
Burn Tax:           125 bps (1.25%)
Foundation Fee:     125 bps (1.25%)
Total Tax:          250 bps (2.5%)
Foundation Wallet:  [Your Foundation Wallet]

╔════════════════════════════════════════════════════════════════════════════╗
║                    ✅ CONFIGURATION COMPLETE                               ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## 🔄 Switching from TESTNET to MAINNET

1. Open `scripts/mainnet/1_setPairAndFees.js`
2. Comment out TESTNET addresses
3. Uncomment MAINNET addresses:

```javascript
const CONFIG = {
  // TESTNET (AQUARIT) - Comment out for mainnet
  // TOKEN: "0x78D84c417bE56da7eA5694acAc5E85EE14E46138",
  // PAIR: "0xcb02d34fBD34dC5af95bABb3AFE7bF23c376b6a7",

  // MAINNET (AQUARI) - Uncomment for production
  TOKEN: "0x7f0e9971d3320521fc88f863e173a4cddbb051ba",
  PAIR: "0x30Ec7B2f5be26d03D20AC86554dAadD2b738CA0F",
};
```

4. Verify tax configuration is correct
5. Run the script

---

## ❓ Troubleshooting

### "Caller is not owner"
- Make sure `ONCHAINKEY` in `.env` is the token owner's private key

### "Insufficient ETH for gas"
- Send ETH to the admin wallet for gas fees

### "execution reverted"
- Verify contract addresses are correct
- Check if function exists on contract
- Ensure you have owner permissions

---

## 📞 Support

If you encounter issues:
1. Verify all addresses match your deployment
2. Check you're using the correct network
3. Ensure admin wallet has ETH for gas