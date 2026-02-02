/**
 * =============================================================================
 * E2E Contract Tests - Full Flow
 * =============================================================================
 *
 * End-to-end tests for the AquariTest contract on local hardhat network.
 * Tests the complete fee enablement flow without requiring a fork.
 *
 * Run with: npx hardhat test test/e2e-contract.test.js
 *
 * =============================================================================
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("E2E Contract Tests - Full Flow", function () {
    let token;
    let owner;
    let user1;
    let user2;
    let foundationWallet;
    let mockPair;

    const BURN_TAX = 125;       // 1.25%
    const FOUNDATION_FEE = 125; // 1.25%
    const TOTAL_FEE = 250;      // 2.5%

    beforeEach(async function () {
        [owner, user1, user2, foundationWallet, mockPair] = await ethers.getSigners();

        // Deploy AquariMock - simplified contract for testing fee logic
        // This avoids OpenZeppelin upgrades plugin validation issues
        // The fee logic is identical to the mainnet contract
        const AquariMock = await ethers.getContractFactory("AquariMock");
        token = await AquariMock.deploy(owner.address);
        await token.waitForDeployment();
    });

    // =========================================================================
    // DEPLOYMENT TESTS
    // =========================================================================
    describe("Deployment", function () {
        it("should deploy with correct name and symbol", async function () {
            expect(await token.name()).to.equal("Aquari Mock");
            expect(await token.symbol()).to.equal("AQMOCK");
        });

        it("should set owner correctly", async function () {
            expect(await token.owner()).to.equal(owner.address);
        });

        it("should have 18 decimals", async function () {
            expect(await token.decimals()).to.equal(18);
        });

        it("should mint initial supply to owner", async function () {
            const supply = await token.totalSupply();
            expect(supply).to.be.gt(0);
            expect(await token.balanceOf(owner.address)).to.equal(supply);
        });

        it("should have pairIsSet as false initially", async function () {
            expect(await token.pairIsSet()).to.equal(false);
        });

        it("should have trading enabled", async function () {
            expect(await token.tradingEnabled()).to.equal(true);
        });

        it("should have burn tax as 0 initially", async function () {
            expect(await token.burnTax()).to.equal(0);
        });

        it("should have foundation fee as 0 initially", async function () {
            expect(await token.foundationFee()).to.equal(0);
        });
    });

    // =========================================================================
    // OWNER-ONLY FUNCTIONS
    // =========================================================================
    describe("Owner-Only Functions", function () {
        it("should allow owner to call setTaxConfig", async function () {
            await expect(token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE))
                .to.not.be.reverted;

            expect(await token.burnTax()).to.equal(BURN_TAX);
            expect(await token.foundationFee()).to.equal(FOUNDATION_FEE);
        });

        it("should revert when non-owner calls setTaxConfig", async function () {
            await expect(token.connect(user1).setTaxConfig(BURN_TAX, FOUNDATION_FEE))
                .to.be.reverted;
        });

        it("should allow owner to call setFoundationWallet", async function () {
            await expect(token.connect(owner).setFoundationWallet(foundationWallet.address))
                .to.not.be.reverted;

            expect(await token.foundationWallet()).to.equal(foundationWallet.address);
        });

        it("should revert when non-owner calls setFoundationWallet", async function () {
            await expect(token.connect(user1).setFoundationWallet(foundationWallet.address))
                .to.be.reverted;
        });

        it("should allow owner to call setUniswapV2Pair", async function () {
            await expect(token.connect(owner).setUniswapV2Pair(mockPair.address))
                .to.not.be.reverted;

            expect(await token.uniswapV2Pair()).to.equal(mockPair.address);
            expect(await token.pairIsSet()).to.equal(true);
        });

        it("should revert when non-owner calls setUniswapV2Pair", async function () {
            await expect(token.connect(user1).setUniswapV2Pair(mockPair.address))
                .to.be.reverted;
        });
    });

    // =========================================================================
    // PAIR IS SET - IRREVERSIBLE
    // =========================================================================
    describe("setUniswapV2Pair - Irreversible", function () {
        it("should only allow setting pair once", async function () {
            // First call should succeed
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            expect(await token.pairIsSet()).to.equal(true);

            // Second call should revert with PairAlreadySet
            await expect(token.connect(owner).setUniswapV2Pair(user1.address))
                .to.be.revertedWithCustomError(token, "PairAlreadySet");
        });

        it("should revert if pair address is zero", async function () {
            await expect(token.connect(owner).setUniswapV2Pair(ethers.ZeroAddress))
                .to.be.revertedWithCustomError(token, "ZeroAddress");
        });
    });

    // =========================================================================
    // TAX CONFIGURATION
    // =========================================================================
    describe("Tax Configuration", function () {
        it("should allow changing tax config after pair is set", async function () {
            // Set pair first
            await token.connect(owner).setUniswapV2Pair(mockPair.address);

            // Then set tax config
            await token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE);
            expect(await token.burnTax()).to.equal(BURN_TAX);
            expect(await token.foundationFee()).to.equal(FOUNDATION_FEE);

            // Change it again
            await token.connect(owner).setTaxConfig(200, 200);
            expect(await token.burnTax()).to.equal(200);
            expect(await token.foundationFee()).to.equal(200);
        });

        it("should allow setting zero fees", async function () {
            await token.connect(owner).setTaxConfig(0, 0);
            expect(await token.burnTax()).to.equal(0);
            expect(await token.foundationFee()).to.equal(0);
        });

        it("should allow setting high fees", async function () {
            // 50% total fee
            await token.connect(owner).setTaxConfig(2500, 2500);
            expect(await token.burnTax()).to.equal(2500);
            expect(await token.foundationFee()).to.equal(2500);
        });
    });

    // =========================================================================
    // TRANSFER WITHOUT FEES (pairIsSet = false)
    // =========================================================================
    describe("Transfers - No Fees (pair not set)", function () {
        beforeEach(async function () {
            // Transfer some tokens to user1
            await token.connect(owner).transfer(user1.address, ethers.parseEther("1000"));
        });

        it("should transfer full amount when pair is not set", async function () {
            const amount = ethers.parseEther("100");
            const user2BalanceBefore = await token.balanceOf(user2.address);

            await token.connect(user1).transfer(user2.address, amount);

            const user2BalanceAfter = await token.balanceOf(user2.address);
            expect(user2BalanceAfter - user2BalanceBefore).to.equal(amount);
        });

        it("should not burn tokens when pair is not set", async function () {
            const amount = ethers.parseEther("100");
            const supplyBefore = await token.totalSupply();

            await token.connect(user1).transfer(user2.address, amount);

            const supplyAfter = await token.totalSupply();
            expect(supplyAfter).to.equal(supplyBefore);
        });
    });

    // =========================================================================
    // TRANSFER WITH FEES (pairIsSet = true)
    // =========================================================================
    describe("Transfers - With Fees (pair set)", function () {
        beforeEach(async function () {
            // Setup: set foundation wallet, tax config, and pair
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);

            // Transfer tokens to user1 (owner is excluded, so no fee)
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should apply fees on regular user transfer", async function () {
            const amount = ethers.parseEther("1000");
            const user2BalanceBefore = await token.balanceOf(user2.address);
            const foundationBalanceBefore = await token.balanceOf(foundationWallet.address);
            const supplyBefore = await token.totalSupply();

            await token.connect(user1).transfer(user2.address, amount);

            const user2BalanceAfter = await token.balanceOf(user2.address);
            const foundationBalanceAfter = await token.balanceOf(foundationWallet.address);
            const supplyAfter = await token.totalSupply();

            // Calculate expected values
            // Total fee = 2.5% = 25 tokens on 1000
            const totalFee = (amount * BigInt(TOTAL_FEE)) / 10000n;
            const burnAmount = (amount * BigInt(BURN_TAX)) / 10000n;
            const foundationAmount = (amount * BigInt(FOUNDATION_FEE)) / 10000n;
            const expectedReceived = amount - totalFee;

            // Verify
            expect(user2BalanceAfter - user2BalanceBefore).to.equal(expectedReceived);
            expect(foundationBalanceAfter - foundationBalanceBefore).to.equal(foundationAmount);
            expect(supplyBefore - supplyAfter).to.equal(burnAmount);
        });

        it("should skip fees for excluded addresses (owner)", async function () {
            const amount = ethers.parseEther("1000");
            const user1BalanceBefore = await token.balanceOf(user1.address);
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            // Owner to user1 should not have fees
            await token.connect(owner).transfer(user1.address, amount);

            const user1BalanceAfter = await token.balanceOf(user1.address);
            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            // Full amount should be received
            expect(user1BalanceAfter - user1BalanceBefore).to.equal(amount);
            // No burn
            expect(supplyAfter).to.equal(supplyBefore);
            // No foundation fee
            expect(foundationAfter).to.equal(foundationBefore);
        });

        it("should correctly calculate 2.5% total fee", async function () {
            const amount = ethers.parseEther("10000");
            const user2BalanceBefore = await token.balanceOf(user2.address);

            await token.connect(user1).transfer(user2.address, amount);

            const received = (await token.balanceOf(user2.address)) - user2BalanceBefore;
            const expectedReceived = amount - (amount * BigInt(TOTAL_FEE)) / 10000n;

            expect(received).to.equal(expectedReceived);

            // Verify percentage
            const feeAmount = amount - received;
            const actualFeeBps = Number((feeAmount * 10000n) / amount);
            expect(actualFeeBps).to.equal(TOTAL_FEE);
        });
    });

    // =========================================================================
    // EXCLUSION TESTS
    // =========================================================================
    describe("Exclusion from Tax", function () {
        beforeEach(async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should allow owner to exclude address from tax", async function () {
            await token.connect(owner).excludeFromTax(user1.address);
            expect(await token.isExcludedFromTax(user1.address)).to.equal(true);
        });

        it("should allow owner to include address back in tax", async function () {
            await token.connect(owner).excludeFromTax(user1.address);
            expect(await token.isExcludedFromTax(user1.address)).to.equal(true);

            await token.connect(owner).includeInTax(user1.address);
            expect(await token.isExcludedFromTax(user1.address)).to.equal(false);
        });

        it("should not charge fees when sender is excluded", async function () {
            await token.connect(owner).excludeFromTax(user1.address);

            const amount = ethers.parseEther("1000");
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            await token.connect(user1).transfer(user2.address, amount);

            const user2Balance = await token.balanceOf(user2.address);
            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            // Full amount received
            expect(user2Balance).to.equal(amount);
            // No burn
            expect(supplyAfter).to.equal(supplyBefore);
            // No foundation fee
            expect(foundationAfter).to.equal(foundationBefore);
        });

        it("should not charge fees when recipient is excluded", async function () {
            await token.connect(owner).excludeFromTax(user2.address);

            const amount = ethers.parseEther("1000");
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            await token.connect(user1).transfer(user2.address, amount);

            const user2Balance = await token.balanceOf(user2.address);
            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            // Full amount received
            expect(user2Balance).to.equal(amount);
            // No burn
            expect(supplyAfter).to.equal(supplyBefore);
            // No foundation fee
            expect(foundationAfter).to.equal(foundationBefore);
        });
    });

    // =========================================================================
    // EDGE CASES - ZERO FEES
    // =========================================================================
    describe("Edge Case - Zero Fees", function () {
        beforeEach(async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(0, 0); // Zero fees
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should not deduct any fees when both are zero", async function () {
            const amount = ethers.parseEther("1000");
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            await token.connect(user1).transfer(user2.address, amount);

            const user2Balance = await token.balanceOf(user2.address);
            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            expect(user2Balance).to.equal(amount);
            expect(supplyAfter).to.equal(supplyBefore);
            expect(foundationAfter).to.equal(foundationBefore);
        });
    });

    // =========================================================================
    // EDGE CASES - HIGH FEES
    // =========================================================================
    describe("Edge Case - High Fees (10%)", function () {
        const HIGH_BURN = 500;
        const HIGH_FOUNDATION = 500;
        const HIGH_TOTAL = 1000;

        beforeEach(async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(HIGH_BURN, HIGH_FOUNDATION);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should correctly apply 10% total fee", async function () {
            const amount = ethers.parseEther("1000");

            await token.connect(user1).transfer(user2.address, amount);

            const user2Balance = await token.balanceOf(user2.address);
            const expectedReceived = amount - (amount * BigInt(HIGH_TOTAL)) / 10000n;

            expect(user2Balance).to.equal(expectedReceived);

            // Verify it's actually 10%
            const feeAmount = amount - user2Balance;
            const actualFeeBps = Number((feeAmount * 10000n) / amount);
            expect(actualFeeBps).to.equal(HIGH_TOTAL);
        });
    });

    // =========================================================================
    // EDGE CASES - EXTREME FEES (50%)
    // =========================================================================
    describe("Edge Case - Extreme Fees (50%)", function () {
        const EXTREME_BURN = 2500;
        const EXTREME_FOUNDATION = 2500;
        const EXTREME_TOTAL = 5000;

        beforeEach(async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(EXTREME_BURN, EXTREME_FOUNDATION);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should correctly apply 50% total fee", async function () {
            const amount = ethers.parseEther("1000");

            await token.connect(user1).transfer(user2.address, amount);

            const user2Balance = await token.balanceOf(user2.address);
            const expectedReceived = amount - (amount * BigInt(EXTREME_TOTAL)) / 10000n;

            expect(user2Balance).to.equal(expectedReceived);

            // Verify 50% fee
            expect(user2Balance).to.equal(ethers.parseEther("500"));
        });
    });

    // =========================================================================
    // EDGE CASES - BURN ONLY
    // =========================================================================
    describe("Edge Case - Burn Only (no foundation fee)", function () {
        const BURN_ONLY = 250;

        beforeEach(async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(BURN_ONLY, 0);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should burn tokens but not send to foundation", async function () {
            const amount = ethers.parseEther("1000");
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            await token.connect(user1).transfer(user2.address, amount);

            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            // Should burn
            const expectedBurn = (amount * BigInt(BURN_ONLY)) / 10000n;
            expect(supplyBefore - supplyAfter).to.equal(expectedBurn);

            // Foundation should not change
            expect(foundationAfter).to.equal(foundationBefore);
        });
    });

    // =========================================================================
    // EDGE CASES - FOUNDATION ONLY
    // =========================================================================
    describe("Edge Case - Foundation Only (no burn)", function () {
        const FOUNDATION_ONLY = 250;

        beforeEach(async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(0, FOUNDATION_ONLY);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
        });

        it("should send to foundation but not burn", async function () {
            const amount = ethers.parseEther("1000");
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            await token.connect(user1).transfer(user2.address, amount);

            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            // Should not burn
            expect(supplyAfter).to.equal(supplyBefore);

            // Foundation should receive
            const expectedFoundation = (amount * BigInt(FOUNDATION_ONLY)) / 10000n;
            expect(foundationAfter - foundationBefore).to.equal(expectedFoundation);
        });
    });

    // =========================================================================
    // FULL FLOW - END TO END
    // =========================================================================
    describe("Full E2E Flow", function () {
        it("should complete full fee enablement flow", async function () {
            // Step 1: Initial state
            expect(await token.pairIsSet()).to.equal(false);
            expect(await token.burnTax()).to.equal(0);
            expect(await token.foundationFee()).to.equal(0);

            // Step 2: Set foundation wallet
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            expect(await token.foundationWallet()).to.equal(foundationWallet.address);

            // Step 3: Set tax config (2.5% total)
            await token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE);
            expect(await token.burnTax()).to.equal(BURN_TAX);
            expect(await token.foundationFee()).to.equal(FOUNDATION_FEE);

            // Step 4: Transfer tokens to user (no fees yet - pair not set)
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));

            // Step 5: Enable fees by setting pair (IRREVERSIBLE)
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            expect(await token.pairIsSet()).to.equal(true);

            // Step 6: Verify second call fails
            await expect(token.connect(owner).setUniswapV2Pair(user2.address))
                .to.be.revertedWithCustomError(token, "PairAlreadySet");

            // Step 7: Test transfer with fees
            const amount = ethers.parseEther("1000");
            const supplyBefore = await token.totalSupply();
            const foundationBefore = await token.balanceOf(foundationWallet.address);

            await token.connect(user1).transfer(user2.address, amount);

            const user2Balance = await token.balanceOf(user2.address);
            const supplyAfter = await token.totalSupply();
            const foundationAfter = await token.balanceOf(foundationWallet.address);

            // Verify 2.5% fee applied
            const expectedReceived = amount - (amount * BigInt(TOTAL_FEE)) / 10000n;
            const expectedBurn = (amount * BigInt(BURN_TAX)) / 10000n;
            const expectedFoundation = (amount * BigInt(FOUNDATION_FEE)) / 10000n;

            expect(user2Balance).to.equal(expectedReceived);
            expect(supplyBefore - supplyAfter).to.equal(expectedBurn);
            expect(foundationAfter - foundationBefore).to.equal(expectedFoundation);

            // Step 8: Verify can still change tax config
            await token.connect(owner).setTaxConfig(200, 200);
            expect(await token.burnTax()).to.equal(200);
            expect(await token.foundationFee()).to.equal(200);

            // Step 9: Verify can still change foundation wallet
            await token.connect(owner).setFoundationWallet(user2.address);
            expect(await token.foundationWallet()).to.equal(user2.address);
        });
    });

    // =========================================================================
    // GAS USAGE TRACKING
    // =========================================================================
    describe("Gas Usage", function () {
        it("should track gas for setTaxConfig", async function () {
            const tx = await token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE);
            const receipt = await tx.wait();
            console.log(`    setTaxConfig gas: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(100000);
        });

        it("should track gas for setUniswapV2Pair", async function () {
            const tx = await token.connect(owner).setUniswapV2Pair(mockPair.address);
            const receipt = await tx.wait();
            console.log(`    setUniswapV2Pair gas: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(100000);
        });

        it("should track gas for transfer with fees", async function () {
            await token.connect(owner).setFoundationWallet(foundationWallet.address);
            await token.connect(owner).setTaxConfig(BURN_TAX, FOUNDATION_FEE);
            await token.connect(owner).setUniswapV2Pair(mockPair.address);
            await token.connect(owner).transfer(user1.address, ethers.parseEther("10000"));

            const tx = await token.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
            const receipt = await tx.wait();
            console.log(`    transfer with fees gas: ${receipt.gasUsed.toString()}`);
            expect(receipt.gasUsed).to.be.lt(200000);
        });
    });
});
