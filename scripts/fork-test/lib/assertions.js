/**
 * =============================================================================
 * Test Assertions
 * =============================================================================
 */

const { ethers } = require("hardhat");

/**
 * Assert that a value equals expected
 */
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

/**
 * Assert that a BigInt equals expected
 */
function assertBigIntEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}: expected ${expected.toString()}, got ${actual.toString()}`);
    }
}

/**
 * Assert that a BigInt is greater than expected
 */
function assertBigIntGt(actual, expected, message) {
    if (actual <= expected) {
        throw new Error(`${message}: expected > ${expected.toString()}, got ${actual.toString()}`);
    }
}

/**
 * Assert that a BigInt is less than expected
 */
function assertBigIntLt(actual, expected, message) {
    if (actual >= expected) {
        throw new Error(`${message}: expected < ${expected.toString()}, got ${actual.toString()}`);
    }
}

/**
 * Assert addresses are equal (case insensitive)
 */
function assertAddressEqual(actual, expected, message) {
    if (actual.toLowerCase() !== expected.toLowerCase()) {
        throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
}

/**
 * Assert a transaction reverts
 */
async function assertReverts(fn, expectedError = null, message = "Expected revert") {
    try {
        const result = await fn();
        // If fn returns a transaction, wait for it
        if (result && typeof result.wait === 'function') {
            await result.wait();
        }
        throw new Error(`${message}: transaction did not revert`);
    } catch (e) {
        if (e.message.includes("did not revert")) {
            throw e;
        }
        if (expectedError && !e.message.includes(expectedError)) {
            throw new Error(`${message}: expected error "${expectedError}", got "${e.message}"`);
        }
        return true;
    }
}

/**
 * Assert fee percentage is within tolerance
 * @param {bigint} feeAmount - Actual fee collected
 * @param {bigint} grossAmount - Gross amount before fees
 * @param {number} expectedBps - Expected fee in basis points (e.g., 250 for 2.5%)
 * @param {number} toleranceBps - Tolerance in basis points (e.g., 1 for 0.01%)
 */
function assertFeeAccuracy(feeAmount, grossAmount, expectedBps, toleranceBps = 1) {
    if (grossAmount === 0n) {
        throw new Error("Gross amount is zero");
    }

    // Calculate actual fee in bps: (feeAmount * 10000) / grossAmount
    const actualBps = Number((feeAmount * 10000n) / grossAmount);
    const diff = Math.abs(actualBps - expectedBps);

    if (diff > toleranceBps) {
        throw new Error(
            `Fee accuracy: expected ${expectedBps} bps, got ${actualBps} bps (diff: ${diff} bps, tolerance: ${toleranceBps} bps)`
        );
    }

    return { actualBps, expectedBps, diff };
}

/**
 * Format BigInt as readable number
 */
function formatTokens(amount, decimals = 18) {
    return ethers.formatUnits(amount, decimals);
}

/**
 * Calculate percentage
 */
function calcPercentage(part, whole) {
    if (whole === 0n) return "0.00";
    return ((Number(part) / Number(whole)) * 100).toFixed(2);
}

module.exports = {
    assertEqual,
    assertBigIntEqual,
    assertBigIntGt,
    assertBigIntLt,
    assertAddressEqual,
    assertReverts,
    assertFeeAccuracy,
    formatTokens,
    calcPercentage,
};
