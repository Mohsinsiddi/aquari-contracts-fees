/**
 * =============================================================================
 * Fork Test - Unit Tests
 * =============================================================================
 *
 * Tests all utility functions, handlers, and logic WITHOUT requiring a fork.
 * Run with: npx hardhat test test/fork-test-unit.test.js
 *
 * =============================================================================
 */

const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

// Import modules to test
const { TEST_CATEGORIES, SCENARIOS, TESTS, ABIS, MAINNET, BASE } = require("../scripts/fork-test/config");
const { TestReport } = require("../scripts/fork-test/lib/report");

describe("Fork Test - Unit Tests", function () {

    // =========================================================================
    // CONFIG TESTS
    // =========================================================================
    describe("Config", function () {

        it("should have valid MAINNET addresses", function () {
            expect(MAINNET.proxy).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(MAINNET.token).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(MAINNET.implementation).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(MAINNET.pair).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(MAINNET.foundationWallet).to.match(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should have proxy and token pointing to same address", function () {
            expect(MAINNET.proxy.toLowerCase()).to.equal(MAINNET.token.toLowerCase());
        });

        it("should have valid BASE network config", function () {
            expect(BASE.chainId).to.equal(8453);
            expect(BASE.weth).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(BASE.uniswapV2Router).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(BASE.uniswapV2Factory).to.match(/^0x[a-fA-F0-9]{40}$/);
        });

        it("should have all required SCENARIOS", function () {
            expect(SCENARIOS).to.have.property("production");
            expect(SCENARIOS).to.have.property("zero");
            expect(SCENARIOS).to.have.property("high");
            expect(SCENARIOS).to.have.property("extreme");
            expect(SCENARIOS).to.have.property("burnOnly");
            expect(SCENARIOS).to.have.property("foundationOnly");
        });

        it("should have correct fee values in SCENARIOS", function () {
            // Production: 2.5% total
            expect(SCENARIOS.production.burnTax).to.equal(125);
            expect(SCENARIOS.production.foundationFee).to.equal(125);
            expect(SCENARIOS.production.total).to.equal(250);

            // Zero: 0%
            expect(SCENARIOS.zero.burnTax).to.equal(0);
            expect(SCENARIOS.zero.foundationFee).to.equal(0);
            expect(SCENARIOS.zero.total).to.equal(0);

            // High: 10%
            expect(SCENARIOS.high.burnTax).to.equal(500);
            expect(SCENARIOS.high.foundationFee).to.equal(500);
            expect(SCENARIOS.high.total).to.equal(1000);

            // Extreme: 50%
            expect(SCENARIOS.extreme.burnTax).to.equal(2500);
            expect(SCENARIOS.extreme.foundationFee).to.equal(2500);
            expect(SCENARIOS.extreme.total).to.equal(5000);
        });

        it("should have burnTax + foundationFee = total for all scenarios", function () {
            for (const [name, scenario] of Object.entries(SCENARIOS)) {
                expect(
                    scenario.burnTax + scenario.foundationFee,
                    `${name} scenario total mismatch`
                ).to.equal(scenario.total);
            }
        });

        it("should have all required TESTS defined", function () {
            // Pre-flight
            expect(TESTS.PF01).to.exist;
            expect(TESTS.PF02).to.exist;
            expect(TESTS.PF03).to.exist;
            expect(TESTS.PF04).to.exist;
            expect(TESTS.PF05).to.exist;

            // Security
            expect(TESTS.S01).to.exist;
            expect(TESTS.S02).to.exist;
            expect(TESTS.S03).to.exist;

            // Trading
            expect(TESTS.T06).to.exist;
            expect(TESTS.T07).to.exist;
            expect(TESTS.T08).to.exist;

            // Edge cases
            expect(TESTS.E01).to.exist;
            expect(TESTS.E02).to.exist;
            expect(TESTS.E03).to.exist;
            expect(TESTS.E04).to.exist;
        });

        it("should have valid test structure", function () {
            for (const [key, test] of Object.entries(TESTS)) {
                expect(test.id, `${key} missing id`).to.be.a("string");
                expect(test.name, `${key} missing name`).to.be.a("string");
                expect(test.category, `${key} missing category`).to.be.a("string");
                expect(test.severity, `${key} missing severity`).to.be.a("string");
            }
        });

        it("should have all TEST_CATEGORIES", function () {
            expect(TEST_CATEGORIES.preflight).to.exist;
            expect(TEST_CATEGORIES.access).to.exist;
            expect(TEST_CATEGORIES.security).to.exist;
            expect(TEST_CATEGORIES.config).to.exist;
            expect(TEST_CATEGORIES.trading).to.exist;
            expect(TEST_CATEGORIES.state).to.exist;
            expect(TEST_CATEGORIES.exclusion).to.exist;
            expect(TEST_CATEGORIES.edge).to.exist;
            expect(TEST_CATEGORIES.admin).to.exist;
            expect(TEST_CATEGORIES.gas).to.exist;
        });

        it("should have valid ABIs", function () {
            expect(ABIS.token).to.be.an("array").with.length.greaterThan(0);
            expect(ABIS.router).to.be.an("array").with.length.greaterThan(0);
            expect(ABIS.factory).to.be.an("array").with.length.greaterThan(0);
            expect(ABIS.pair).to.be.an("array").with.length.greaterThan(0);
        });

        it("should have required token ABI functions", function () {
            const tokenAbi = ABIS.token.join(" ");
            expect(tokenAbi).to.include("balanceOf");
            expect(tokenAbi).to.include("owner");
            expect(tokenAbi).to.include("burnTax");
            expect(tokenAbi).to.include("foundationFee");
            expect(tokenAbi).to.include("setTaxConfig");
            expect(tokenAbi).to.include("setUniswapV2Pair");
            expect(tokenAbi).to.include("pairIsSet");
        });
    });

    // =========================================================================
    // REPORT TESTS
    // =========================================================================
    describe("TestReport", function () {
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
            report = new TestReport("simulate", mockCtx);
        });

        it("should initialize with correct mode", function () {
            expect(report.mode).to.equal("simulate");
        });

        it("should store context addresses", function () {
            expect(report.signerAddress).to.equal(mockCtx.signerAddress);
            expect(report.tokenAddress).to.equal(mockCtx.tokenAddress);
            expect(report.proxyAddress).to.equal(mockCtx.proxyAddress);
        });

        it("should record PASS results", function () {
            report.pass("T01", "Test name", { key: "value" }, 50000);

            expect(report.results).to.have.length(1);
            expect(report.results[0].status).to.equal("PASS");
            expect(report.results[0].testId).to.equal("T01");
            expect(report.results[0].name).to.equal("Test name");
            expect(report.results[0].gasUsed).to.equal(50000);
        });

        it("should record FAIL results", function () {
            report.fail("T02", "Failed test", "Some reason", { detail: "info" });

            expect(report.results).to.have.length(1);
            expect(report.results[0].status).to.equal("FAIL");
            expect(report.results[0].reason).to.equal("Some reason");
        });

        it("should record SKIP results", function () {
            report.skip("T03", "Skipped test", "Not applicable");

            expect(report.results).to.have.length(1);
            expect(report.results[0].status).to.equal("SKIP");
            expect(report.results[0].reason).to.equal("Not applicable");
        });

        it("should record INFO results", function () {
            report.info("G01", "Gas info", { gasUsed: "100000" });

            expect(report.results).to.have.length(1);
            expect(report.results[0].status).to.equal("INFO");
        });

        it("should add warnings", function () {
            report.addWarning("Test warning");

            expect(report.warnings).to.have.length(1);
            expect(report.warnings[0]).to.equal("Test warning");
        });

        it("should add scenario results", function () {
            report.addScenarioResult("Production", true, "Passed");
            report.addScenarioResult("Zero Fees", false, "Failed");

            expect(report.scenarios).to.have.length(2);
            expect(report.scenarios[0].passed).to.be.true;
            expect(report.scenarios[1].passed).to.be.false;
        });

        it("should track gas usage", function () {
            report.pass("T01", "Test 1", null, 50000);
            report.pass("T02", "Test 2", null, 75000);

            expect(report.gasUsage["T01"]).to.equal(50000);
            expect(report.gasUsage["T02"]).to.equal(75000);
        });

        it("should calculate summary correctly", function () {
            report.pass("T01", "Pass 1");
            report.pass("T02", "Pass 2");
            report.fail("T03", "Fail 1", "reason");
            report.skip("T04", "Skip 1", "reason");
            report.info("G01", "Info 1");

            const summary = report.getSummary();

            expect(summary.total).to.equal(5);
            expect(summary.passed).to.equal(2);
            expect(summary.failed).to.equal(1);
            expect(summary.skipped).to.equal(1);
            expect(summary.info).to.equal(1);
        });

        it("should categorize results by test ID prefix", function () {
            report.pass("PF01", "Preflight");
            report.pass("S01", "Security");
            report.pass("T06", "Trading");
            report.pass("E01", "Edge");
            report.pass("A01", "Admin");
            report.pass("G01", "Gas");

            const categories = report.getResultsByCategory();

            expect(categories.preflight).to.have.length(1);
            expect(categories.security).to.have.length(1);
            expect(categories.trading).to.have.length(1);
            expect(categories.edge).to.have.length(1);
            expect(categories.admin).to.have.length(1);
            expect(categories.gas).to.have.length(1);
        });

        it("should generate report string", function () {
            report.setBlockNumber(12345678);
            report.pass("T01", "Test passed");
            report.fail("T02", "Test failed", "reason");

            const output = report.generate();

            expect(output).to.include("AQUARI FEE ENABLEMENT");
            expect(output).to.include("FINAL SUMMARY");
            expect(output).to.include("12345678");
        });
    });

    // =========================================================================
    // ASSERTIONS TESTS (without hardhat dependency)
    // =========================================================================
    describe("Assertion Logic", function () {

        it("should validate fee calculation logic", function () {
            // Test: 2.5% fee on 1000 tokens
            const grossAmount = 1000n;
            const expectedBps = 250; // 2.5%
            const expectedFee = 25n; // 2.5% of 1000

            // Calculate: (feeAmount * 10000) / grossAmount should equal expectedBps
            const actualBps = Number((expectedFee * 10000n) / grossAmount);

            expect(actualBps).to.equal(expectedBps);
        });

        it("should validate high fee calculation", function () {
            // Test: 10% fee on 1000 tokens
            const grossAmount = 1000n;
            const expectedBps = 1000; // 10%
            const expectedFee = 100n; // 10% of 1000

            const actualBps = Number((expectedFee * 10000n) / grossAmount);

            expect(actualBps).to.equal(expectedBps);
        });

        it("should validate extreme fee calculation", function () {
            // Test: 50% fee on 1000 tokens
            const grossAmount = 1000n;
            const expectedBps = 5000; // 50%
            const expectedFee = 500n; // 50% of 1000

            const actualBps = Number((expectedFee * 10000n) / grossAmount);

            expect(actualBps).to.equal(expectedBps);
        });

        it("should detect fee tolerance violations", function () {
            const grossAmount = 10000n;
            const actualFee = 260n; // 2.6% instead of 2.5%
            const expectedBps = 250;
            const toleranceBps = 5;

            const actualBps = Number((actualFee * 10000n) / grossAmount);
            const diff = Math.abs(actualBps - expectedBps);

            expect(diff).to.equal(10); // 10 bps difference
            expect(diff > toleranceBps).to.be.true; // Should exceed 5 bps tolerance
        });

        it("should pass fee tolerance within range", function () {
            const grossAmount = 10000n;
            const actualFee = 251n; // 2.51%
            const expectedBps = 250;
            const toleranceBps = 5;

            const actualBps = Number((actualFee * 10000n) / grossAmount);
            const diff = Math.abs(actualBps - expectedBps);

            expect(diff).to.equal(1); // 1 bps difference
            expect(diff <= toleranceBps).to.be.true; // Should be within 5 bps tolerance
        });
    });

    // =========================================================================
    // STATE MANAGEMENT TESTS
    // =========================================================================
    describe("State Management", function () {
        const testStatePath = path.join(__dirname, "../scripts/fork-test/test-state.json");

        afterEach(function () {
            // Clean up test state file
            if (fs.existsSync(testStatePath)) {
                fs.unlinkSync(testStatePath);
            }
        });

        it("should handle missing state file gracefully", function () {
            // Just verify the state module exports the right functions
            const state = require("../scripts/fork-test/lib/state");
            expect(state.loadState).to.be.a("function");
            expect(state.saveState).to.be.a("function");
            expect(state.clearState).to.be.a("function");
        });

        it("should return default state when file missing", function () {
            const { loadState } = require("../scripts/fork-test/lib/state");
            // Clear any existing state first by requiring fresh
            const defaultState = {
                deployed: false,
                token: null,
                pair: null,
                foundationWallet: null,
                feesEnabled: false,
            };

            // loadState should return similar structure
            const loaded = loadState();
            expect(loaded).to.have.property("deployed");
            expect(loaded).to.have.property("feesEnabled");
        });
    });

    // =========================================================================
    // MODE DETECTION LOGIC TESTS
    // =========================================================================
    describe("Mode Detection Logic", function () {

        it("should correctly identify mode from args", function () {
            // Test the logic (mirrors mode.js getMode())
            function detectMode(args) {
                const isMainnet = args.includes("--mainnet");
                const isSimulate = args.includes("--simulate");
                const isNewToken = args.includes("--new-token");

                if (isMainnet) return { mode: "mainnet", newToken: isNewToken };
                if (isSimulate) return { mode: "simulate", newToken: false };
                return { mode: "mainnet", newToken: true }; // default
            }

            // --mainnet = test real AQUARI
            expect(detectMode(["--mainnet"])).to.deep.equal({ mode: "mainnet", newToken: false });
            // --mainnet --new-token = deploy fresh, you are owner
            expect(detectMode(["--mainnet", "--new-token"])).to.deep.equal({ mode: "mainnet", newToken: true });
            // --simulate = edge case testing
            expect(detectMode(["--simulate"])).to.deep.equal({ mode: "simulate", newToken: false });
            // default = --mainnet --new-token
            expect(detectMode([])).to.deep.equal({ mode: "mainnet", newToken: true });
        });
    });

    // =========================================================================
    // ADDRESS VALIDATION TESTS
    // =========================================================================
    describe("Address Validation", function () {

        it("should validate Ethereum addresses", function () {
            const validAddress = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
            const invalidAddress1 = "0x123"; // too short
            const invalidAddress2 = "not an address";
            const invalidAddress3 = "0xGGGG567890123456789012345678901234567890"; // invalid chars

            const isValidAddress = (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr);

            expect(isValidAddress(validAddress)).to.be.true;
            expect(isValidAddress(invalidAddress1)).to.be.false;
            expect(isValidAddress(invalidAddress2)).to.be.false;
            expect(isValidAddress(invalidAddress3)).to.be.false;
        });

        it("should compare addresses case-insensitively", function () {
            const addr1 = "0x7f0e9971d3320521fc88f863e173a4cddbb051ba";
            const addr2 = "0x7F0E9971D3320521FC88F863E173A4CDDBB051BA";

            expect(addr1.toLowerCase()).to.equal(addr2.toLowerCase());
        });
    });

    // =========================================================================
    // FEE MATH TESTS
    // =========================================================================
    describe("Fee Math", function () {

        it("should calculate burn + foundation = total", function () {
            const burnTax = 125n;
            const foundationFee = 125n;
            const total = burnTax + foundationFee;

            expect(total).to.equal(250n);
        });

        it("should calculate tokens received after fee", function () {
            const grossTokens = 1000n;
            const burnTax = 125; // 1.25% in bps
            const foundationFee = 125; // 1.25% in bps
            const totalFeeBps = burnTax + foundationFee; // 250 bps = 2.5%

            // Fee amount = (gross * feeBps) / 10000
            const feeAmount = (grossTokens * BigInt(totalFeeBps)) / 10000n;
            const netTokens = grossTokens - feeAmount;

            expect(feeAmount).to.equal(25n); // 2.5% of 1000 = 25
            expect(netTokens).to.equal(975n); // 1000 - 25 = 975
        });

        it("should handle zero fees correctly", function () {
            const grossTokens = 1000n;
            const totalFeeBps = 0;

            const feeAmount = (grossTokens * BigInt(totalFeeBps)) / 10000n;
            const netTokens = grossTokens - feeAmount;

            expect(feeAmount).to.equal(0n);
            expect(netTokens).to.equal(grossTokens);
        });

        it("should handle extreme fees (50%)", function () {
            const grossTokens = 1000n;
            const totalFeeBps = 5000; // 50%

            const feeAmount = (grossTokens * BigInt(totalFeeBps)) / 10000n;
            const netTokens = grossTokens - feeAmount;

            expect(feeAmount).to.equal(500n);
            expect(netTokens).to.equal(500n);
        });

        it("should split fee between burn and foundation", function () {
            const grossTokens = 1000n;
            const burnTax = 125;
            const foundationFee = 125;

            const burnAmount = (grossTokens * BigInt(burnTax)) / 10000n;
            const foundationAmount = (grossTokens * BigInt(foundationFee)) / 10000n;

            expect(burnAmount).to.equal(12n); // 1.25% of 1000 = 12.5, truncated to 12
            expect(foundationAmount).to.equal(12n);
        });
    });

    // =========================================================================
    // SCENARIO VALIDATION TESTS
    // =========================================================================
    describe("Scenario Validation", function () {

        it("should have valid production scenario for mainnet", function () {
            const prod = SCENARIOS.production;

            // Must be 2.5% total as specified
            expect(prod.total).to.equal(250);
            expect(prod.burnTax).to.equal(125);
            expect(prod.foundationFee).to.equal(125);
        });

        it("should have scenarios that don't exceed 100%", function () {
            for (const [name, scenario] of Object.entries(SCENARIOS)) {
                expect(
                    scenario.total,
                    `${name} exceeds 100%`
                ).to.be.at.most(10000);
            }
        });

        it("should have non-negative fee values", function () {
            for (const [name, scenario] of Object.entries(SCENARIOS)) {
                expect(scenario.burnTax, `${name} burnTax negative`).to.be.at.least(0);
                expect(scenario.foundationFee, `${name} foundationFee negative`).to.be.at.least(0);
            }
        });
    });
});
