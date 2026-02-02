/**
 * =============================================================================
 * Handlers Unit Tests - Full Coverage
 * =============================================================================
 *
 * Comprehensive unit tests for all handler/utility functions.
 * Run with: npx hardhat test test/handlers.test.js
 *
 * =============================================================================
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Import all handlers
const {
    assertEqual,
    assertBigIntEqual,
    assertBigIntGt,
    assertBigIntLt,
    assertAddressEqual,
    assertReverts,
    assertFeeAccuracy,
    formatTokens,
    calcPercentage,
} = require("../scripts/fork-test/lib/assertions");

const { loadState, saveState, clearState } = require("../scripts/fork-test/lib/state");
const { TestReport } = require("../scripts/fork-test/lib/report");
const { MAINNET, BASE, SCENARIOS, TARGET_FEES, TEST_PARAMS, ABIS, TESTS } = require("../scripts/fork-test/config");

describe("Handlers - Full Coverage", function () {

    // =========================================================================
    // ASSERTIONS.JS - assertEqual
    // =========================================================================
    describe("assertEqual", function () {
        it("should pass when values are equal", function () {
            expect(() => assertEqual("a", "a", "test")).to.not.throw();
            expect(() => assertEqual(123, 123, "test")).to.not.throw();
            expect(() => assertEqual(true, true, "test")).to.not.throw();
        });

        it("should throw when values are not equal", function () {
            expect(() => assertEqual("a", "b", "test")).to.throw("test: expected b, got a");
            expect(() => assertEqual(1, 2, "test")).to.throw("test: expected 2, got 1");
        });

        it("should handle null and undefined", function () {
            expect(() => assertEqual(null, null, "test")).to.not.throw();
            expect(() => assertEqual(undefined, undefined, "test")).to.not.throw();
            expect(() => assertEqual(null, undefined, "test")).to.throw();
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - assertBigIntEqual
    // =========================================================================
    describe("assertBigIntEqual", function () {
        it("should pass when BigInts are equal", function () {
            expect(() => assertBigIntEqual(100n, 100n, "test")).to.not.throw();
            expect(() => assertBigIntEqual(0n, 0n, "test")).to.not.throw();
            expect(() => assertBigIntEqual(BigInt("999999999999999999"), BigInt("999999999999999999"), "test")).to.not.throw();
        });

        it("should throw when BigInts are not equal", function () {
            expect(() => assertBigIntEqual(100n, 200n, "test")).to.throw("test: expected 200, got 100");
            expect(() => assertBigIntEqual(0n, 1n, "test")).to.throw();
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - assertBigIntGt
    // =========================================================================
    describe("assertBigIntGt", function () {
        it("should pass when actual > expected", function () {
            expect(() => assertBigIntGt(200n, 100n, "test")).to.not.throw();
            expect(() => assertBigIntGt(1n, 0n, "test")).to.not.throw();
        });

        it("should throw when actual <= expected", function () {
            expect(() => assertBigIntGt(100n, 100n, "test")).to.throw();
            expect(() => assertBigIntGt(50n, 100n, "test")).to.throw();
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - assertBigIntLt
    // =========================================================================
    describe("assertBigIntLt", function () {
        it("should pass when actual < expected", function () {
            expect(() => assertBigIntLt(100n, 200n, "test")).to.not.throw();
            expect(() => assertBigIntLt(0n, 1n, "test")).to.not.throw();
        });

        it("should throw when actual >= expected", function () {
            expect(() => assertBigIntLt(100n, 100n, "test")).to.throw();
            expect(() => assertBigIntLt(200n, 100n, "test")).to.throw();
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - assertAddressEqual
    // =========================================================================
    describe("assertAddressEqual", function () {
        it("should pass when addresses match (case insensitive)", function () {
            const addr1 = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
            const addr2 = "0x7F0E9971D3320521FC88F863E173A4CDDBB051BA";
            expect(() => assertAddressEqual(addr1, addr2, "test")).to.not.throw();
        });

        it("should throw when addresses don't match", function () {
            const addr1 = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
            const addr2 = "0x0000000000000000000000000000000000000000";
            expect(() => assertAddressEqual(addr1, addr2, "test")).to.throw();
        });

        it("should handle checksummed addresses", function () {
            const addr1 = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
            const addr2 = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
            expect(() => assertAddressEqual(addr1, addr2, "test")).to.not.throw();
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - assertReverts
    // =========================================================================
    describe("assertReverts", function () {
        it("should pass when function reverts", async function () {
            const revertingFn = async () => {
                throw new Error("Transaction reverted");
            };
            await expect(assertReverts(revertingFn)).to.not.be.rejected;
        });

        it("should throw when function succeeds", async function () {
            const successFn = async () => {
                return true;
            };
            await expect(assertReverts(successFn)).to.be.rejectedWith("did not revert");
        });

        it("should check specific error message when provided", async function () {
            const revertingFn = async () => {
                throw new Error("PairAlreadySet");
            };
            await expect(assertReverts(revertingFn, "PairAlreadySet")).to.not.be.rejected;
        });

        it("should throw when error message doesn't match", async function () {
            const revertingFn = async () => {
                throw new Error("WrongError");
            };
            await expect(assertReverts(revertingFn, "PairAlreadySet")).to.be.rejectedWith("expected error");
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - assertFeeAccuracy
    // =========================================================================
    describe("assertFeeAccuracy", function () {
        it("should pass when fee is within tolerance", function () {
            // 2.5% fee on 10000 tokens = 250 tokens
            const result = assertFeeAccuracy(250n, 10000n, 250, 5);
            expect(result.actualBps).to.equal(250);
            expect(result.diff).to.equal(0);
        });

        it("should pass when fee is slightly off but within tolerance", function () {
            // 2.51% fee (251 bps) should pass with 5 bps tolerance
            const result = assertFeeAccuracy(251n, 10000n, 250, 5);
            expect(result.diff).to.equal(1);
        });

        it("should throw when fee exceeds tolerance", function () {
            // 2.6% fee (260 bps) should fail with 5 bps tolerance
            expect(() => assertFeeAccuracy(260n, 10000n, 250, 5)).to.throw("Fee accuracy");
        });

        it("should throw when grossAmount is zero", function () {
            expect(() => assertFeeAccuracy(100n, 0n, 250, 5)).to.throw("Gross amount is zero");
        });

        it("should handle large numbers", function () {
            // 2.5% of 1,000,000 tokens
            const fee = 25000n;
            const gross = 1000000n;
            const result = assertFeeAccuracy(fee, gross, 250, 1);
            expect(result.actualBps).to.equal(250);
        });

        it("should handle zero fee scenario", function () {
            const result = assertFeeAccuracy(0n, 10000n, 0, 1);
            expect(result.actualBps).to.equal(0);
            expect(result.diff).to.equal(0);
        });

        it("should handle extreme 50% fee", function () {
            const result = assertFeeAccuracy(5000n, 10000n, 5000, 5);
            expect(result.actualBps).to.equal(5000);
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - formatTokens
    // =========================================================================
    describe("formatTokens", function () {
        it("should format 18 decimal tokens correctly", function () {
            const amount = ethers.parseEther("1000");
            const formatted = formatTokens(amount);
            expect(formatted).to.equal("1000.0");
        });

        it("should format small amounts", function () {
            const amount = ethers.parseEther("0.001");
            const formatted = formatTokens(amount);
            expect(formatted).to.equal("0.001");
        });

        it("should format zero", function () {
            const formatted = formatTokens(0n);
            expect(formatted).to.equal("0.0");
        });

        it("should handle custom decimals", function () {
            const amount = 1000000n; // 1 USDC (6 decimals)
            const formatted = formatTokens(amount, 6);
            expect(formatted).to.equal("1.0");
        });
    });

    // =========================================================================
    // ASSERTIONS.JS - calcPercentage
    // =========================================================================
    describe("calcPercentage", function () {
        it("should calculate correct percentage", function () {
            expect(calcPercentage(25n, 100n)).to.equal("25.00");
            expect(calcPercentage(50n, 100n)).to.equal("50.00");
            expect(calcPercentage(100n, 100n)).to.equal("100.00");
        });

        it("should handle decimals", function () {
            expect(calcPercentage(1n, 3n)).to.equal("33.33");
            expect(calcPercentage(2n, 3n)).to.equal("66.67");
        });

        it("should handle zero part", function () {
            expect(calcPercentage(0n, 100n)).to.equal("0.00");
        });

        it("should handle zero whole", function () {
            expect(calcPercentage(100n, 0n)).to.equal("0.00");
        });

        it("should handle large numbers", function () {
            const part = ethers.parseEther("250");
            const whole = ethers.parseEther("10000");
            expect(calcPercentage(part, whole)).to.equal("2.50");
        });
    });

    // =========================================================================
    // STATE.JS - loadState
    // =========================================================================
    describe("State Management - loadState", function () {
        it("should return default state structure", function () {
            const state = loadState();
            expect(state).to.have.property("deployed");
            expect(state).to.have.property("feesEnabled");
        });

        it("should have boolean deployed property", function () {
            const state = loadState();
            expect(typeof state.deployed).to.equal("boolean");
        });
    });

    // =========================================================================
    // STATE.JS - saveState & clearState
    // =========================================================================
    describe("State Management - saveState", function () {
        afterEach(function () {
            clearState();
        });

        it("should save and load state", function () {
            const testData = {
                deployed: true,
                token: "0x1234567890123456789012345678901234567890",
                pair: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                feesEnabled: true,
            };

            saveState(testData);
            const loaded = loadState();

            expect(loaded.deployed).to.equal(true);
            expect(loaded.token).to.equal(testData.token);
            expect(loaded.pair).to.equal(testData.pair);
            expect(loaded.feesEnabled).to.equal(true);
        });

        it("should add lastUpdated timestamp", function () {
            saveState({ deployed: true });
            const loaded = loadState();
            expect(loaded.lastUpdated).to.exist;
        });

        it("should merge updates with existing state", function () {
            saveState({ deployed: true, token: "0x1111" });
            saveState({ feesEnabled: true });

            const loaded = loadState();
            expect(loaded.deployed).to.equal(true);
            expect(loaded.feesEnabled).to.equal(true);
        });
    });

    // =========================================================================
    // CONFIG - Address Validation
    // =========================================================================
    describe("Config - Address Validation", function () {
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;

        it("should have valid MAINNET.proxy address", function () {
            expect(MAINNET.proxy).to.match(addressRegex);
        });

        it("should have valid MAINNET.implementation address", function () {
            expect(MAINNET.implementation).to.match(addressRegex);
        });

        it("should have valid MAINNET.pair address", function () {
            expect(MAINNET.pair).to.match(addressRegex);
        });

        it("should have valid MAINNET.foundationWallet address", function () {
            expect(MAINNET.foundationWallet).to.match(addressRegex);
        });

        it("should have valid BASE.weth address", function () {
            expect(BASE.weth).to.match(addressRegex);
        });

        it("should have valid BASE.uniswapV2Router address", function () {
            expect(BASE.uniswapV2Router).to.match(addressRegex);
        });

        it("should have valid BASE.uniswapV2Factory address", function () {
            expect(BASE.uniswapV2Factory).to.match(addressRegex);
        });
    });

    // =========================================================================
    // CONFIG - Scenario Validation
    // =========================================================================
    describe("Config - Scenarios", function () {
        it("should have production scenario with correct values", function () {
            expect(SCENARIOS.production.burnTax).to.equal(125);
            expect(SCENARIOS.production.foundationFee).to.equal(125);
            expect(SCENARIOS.production.total).to.equal(250);
        });

        it("should have zero scenario with all zeros", function () {
            expect(SCENARIOS.zero.burnTax).to.equal(0);
            expect(SCENARIOS.zero.foundationFee).to.equal(0);
            expect(SCENARIOS.zero.total).to.equal(0);
        });

        it("should have high scenario with 10% total", function () {
            expect(SCENARIOS.high.total).to.equal(1000);
        });

        it("should have extreme scenario with 50% total", function () {
            expect(SCENARIOS.extreme.total).to.equal(5000);
        });

        it("should have burnOnly scenario with only burnTax", function () {
            expect(SCENARIOS.burnOnly.burnTax).to.be.greaterThan(0);
            expect(SCENARIOS.burnOnly.foundationFee).to.equal(0);
        });

        it("should have foundationOnly scenario with only foundationFee", function () {
            expect(SCENARIOS.foundationOnly.burnTax).to.equal(0);
            expect(SCENARIOS.foundationOnly.foundationFee).to.be.greaterThan(0);
        });

        it("all scenarios should have valid total calculation", function () {
            for (const [name, s] of Object.entries(SCENARIOS)) {
                expect(s.burnTax + s.foundationFee, `${name} total mismatch`).to.equal(s.total);
            }
        });

        it("all scenarios should not exceed 100%", function () {
            for (const [name, s] of Object.entries(SCENARIOS)) {
                expect(s.total, `${name} exceeds 100%`).to.be.at.most(10000);
            }
        });
    });

    // =========================================================================
    // CONFIG - TEST_PARAMS
    // =========================================================================
    describe("Config - TEST_PARAMS", function () {
        it("should have valid buyAmount", function () {
            expect(TEST_PARAMS.buyAmount).to.be.a("string");
            expect(parseFloat(TEST_PARAMS.buyAmount)).to.be.greaterThan(0);
        });

        it("should have valid sellAmount", function () {
            expect(TEST_PARAMS.sellAmount).to.be.a("string");
            expect(parseFloat(TEST_PARAMS.sellAmount)).to.be.greaterThan(0);
        });

        it("should have valid transferAmount", function () {
            expect(TEST_PARAMS.transferAmount).to.be.a("string");
            expect(parseFloat(TEST_PARAMS.transferAmount)).to.be.greaterThan(0);
        });

        it("should have reasonable feeTolerance", function () {
            expect(TEST_PARAMS.feeTolerance).to.be.at.least(1);
            expect(TEST_PARAMS.feeTolerance).to.be.at.most(100);
        });
    });

    // =========================================================================
    // CONFIG - ABIS
    // =========================================================================
    describe("Config - ABIs", function () {
        it("should have token ABI with all required functions", function () {
            const abi = ABIS.token.join(" ");
            const required = [
                "name", "symbol", "decimals", "totalSupply", "balanceOf",
                "owner", "burnTax", "foundationFee", "foundationWallet",
                "uniswapV2Pair", "pairIsSet", "setTaxConfig", "setUniswapV2Pair",
                "approve", "transfer"
            ];
            for (const fn of required) {
                expect(abi, `Missing ${fn}`).to.include(fn);
            }
        });

        it("should have router ABI with swap functions", function () {
            const abi = ABIS.router.join(" ");
            expect(abi).to.include("swapExactETHForTokens");
            expect(abi).to.include("swapExactTokensForETH");
            expect(abi).to.include("SupportingFeeOnTransferTokens");
            expect(abi).to.include("addLiquidityETH");
        });

        it("should have factory ABI with getPair and createPair", function () {
            const abi = ABIS.factory.join(" ");
            expect(abi).to.include("getPair");
            expect(abi).to.include("createPair");
        });

        it("should have pair ABI with getReserves", function () {
            const abi = ABIS.pair.join(" ");
            expect(abi).to.include("getReserves");
            expect(abi).to.include("token0");
        });
    });

    // =========================================================================
    // CONFIG - TESTS Definition
    // =========================================================================
    describe("Config - TESTS", function () {
        it("should have all pre-flight tests", function () {
            expect(TESTS.PF01).to.exist;
            expect(TESTS.PF02).to.exist;
            expect(TESTS.PF03).to.exist;
            expect(TESTS.PF04).to.exist;
            expect(TESTS.PF05).to.exist;
        });

        it("should have all security tests", function () {
            expect(TESTS.S01).to.exist;
            expect(TESTS.S02).to.exist;
            expect(TESTS.S03).to.exist;
        });

        it("should have all trading tests", function () {
            expect(TESTS.T06).to.exist;
            expect(TESTS.T07).to.exist;
            expect(TESTS.T08).to.exist;
            expect(TESTS.T08b).to.exist;
            expect(TESTS.T09).to.exist;
        });

        it("should have all edge case tests", function () {
            expect(TESTS.E01).to.exist;
            expect(TESTS.E02).to.exist;
            expect(TESTS.E03).to.exist;
            expect(TESTS.E04).to.exist;
        });

        it("should have all admin tests", function () {
            expect(TESTS.A01).to.exist;
            expect(TESTS.A02).to.exist;
        });

        it("should have all gas tests", function () {
            expect(TESTS.G01).to.exist;
            expect(TESTS.G02).to.exist;
            expect(TESTS.G03).to.exist;
            expect(TESTS.G04).to.exist;
        });

        it("each test should have required properties", function () {
            for (const [key, test] of Object.entries(TESTS)) {
                expect(test.id, `${key} missing id`).to.be.a("string");
                expect(test.name, `${key} missing name`).to.be.a("string");
                expect(test.category, `${key} missing category`).to.be.a("string");
                expect(test.severity, `${key} missing severity`).to.be.a("string");
            }
        });
    });

    // =========================================================================
    // REPORT - TestReport Class
    // =========================================================================
    describe("TestReport - Extended", function () {
        let report;
        const mockCtx = {
            signerAddress: "0x1234567890123456789012345678901234567890",
            tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            proxyAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            implementationAddress: "0x0987654321098765432109876543210987654321",
            pairAddress: "0xfedcfedcfedcfedcfedcfedcfedcfedcfedcfedc",
            ownerAddress: "0x1234567890123456789012345678901234567890",
            foundationWallet: "0x5555555555555555555555555555555555555555",
        };

        beforeEach(function () {
            report = new TestReport("mainnet", mockCtx);
        });

        it("should track start time", function () {
            expect(report.startTime).to.be.instanceof(Date);
        });

        it("should initialize empty results array", function () {
            expect(report.results).to.be.an("array").with.length(0);
        });

        it("should initialize empty warnings array", function () {
            expect(report.warnings).to.be.an("array").with.length(0);
        });

        it("should initialize empty scenarios array", function () {
            expect(report.scenarios).to.be.an("array").with.length(0);
        });

        it("should calculate totalGas correctly", function () {
            report.pass("T01", "Test 1", null, 50000);
            report.pass("T02", "Test 2", null, 30000);
            report.pass("T03", "Test 3", null, 20000);

            const summary = report.getSummary();
            expect(summary.totalGas).to.equal(100000);
        });

        it("should count critical failures (if severity tracked)", function () {
            report.fail("T01", "Critical fail", "reason");
            const summary = report.getSummary();
            expect(summary.failed).to.equal(1);
        });

        it("should generate report with all sections", function () {
            report.setBlockNumber(123456);
            report.pass("PF01", "Preflight");
            report.pass("T01", "Access");
            report.pass("S01", "Security");
            report.fail("T06", "Trading", "failed");
            report.skip("E01", "Edge", "skipped");
            report.info("G01", "Gas");
            report.addWarning("Test warning");
            report.addScenarioResult("Production", true, "OK");

            const output = report.generate();

            expect(output).to.include("TEST METADATA");
            expect(output).to.include("ACCOUNTS");
            expect(output).to.include("CONTRACTS");
            expect(output).to.include("WARNINGS");
            expect(output).to.include("FINAL SUMMARY");
            expect(output).to.include("SCENARIO RESULTS");
        });

        it("should show ALL TESTS PASSED when no failures", function () {
            report.pass("T01", "Test 1");
            report.pass("T02", "Test 2");

            const output = report.generate();
            expect(output).to.include("ALL TESTS PASSED");
        });

        it("should show TESTS FAILED when there are failures", function () {
            report.pass("T01", "Test 1");
            report.fail("T02", "Test 2", "reason");

            const output = report.generate();
            expect(output).to.include("TESTS FAILED");
        });
    });
});
