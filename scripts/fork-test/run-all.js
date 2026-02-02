/**
 * =============================================================================
 * AQUARI Fork Test - Comprehensive Automated Test Suite
 * =============================================================================
 *
 * Full coverage AUTOMATED testing for fee enablement:
 * - Pre-flight checks
 * - Security validations
 * - Multiple fee scenarios
 * - Edge cases
 * - Gas tracking
 *
 * MODES:
 *   --mainnet              Test against REAL AQUARI contract on fork (requires owner key)
 *   --mainnet --new-token  Deploy fresh token, YOU become owner, test full admin flow
 *   --simulate             Deploy FRESH test contract for isolated edge case testing
 *
 * Usage:
 *   npx hardhat run scripts/fork-test/run-all.js --network fork -- --mainnet
 *   npx hardhat run scripts/fork-test/run-all.js --network fork -- --mainnet --new-token
 *   npx hardhat run scripts/fork-test/run-all.js --network fork -- --simulate
 *
 * NOTE: This is AUTOMATED testing. For manual UI testing, use:
 *   scripts/simulation/ - Step-by-step scripts + Uniswap UI
 *
 * =============================================================================
 */

const { ethers } = require("hardhat");
const { setupContext } = require("./lib/mode");
const { TestReport } = require("./lib/report");
const { SCENARIOS, TARGET_FEES, TEST_PARAMS, TESTS, BASE, ABIS } = require("./config");
const {
    assertReverts,
    assertFeeAccuracy,
    formatTokens,
    calcPercentage,
} = require("./lib/assertions");
const { saveState } = require("./lib/state");
const {
    getUniversalRouter,
    buyTokensWithETH,
    sellFeeTokensForETH,
    setupPermit2ForSell,
    PERMIT2_ADDRESS,
} = require("../utils/universalRouter");

// Helper to get gas used from transaction
async function getGasUsed(tx) {
    const receipt = await tx.wait();
    return Number(receipt.gasUsed);
}

async function main() {
    console.log("");
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + "AQUARI FEE ENABLEMENT - AUTOMATED FORK TEST".padStart(61).padEnd(78) + "║");
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("");

    // Setup context (handles mainnet vs simulate)
    const ctx = await setupContext();
    const report = new TestReport(ctx.mode, ctx);

    // Get trader signer (Account #1 - NOT excluded from fees)
    const signers = await ethers.getSigners();
    const trader = signers[1];
    const traderAddress = await trader.getAddress();
    // Use V4 Universal Router for swaps (same as Uniswap UI)
    const traderUniversalRouter = getUniversalRouter(trader);
    const traderToken = new ethers.Contract(ctx.tokenAddress, ABIS.token, trader);
    // Keep V2 Router for legacy test (T09 - regular swap should fail)
    const traderV2Router = new ethers.Contract(BASE.uniswapV2Router, ABIS.router, trader);

    console.log(`Owner:  ${ctx.signerAddress} (excluded from fees)`);
    console.log(`Trader: ${traderAddress} (NOT excluded - used for fee tests)`);

    // Get block number
    const blockNumber = await ethers.provider.getBlockNumber();
    report.setBlockNumber(blockNumber);

    // Display mode banner
    console.log("");
    if (ctx.mode === "mainnet") {
        console.log("╔" + "═".repeat(78) + "╗");
        console.log("║" + "MODE: MAINNET TEST".padStart(48).padEnd(78) + "║");
        console.log("║" + "Testing against REAL AQUARI contract on Base fork".padStart(63).padEnd(78) + "║");
        console.log("║" + "All transactions are simulated (not real mainnet)".padStart(63).padEnd(78) + "║");
        console.log("╚" + "═".repeat(78) + "╝");
    } else {
        console.log("╔" + "═".repeat(78) + "╗");
        console.log("║" + "MODE: ISOLATED SIMULATION".padStart(52).padEnd(78) + "║");
        console.log("║" + "Fresh test contract deployed for isolated testing".padStart(63).padEnd(78) + "║");
        console.log("║" + "No interaction with real AQUARI contract".padStart(59).padEnd(78) + "║");
        console.log("╚" + "═".repeat(78) + "╝");
    }

    console.log("");
    console.log("─".repeat(80));
    console.log(`Block Number: ${blockNumber}`);
    console.log("─".repeat(80));
    console.log("");

    // =========================================================================
    // PRE-FLIGHT CHECKS
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("PRE-FLIGHT CHECKS");
    console.log("═".repeat(80) + "\n");

    // PF01: Fork is running (if we got here, it is)
    report.pass(TESTS.PF01.id, TESTS.PF01.name, {
        "Block": blockNumber.toString(),
    });

    // PF02: Network is Base fork
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (Number(chainId) === BASE.chainId) {
        report.pass(TESTS.PF02.id, TESTS.PF02.name, {
            "Chain ID": chainId.toString(),
            "Expected": BASE.chainId.toString(),
        });
    } else {
        report.fail(TESTS.PF02.id, TESTS.PF02.name, "Wrong network", {
            "Chain ID": chainId.toString(),
            "Expected": BASE.chainId.toString(),
        });
    }

    // PF03: Signer has sufficient ETH
    const ethBalance = await ethers.provider.getBalance(ctx.signerAddress);
    const minBalance = ethers.parseEther(TEST_PARAMS.minEthBalance);
    if (ethBalance >= minBalance) {
        report.pass(TESTS.PF03.id, TESTS.PF03.name, {
            "Balance": `${ethers.formatEther(ethBalance)} ETH`,
            "Minimum": `${TEST_PARAMS.minEthBalance} ETH`,
        });
    } else {
        report.fail(TESTS.PF03.id, TESTS.PF03.name, "Insufficient ETH", {
            "Balance": `${ethers.formatEther(ethBalance)} ETH`,
            "Minimum": `${TEST_PARAMS.minEthBalance} ETH`,
        });
    }

    // PF04: Contract is not paused
    try {
        const isPaused = await ctx.token.paused();
        if (!isPaused) {
            report.pass(TESTS.PF04.id, TESTS.PF04.name, { "paused()": "false" });
        } else {
            report.fail(TESTS.PF04.id, TESTS.PF04.name, "Contract is paused");
            report.addWarning("Contract is paused - transfers will fail");
        }
    } catch (e) {
        report.skip(TESTS.PF04.id, TESTS.PF04.name, "paused() not available");
    }

    // PF05: Trading is enabled
    try {
        const tradingEnabled = await ctx.token.tradingEnabled();
        if (tradingEnabled) {
            report.pass(TESTS.PF05.id, TESTS.PF05.name, { "tradingEnabled()": "true" });
        } else {
            report.fail(TESTS.PF05.id, TESTS.PF05.name, "Trading is disabled");
            report.addWarning("Trading is disabled - swaps may fail");
        }
    } catch (e) {
        report.skip(TESTS.PF05.id, TESTS.PF05.name, "tradingEnabled() not available");
    }

    // =========================================================================
    // OWNER & ACCESS CONTROL
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("OWNER & ACCESS CONTROL");
    console.log("═".repeat(80) + "\n");

    // T01: Owner validation
    if (ctx.isOwner) {
        report.pass(TESTS.T01.id, TESTS.T01.name, {
            "Contract Owner": ctx.ownerAddress,
            "Signer": ctx.signerAddress,
        });
    } else {
        report.fail(TESTS.T01.id, TESTS.T01.name, "Signer is not owner", {
            "Contract Owner": ctx.ownerAddress,
            "Signer": ctx.signerAddress,
        });

        if (ctx.mode === "mainnet") {
            console.log("\nCRITICAL: Cannot proceed without owner access in mainnet mode.");
            report.print();
            process.exit(1);
        }
    }

    // T02: pairIsSet is false initially
    const initialPairIsSet = await ctx.token.pairIsSet();
    if (!initialPairIsSet) {
        report.pass(TESTS.T02.id, TESTS.T02.name, {
            "pairIsSet": "false",
        });
    } else {
        report.skip(TESTS.T02.id, TESTS.T02.name, "pairIsSet already true - fees already enabled");
        report.addWarning("Fees already enabled - some tests will be skipped");
    }

    // T03: Pair address verification
    const factoryPair = await ctx.factory.getPair(ctx.tokenAddress, BASE.weth);
    if (factoryPair !== ethers.ZeroAddress) {
        if (ctx.pairAddress && factoryPair.toLowerCase() === ctx.pairAddress.toLowerCase()) {
            report.pass(TESTS.T03.id, TESTS.T03.name, {
                "Factory Pair": factoryPair,
                "Config Pair": ctx.pairAddress,
            });
        } else {
            report.addWarning(`Pair mismatch: Factory=${factoryPair}, Config=${ctx.pairAddress}`);
            report.pass(TESTS.T03.id, TESTS.T03.name, {
                "Factory Pair": factoryPair,
                "Note": "Using factory pair",
            });
        }
    } else {
        report.fail(TESTS.T03.id, TESTS.T03.name, "No pair exists in factory");
    }

    // =========================================================================
    // SECURITY VALIDATIONS (Non-owner access)
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("SECURITY VALIDATIONS");
    console.log("═".repeat(80) + "\n");

    // Create a random non-owner signer for security tests
    const nonOwnerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    const tokenAsNonOwner = new ethers.Contract(ctx.tokenAddress, ABIS.token, nonOwnerWallet);

    // S01: Non-owner cannot setTaxConfig
    try {
        await assertReverts(
            () => tokenAsNonOwner.setTaxConfig(100, 100),
            null,
            "setTaxConfig should revert for non-owner"
        );
        report.pass(TESTS.S01.id, TESTS.S01.name, {
            "Result": "Reverted as expected",
        });
    } catch (e) {
        report.fail(TESTS.S01.id, TESTS.S01.name, "Non-owner was able to call setTaxConfig");
    }

    // S02: Non-owner cannot setUniswapV2Pair
    try {
        await assertReverts(
            () => tokenAsNonOwner.setUniswapV2Pair(factoryPair),
            null,
            "setUniswapV2Pair should revert for non-owner"
        );
        report.pass(TESTS.S02.id, TESTS.S02.name, {
            "Result": "Reverted as expected",
        });
    } catch (e) {
        report.fail(TESTS.S02.id, TESTS.S02.name, "Non-owner was able to call setUniswapV2Pair");
    }

    // S03: Non-owner cannot setFoundationWallet
    try {
        await assertReverts(
            () => tokenAsNonOwner.setFoundationWallet(nonOwnerWallet.address),
            null,
            "setFoundationWallet should revert for non-owner"
        );
        report.pass(TESTS.S03.id, TESTS.S03.name, {
            "Result": "Reverted as expected",
        });
    } catch (e) {
        report.fail(TESTS.S03.id, TESTS.S03.name, "Non-owner was able to call setFoundationWallet");
    }

    // =========================================================================
    // FEE CONFIGURATION
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("FEE CONFIGURATION");
    console.log("═".repeat(80) + "\n");

    const beforeBurnTax = await ctx.token.burnTax();
    const beforeFoundationFee = await ctx.token.foundationFee();

    console.log(`Current: burnTax=${beforeBurnTax}, foundationFee=${beforeFoundationFee}`);
    console.log(`Target:  burnTax=${TARGET_FEES.burnTax}, foundationFee=${TARGET_FEES.foundationFee}`);
    console.log("");

    // T04: setTaxConfig
    let setTaxConfigGas = 0;
    try {
        const tx = await ctx.token.setTaxConfig(TARGET_FEES.burnTax, TARGET_FEES.foundationFee);
        setTaxConfigGas = await getGasUsed(tx);

        const newBurnTax = await ctx.token.burnTax();
        const newFoundationFee = await ctx.token.foundationFee();

        if (Number(newBurnTax) === TARGET_FEES.burnTax && Number(newFoundationFee) === TARGET_FEES.foundationFee) {
            report.pass(TESTS.T04.id, TESTS.T04.name, {
                "burnTax": `${beforeBurnTax} -> ${newBurnTax}`,
                "foundationFee": `${beforeFoundationFee} -> ${newFoundationFee}`,
                "Total": `${Number(newBurnTax) + Number(newFoundationFee)} bps (${(Number(newBurnTax) + Number(newFoundationFee))/100}%)`,
            }, setTaxConfigGas);
        } else {
            throw new Error("Tax values don't match expected");
        }
    } catch (e) {
        report.fail(TESTS.T04.id, TESTS.T04.name, e.message);
    }

    // G01: Gas for setTaxConfig
    if (setTaxConfigGas > 0) {
        report.info(TESTS.G01.id, TESTS.G01.name, {
            "Gas Used": setTaxConfigGas.toLocaleString(),
        });
    }

    // =========================================================================
    // FEE ENABLEMENT
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("FEE ENABLEMENT");
    console.log("═".repeat(80) + "\n");

    const pairToSet = factoryPair !== ethers.ZeroAddress ? factoryPair : ctx.pairAddress;
    let setUniswapV2PairGas = 0;

    if (!initialPairIsSet && pairToSet && pairToSet !== ethers.ZeroAddress) {
        // T05: setUniswapV2Pair
        try {
            console.log(`Setting pair address: ${pairToSet}`);
            const tx = await ctx.token.setUniswapV2Pair(pairToSet);
            setUniswapV2PairGas = await getGasUsed(tx);

            const newPairIsSet = await ctx.token.pairIsSet();
            const storedPair = await ctx.token.uniswapV2Pair();

            if (newPairIsSet && storedPair.toLowerCase() === pairToSet.toLowerCase()) {
                report.pass(TESTS.T05.id, TESTS.T05.name, {
                    "pairIsSet": "true",
                    "uniswapV2Pair": storedPair,
                }, setUniswapV2PairGas);

                if (ctx.mode === "simulate") {
                    saveState({ feesEnabled: true });
                }
            } else {
                throw new Error("Pair not set correctly");
            }

            // T05b: Second call should revert
            console.log("Testing second call (should revert)...");
            try {
                const tx2 = await ctx.token.setUniswapV2Pair(pairToSet);
                await tx2.wait();
                // If we get here, it didn't revert
                report.fail(TESTS.T05b.id, TESTS.T05b.name, "Second call did not revert");
            } catch (e) {
                // Expected - it should revert
                report.pass(TESTS.T05b.id, TESTS.T05b.name, {
                    "Error": "Reverted as expected",
                });
            }
        } catch (e) {
            if (e.message.includes("PairAlreadySet")) {
                report.skip(TESTS.T05.id, TESTS.T05.name, "Pair already set");
            } else {
                report.fail(TESTS.T05.id, TESTS.T05.name, e.message);
            }
        }
    } else if (initialPairIsSet) {
        report.skip(TESTS.T05.id, TESTS.T05.name, "Pair already set");

        // Test that second call reverts
        try {
            await assertReverts(
                () => ctx.token.setUniswapV2Pair(pairToSet || ctx.signerAddress),
                "PairAlreadySet"
            );
            report.pass(TESTS.T05b.id, TESTS.T05b.name, {
                "Error": "PairAlreadySet (as expected)",
            });
        } catch (e) {
            report.fail(TESTS.T05b.id, TESTS.T05b.name, "Did not revert as expected");
        }
    }

    // G02: Gas for setUniswapV2Pair
    if (setUniswapV2PairGas > 0) {
        report.info(TESTS.G02.id, TESTS.G02.name, {
            "Gas Used": setUniswapV2PairGas.toLocaleString(),
        });
    }

    // =========================================================================
    // TRADING TESTS
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("TRADING TESTS");
    console.log("═".repeat(80) + "\n");

    const foundationWallet = await ctx.token.foundationWallet();
    const buyAmount = ethers.parseEther(TEST_PARAMS.buyAmount);

    // Use trader (Account #1) for fee tests - owner is excluded from fees
    console.log(`Using trader ${traderAddress} for buy/sell tests (not excluded from fees)`);
    console.log("");

    // Balances before buy
    const buyerBefore = await ctx.token.balanceOf(traderAddress);
    const foundationBefore = await ctx.token.balanceOf(foundationWallet);
    const totalSupplyBefore = await ctx.token.totalSupply();

    console.log(`Buying with ${TEST_PARAMS.buyAmount} ETH via V4 Universal Router...`);

    let buyGas = 0;
    let tokensReceived = 0n;
    let foundationReceived = 0n;
    let tokensBurned = 0n;

    try {
        const deadline = Math.floor(Date.now() / 1000) + 1200;

        // Use V4 Universal Router for buy (same as Uniswap UI)
        const tx = await buyTokensWithETH(
            traderUniversalRouter,
            ctx.tokenAddress,
            BASE.weth,
            traderAddress,
            buyAmount,
            0n,  // amountOutMin
            deadline
        );
        buyGas = await getGasUsed(tx);

        // Balances after buy
        const buyerAfter = await ctx.token.balanceOf(traderAddress);
        const foundationAfter = await ctx.token.balanceOf(foundationWallet);
        const totalSupplyAfter = await ctx.token.totalSupply();

        tokensReceived = buyerAfter - buyerBefore;
        foundationReceived = foundationAfter - foundationBefore;
        tokensBurned = totalSupplyBefore - totalSupplyAfter;
        const totalFees = foundationReceived + tokensBurned;
        const grossTokens = tokensReceived + totalFees;

        // T06: Buy applies fees
        if (TARGET_FEES.total > 0) {
            if (foundationReceived > 0n || tokensBurned > 0n) {
                report.pass(TESTS.T06.id, TESTS.T06.name, {
                    "ETH spent": `${TEST_PARAMS.buyAmount} ETH`,
                    "Gross tokens": formatTokens(grossTokens),
                    "Tokens received": `${formatTokens(tokensReceived)} (${calcPercentage(tokensReceived, grossTokens)}%)`,
                    "Foundation": `${formatTokens(foundationReceived)} (${calcPercentage(foundationReceived, grossTokens)}%)`,
                    "Burned": `${formatTokens(tokensBurned)} (${calcPercentage(tokensBurned, grossTokens)}%)`,
                }, buyGas);

                // T08: Fee accuracy (buy)
                try {
                    const accuracy = assertFeeAccuracy(totalFees, grossTokens, TARGET_FEES.total, TEST_PARAMS.feeTolerance);
                    report.pass(TESTS.T08.id, TESTS.T08.name, {
                        "Expected": `${TARGET_FEES.total/100}%`,
                        "Actual": `${(accuracy.actualBps/100).toFixed(2)}%`,
                        "Diff": `${accuracy.diff} bps`,
                    });
                } catch (e) {
                    report.fail(TESTS.T08.id, TESTS.T08.name, e.message);
                }
            } else {
                report.fail(TESTS.T06.id, TESTS.T06.name, "No fees collected", {
                    "Foundation": formatTokens(foundationReceived),
                    "Burned": formatTokens(tokensBurned),
                });
            }
        } else {
            // Zero fee scenario - should receive full amount
            if (foundationReceived === 0n && tokensBurned === 0n) {
                report.pass(TESTS.T06.id, TESTS.T06.name + " (zero fees)", {
                    "Tokens received": formatTokens(tokensReceived),
                    "Foundation": "0 (expected)",
                    "Burned": "0 (expected)",
                }, buyGas);
            } else {
                report.fail(TESTS.T06.id, TESTS.T06.name, "Fees applied when should be zero");
            }
        }

        // G03: Gas for buy
        report.info(TESTS.G03.id, TESTS.G03.name, {
            "Gas Used": buyGas.toLocaleString(),
        });

    } catch (e) {
        report.fail(TESTS.T06.id, TESTS.T06.name, e.message);
    }

    // =========================================================================
    // SELL TEST
    // =========================================================================
    console.log("\n" + "─".repeat(80));
    console.log("SELL TEST");
    console.log("─".repeat(80) + "\n");

    const sellAmount = ethers.parseEther(TEST_PARAMS.sellAmount);
    const currentBalance = await ctx.token.balanceOf(traderAddress);

    if (currentBalance >= sellAmount) {
        // Setup Permit2 approvals for V4 Universal Router sell
        console.log("Setting up Permit2 approvals for sell via V4 Universal Router...");
        await setupPermit2ForSell(traderToken, ctx.tokenAddress, trader);

        // Also approve V2 Router for the legacy test (T09)
        await (await traderToken.approve(BASE.uniswapV2Router, sellAmount)).wait();

        const path = [ctx.tokenAddress, BASE.weth];
        const deadline = Math.floor(Date.now() / 1000) + 1200;

        // T09: Regular V2 swap should fail (for fee-on-transfer tokens)
        if (TARGET_FEES.total > 0) {
            console.log("Testing regular V2 swapExactTokensForETH (should fail)...");
            try {
                await assertReverts(
                    () => traderV2Router.swapExactTokensForETH(sellAmount, 0, path, traderAddress, deadline)
                );
                report.pass(TESTS.T09.id, TESTS.T09.name, {
                    "Result": "Reverted as expected (K invariant)",
                });
            } catch (e) {
                report.fail(TESTS.T09.id, TESTS.T09.name, "Regular swap succeeded (unexpected for fee token)");
            }
        } else {
            report.skip(TESTS.T09.id, TESTS.T09.name, "Zero fees - regular swap should work");
        }

        // T07: Sell via V4 Universal Router
        console.log("Testing sell via V4 Universal Router...");

        const sellerBefore = await ctx.token.balanceOf(traderAddress);
        const foundationBeforeSell = await ctx.token.balanceOf(foundationWallet);
        const totalSupplyBeforeSell = await ctx.token.totalSupply();

        let sellGas = 0;
        try {
            // Use V4 Universal Router for sell (same as Uniswap UI)
            const tx = await sellFeeTokensForETH(
                traderUniversalRouter,
                ctx.tokenAddress,
                BASE.weth,
                traderAddress,
                sellAmount,
                0n,  // amountOutMin
                deadline
            );
            sellGas = await getGasUsed(tx);

            const sellerAfter = await ctx.token.balanceOf(traderAddress);
            const foundationAfterSell = await ctx.token.balanceOf(foundationWallet);
            const totalSupplyAfterSell = await ctx.token.totalSupply();

            const tokensSold = sellerBefore - sellerAfter;
            const foundationReceivedSell = foundationAfterSell - foundationBeforeSell;
            const burnedSell = totalSupplyBeforeSell - totalSupplyAfterSell;
            const totalFeesSell = foundationReceivedSell + burnedSell;

            if (TARGET_FEES.total > 0) {
                if (foundationReceivedSell > 0n || burnedSell > 0n) {
                    report.pass(TESTS.T07.id, TESTS.T07.name, {
                        "Tokens sold": formatTokens(tokensSold),
                        "Foundation": `${formatTokens(foundationReceivedSell)} (${calcPercentage(foundationReceivedSell, tokensSold)}%)`,
                        "Burned": `${formatTokens(burnedSell)} (${calcPercentage(burnedSell, tokensSold)}%)`,
                    }, sellGas);

                    // T08b: Fee accuracy (sell)
                    try {
                        const accuracy = assertFeeAccuracy(totalFeesSell, tokensSold, TARGET_FEES.total, TEST_PARAMS.feeTolerance);
                        report.pass(TESTS.T08b.id, TESTS.T08b.name, {
                            "Expected": `${TARGET_FEES.total/100}%`,
                            "Actual": `${(accuracy.actualBps/100).toFixed(2)}%`,
                            "Diff": `${accuracy.diff} bps`,
                        });
                    } catch (e) {
                        report.fail(TESTS.T08b.id, TESTS.T08b.name, e.message);
                    }
                } else {
                    report.fail(TESTS.T07.id, TESTS.T07.name, "No fees collected on sell");
                }
            } else {
                // Zero fee scenario
                report.pass(TESTS.T07.id, TESTS.T07.name + " (zero fees)", {
                    "Tokens sold": formatTokens(tokensSold),
                    "Foundation": "0 (expected)",
                    "Burned": "0 (expected)",
                }, sellGas);
            }

            // G04: Gas for sell
            report.info(TESTS.G04.id, TESTS.G04.name, {
                "Gas Used": sellGas.toLocaleString(),
            });

        } catch (e) {
            report.fail(TESTS.T07.id, TESTS.T07.name, e.message);
        }
    } else {
        report.skip(TESTS.T07.id, TESTS.T07.name, "Insufficient balance");
        report.skip(TESTS.T09.id, TESTS.T09.name, "Insufficient balance");
    }

    // =========================================================================
    // STATE VERIFICATION
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("STATE VERIFICATION");
    console.log("═".repeat(80) + "\n");

    // T10: Total supply decreased
    const finalTotalSupply = await ctx.token.totalSupply();
    if (TARGET_FEES.burnTax > 0) {
        if (finalTotalSupply < totalSupplyBefore) {
            report.pass(TESTS.T10.id, TESTS.T10.name, {
                "Before": formatTokens(totalSupplyBefore),
                "After": formatTokens(finalTotalSupply),
                "Burned": formatTokens(totalSupplyBefore - finalTotalSupply),
            });
        } else {
            report.fail(TESTS.T10.id, TESTS.T10.name, "Total supply did not decrease");
        }
    } else {
        if (finalTotalSupply === totalSupplyBefore) {
            report.pass(TESTS.T10.id, TESTS.T10.name + " (no burn)", {
                "Note": "burnTax is 0, supply unchanged as expected",
            });
        } else {
            report.fail(TESTS.T10.id, TESTS.T10.name, "Supply changed when burnTax is 0");
        }
    }

    // T11: Foundation received tokens
    const finalFoundationBalance = await ctx.token.balanceOf(foundationWallet);
    if (TARGET_FEES.foundationFee > 0) {
        if (finalFoundationBalance > foundationBefore) {
            report.pass(TESTS.T11.id, TESTS.T11.name, {
                "Before": formatTokens(foundationBefore),
                "After": formatTokens(finalFoundationBalance),
                "Received": formatTokens(finalFoundationBalance - foundationBefore),
            });
        } else {
            report.fail(TESTS.T11.id, TESTS.T11.name, "Foundation balance did not increase");
        }
    } else {
        if (finalFoundationBalance === foundationBefore) {
            report.pass(TESTS.T11.id, TESTS.T11.name + " (no foundation fee)", {
                "Note": "foundationFee is 0, balance unchanged as expected",
            });
        } else {
            report.fail(TESTS.T11.id, TESTS.T11.name, "Foundation received tokens when fee is 0");
        }
    }

    // =========================================================================
    // EXCLUSION TESTS
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("EXCLUSION TESTS");
    console.log("═".repeat(80) + "\n");

    // T13: Owner transfer skips fees (owner is in _excludedAddresses)
    try {
        const transferAmount = ethers.parseEther("100");
        const ownerBalance = await ctx.token.balanceOf(ctx.signerAddress);

        if (ownerBalance >= transferAmount) {
            const supplyBefore = await ctx.token.totalSupply();
            const foundationBefore2 = await ctx.token.balanceOf(foundationWallet);

            // Create a random recipient
            const recipient = ethers.Wallet.createRandom().address;

            const tx = await ctx.token.transfer(recipient, transferAmount);
            await tx.wait();

            const supplyAfter = await ctx.token.totalSupply();
            const foundationAfter2 = await ctx.token.balanceOf(foundationWallet);
            const recipientBalance = await ctx.token.balanceOf(recipient);

            // Owner transfers should not trigger fees (owner is excluded)
            const supplyChanged = supplyAfter !== supplyBefore;
            const foundationChanged = foundationAfter2 !== foundationBefore2;
            const receivedFull = recipientBalance === transferAmount;

            if (!supplyChanged && !foundationChanged && receivedFull) {
                report.pass(TESTS.T13.id, TESTS.T13.name, {
                    "Transferred": formatTokens(transferAmount),
                    "Received": formatTokens(recipientBalance),
                    "Fees applied": "No (owner excluded)",
                });
            } else {
                report.fail(TESTS.T13.id, TESTS.T13.name, "Fees applied to owner transfer", {
                    "Supply changed": supplyChanged.toString(),
                    "Foundation changed": foundationChanged.toString(),
                });
            }
        } else {
            report.skip(TESTS.T13.id, TESTS.T13.name, "Insufficient balance");
        }
    } catch (e) {
        report.fail(TESTS.T13.id, TESTS.T13.name, e.message);
    }

    // =========================================================================
    // ADMIN FUNCTIONS (After fees enabled)
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("ADMIN FUNCTIONS (Post-Enable)");
    console.log("═".repeat(80) + "\n");

    // A01: Can change tax config after enable
    try {
        const currentPairIsSet = await ctx.token.pairIsSet();
        if (currentPairIsSet) {
            // Change to different values
            const newBurn = TARGET_FEES.burnTax + 10;
            const newFound = TARGET_FEES.foundationFee + 10;

            const tx = await ctx.token.setTaxConfig(newBurn, newFound);
            await tx.wait();

            const updatedBurn = await ctx.token.burnTax();
            const updatedFound = await ctx.token.foundationFee();

            if (Number(updatedBurn) === newBurn && Number(updatedFound) === newFound) {
                report.pass(TESTS.A01.id, TESTS.A01.name, {
                    "New burnTax": updatedBurn.toString(),
                    "New foundationFee": updatedFound.toString(),
                });

                // Restore original values
                await (await ctx.token.setTaxConfig(TARGET_FEES.burnTax, TARGET_FEES.foundationFee)).wait();
            } else {
                throw new Error("Values did not update");
            }
        } else {
            report.skip(TESTS.A01.id, TESTS.A01.name, "Fees not enabled yet");
        }
    } catch (e) {
        report.fail(TESTS.A01.id, TESTS.A01.name, e.message);
    }

    // A02: Can change foundation wallet after enable
    try {
        const currentPairIsSet = await ctx.token.pairIsSet();
        if (currentPairIsSet) {
            const currentFoundation = await ctx.token.foundationWallet();
            const newFoundation = ethers.Wallet.createRandom().address;

            const tx = await ctx.token.setFoundationWallet(newFoundation);
            await tx.wait();

            const updatedFoundation = await ctx.token.foundationWallet();

            if (updatedFoundation.toLowerCase() === newFoundation.toLowerCase()) {
                report.pass(TESTS.A02.id, TESTS.A02.name, {
                    "Old": currentFoundation,
                    "New": updatedFoundation,
                });

                // Restore original
                await (await ctx.token.setFoundationWallet(currentFoundation)).wait();
            } else {
                throw new Error("Foundation wallet did not update");
            }
        } else {
            report.skip(TESTS.A02.id, TESTS.A02.name, "Fees not enabled yet");
        }
    } catch (e) {
        report.fail(TESTS.A02.id, TESTS.A02.name, e.message);
    }

    // =========================================================================
    // EDGE CASE SCENARIOS
    // =========================================================================
    console.log("\n" + "═".repeat(80));
    console.log("EDGE CASE SCENARIOS");
    console.log("═".repeat(80) + "\n");

    // Test zero fee scenario (uses owner - excluded from fees anyway, but tests zero config)
    console.log("Testing Zero Fee Scenario...");
    try {
        // Set fees to 0
        await (await ctx.token.setTaxConfig(0, 0)).wait();

        const zeroFeeBuyAmount = ethers.parseEther("0.0001");
        const balBefore = await ctx.token.balanceOf(ctx.signerAddress);
        const supplyBefore = await ctx.token.totalSupply();
        const foundBefore = await ctx.token.balanceOf(foundationWallet);

        const deadline = Math.floor(Date.now() / 1000) + 1200;
        const ownerUniversalRouter = getUniversalRouter(ctx.signer);

        // Use V4 Universal Router for buy
        await (await buyTokensWithETH(
            ownerUniversalRouter,
            ctx.tokenAddress,
            BASE.weth,
            ctx.signerAddress,
            zeroFeeBuyAmount,
            0n,
            deadline
        )).wait();

        const balAfter = await ctx.token.balanceOf(ctx.signerAddress);
        const supplyAfter = await ctx.token.totalSupply();
        const foundAfter = await ctx.token.balanceOf(foundationWallet);

        const supplyUnchanged = supplyAfter === supplyBefore;
        const foundUnchanged = foundAfter === foundBefore;

        if (supplyUnchanged && foundUnchanged) {
            report.pass(TESTS.E01.id, TESTS.E01.name, {
                "Supply": "Unchanged (no burn)",
                "Foundation": "Unchanged (no fee)",
            });
            report.pass(TESTS.E02.id, TESTS.E02.name, {
                "Tokens received": formatTokens(balAfter - balBefore),
            });
            report.addScenarioResult("Zero Fees", true, "No taxes applied when both are 0");
        } else {
            report.fail(TESTS.E01.id, TESTS.E01.name, "Fees applied when should be zero");
            report.addScenarioResult("Zero Fees", false, "Unexpected fees applied");
        }

        // Restore original fees
        await (await ctx.token.setTaxConfig(TARGET_FEES.burnTax, TARGET_FEES.foundationFee)).wait();

    } catch (e) {
        report.fail(TESTS.E01.id, TESTS.E01.name, e.message);
    }

    // Test high fee scenario (using trader - not excluded from fees)
    console.log("\nTesting High Fee Scenario (10%)...");
    try {
        const highFees = SCENARIOS.high;
        await (await ctx.token.setTaxConfig(highFees.burnTax, highFees.foundationFee)).wait();

        const highFeeBuyAmount = ethers.parseEther("0.0001");
        const balBefore = await ctx.token.balanceOf(traderAddress);
        const supplyBefore = await ctx.token.totalSupply();
        const foundBefore = await ctx.token.balanceOf(foundationWallet);

        const deadline = Math.floor(Date.now() / 1000) + 1200;

        // Use V4 Universal Router for buy
        await (await buyTokensWithETH(
            traderUniversalRouter,
            ctx.tokenAddress,
            BASE.weth,
            traderAddress,
            highFeeBuyAmount,
            0n,
            deadline
        )).wait();

        const balAfter = await ctx.token.balanceOf(traderAddress);
        const supplyAfter = await ctx.token.totalSupply();
        const foundAfter = await ctx.token.balanceOf(foundationWallet);

        const received = balAfter - balBefore;
        const burned = supplyBefore - supplyAfter;
        const foundReceived = foundAfter - foundBefore;
        const totalFee = burned + foundReceived;
        const gross = received + totalFee;

        const actualFeeBps = Number((totalFee * 10000n) / gross);

        if (Math.abs(actualFeeBps - highFees.total) <= 10) {
            report.pass(TESTS.E03.id, TESTS.E03.name, {
                "Expected": `${highFees.total/100}%`,
                "Actual": `${(actualFeeBps/100).toFixed(2)}%`,
            });
            report.addScenarioResult("High Fees (10%)", true, `${(actualFeeBps/100).toFixed(2)}% fee applied`);
        } else {
            report.fail(TESTS.E03.id, TESTS.E03.name, `Fee mismatch: expected ${highFees.total}, got ${actualFeeBps}`);
            report.addScenarioResult("High Fees (10%)", false, "Fee percentage mismatch");
        }

        // Restore original fees
        await (await ctx.token.setTaxConfig(TARGET_FEES.burnTax, TARGET_FEES.foundationFee)).wait();

    } catch (e) {
        report.fail(TESTS.E03.id, TESTS.E03.name, e.message);
    }

    // Test extreme fee scenario (50%) - using trader
    console.log("\nTesting Extreme Fee Scenario (50%)...");
    try {
        const extremeFees = SCENARIOS.extreme;
        await (await ctx.token.setTaxConfig(extremeFees.burnTax, extremeFees.foundationFee)).wait();

        const extremeFeeBuyAmount = ethers.parseEther("0.0001");
        const balBefore = await ctx.token.balanceOf(traderAddress);
        const supplyBefore = await ctx.token.totalSupply();
        const foundBefore = await ctx.token.balanceOf(foundationWallet);

        const deadline = Math.floor(Date.now() / 1000) + 1200;

        // Use V4 Universal Router for buy
        await (await buyTokensWithETH(
            traderUniversalRouter,
            ctx.tokenAddress,
            BASE.weth,
            traderAddress,
            extremeFeeBuyAmount,
            0n,
            deadline
        )).wait();

        const balAfter = await ctx.token.balanceOf(traderAddress);
        const supplyAfter = await ctx.token.totalSupply();
        const foundAfter = await ctx.token.balanceOf(foundationWallet);

        const received = balAfter - balBefore;
        const burned = supplyBefore - supplyAfter;
        const foundReceived = foundAfter - foundBefore;
        const totalFee = burned + foundReceived;
        const gross = received + totalFee;

        const actualFeeBps = Number((totalFee * 10000n) / gross);

        if (Math.abs(actualFeeBps - extremeFees.total) <= 10) {
            report.pass(TESTS.E04.id, TESTS.E04.name, {
                "Expected": `${extremeFees.total/100}%`,
                "Actual": `${(actualFeeBps/100).toFixed(2)}%`,
            });
            report.addScenarioResult("Extreme Fees (50%)", true, `${(actualFeeBps/100).toFixed(2)}% fee applied`);
        } else {
            report.fail(TESTS.E04.id, TESTS.E04.name, `Fee mismatch: expected ${extremeFees.total}, got ${actualFeeBps}`);
            report.addScenarioResult("Extreme Fees (50%)", false, "Fee percentage mismatch");
        }

        // Restore original fees
        await (await ctx.token.setTaxConfig(TARGET_FEES.burnTax, TARGET_FEES.foundationFee)).wait();
        console.log("Restored to production fees");

    } catch (e) {
        report.fail(TESTS.E04.id, TESTS.E04.name, e.message);
    }

    // Add production scenario result
    report.addScenarioResult("Production (2.5%)", tokensReceived > 0n, `Target config tested`);

    // =========================================================================
    // REPORT
    // =========================================================================
    console.log("\n");
    report.print();

    const reportPath = report.save();
    console.log(`\nReport saved to: ${reportPath}`);

    const summary = report.getSummary();
    process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
