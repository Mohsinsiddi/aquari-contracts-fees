/**
 * =============================================================================
 * Universal Router (V4) Swap Utilities
 * =============================================================================
 *
 * Helper functions to execute swaps via Uniswap's Universal Router.
 * The Universal Router supports V2, V3, and V4 pools in a single transaction.
 *
 * For V2 swaps (which AQUARI uses), the Universal Router calls V2 pairs DIRECTLY,
 * not through the V2 Router. This means fees still apply correctly.
 *
 * IMPORTANT: For SELL operations (token → ETH), you must:
 * 1. Approve Permit2 to spend your tokens (ERC20 approve)
 * 2. Approve Universal Router via Permit2 (permit2.approve)
 * The Universal Router uses Permit2 for all token transfers from users.
 *
 * Command Reference:
 *   0x08 - V2_SWAP_EXACT_IN
 *   0x09 - V2_SWAP_EXACT_OUT
 *   0x0b - WRAP_ETH
 *   0x0c - UNWRAP_WETH
 *   0x04 - SWEEP
 *
 * Docs: https://docs.uniswap.org/contracts/universal-router/technical-reference
 * =============================================================================
 */

const { ethers } = require("hardhat");

// =============================================================================
// CONSTANTS
// =============================================================================

const UNIVERSAL_ROUTER_ADDRESS = "0x6ff5693b99212da76ad316178a184ab56d299b43";
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const MAX_UINT160 = 2n ** 160n - 1n;

// Command bytes
const COMMANDS = {
    V3_SWAP_EXACT_IN: 0x00,
    V3_SWAP_EXACT_OUT: 0x01,
    PERMIT2_TRANSFER_FROM: 0x02,
    PERMIT2_PERMIT_BATCH: 0x03,
    SWEEP: 0x04,
    TRANSFER: 0x05,
    PAY_PORTION: 0x06,
    V2_SWAP_EXACT_IN: 0x08,
    V2_SWAP_EXACT_OUT: 0x09,
    PERMIT2_PERMIT: 0x0a,
    WRAP_ETH: 0x0b,
    UNWRAP_WETH: 0x0c,
    PERMIT2_TRANSFER_FROM_BATCH: 0x0d,
    BALANCE_CHECK_ERC20: 0x0e,
    V4_SWAP: 0x10,
};

// Special addresses
const ADDRESS_THIS = "0x0000000000000000000000000000000000000002"; // Router's address placeholder
const MSG_SENDER = "0x0000000000000000000000000000000000000001"; // msg.sender placeholder

// Universal Router ABI (use only the deadline version to avoid ambiguity)
const UNIVERSAL_ROUTER_ABI = [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
];

// =============================================================================
// ENCODING HELPERS
// =============================================================================

/**
 * Encode WRAP_ETH command input
 * @param {string} recipient - Address to receive WETH (use ADDRESS_THIS for router)
 * @param {bigint} amount - Amount of ETH to wrap
 */
function encodeWrapETH(recipient, amount) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [recipient, amount]
    );
}

/**
 * Encode UNWRAP_WETH command input
 * @param {string} recipient - Address to receive ETH
 * @param {bigint} amountMin - Minimum amount of ETH to receive
 */
function encodeUnwrapWETH(recipient, amountMin) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [recipient, amountMin]
    );
}

/**
 * Encode V2_SWAP_EXACT_IN command input
 * @param {string} recipient - Address to receive output tokens
 * @param {bigint} amountIn - Exact input amount
 * @param {bigint} amountOutMin - Minimum output amount
 * @param {string[]} path - Token path [tokenIn, tokenOut]
 * @param {boolean} payerIsUser - true if tokens come from msg.sender
 */
function encodeV2SwapExactIn(recipient, amountIn, amountOutMin, path, payerIsUser) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint256", "address[]", "bool"],
        [recipient, amountIn, amountOutMin, path, payerIsUser]
    );
}

/**
 * Encode SWEEP command input (sweep remaining tokens to recipient)
 * @param {string} token - Token address to sweep
 * @param {string} recipient - Address to receive tokens
 * @param {bigint} amountMin - Minimum amount required
 */
function encodeSweep(token, recipient, amountMin) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256"],
        [token, recipient, amountMin]
    );
}

/**
 * Build commands bytes from array of command codes
 * @param {number[]} commandCodes - Array of command codes
 * @returns {string} - Hex string of commands
 */
function buildCommands(commandCodes) {
    return "0x" + commandCodes.map(c => c.toString(16).padStart(2, "0")).join("");
}

// =============================================================================
// HIGH-LEVEL SWAP FUNCTIONS
// =============================================================================

/**
 * Buy tokens with ETH via Universal Router (V2 path)
 * Flow: ETH -> WRAP_ETH -> V2_SWAP_EXACT_IN -> tokens to recipient
 *
 * @param {Contract} universalRouter - Universal Router contract instance
 * @param {string} tokenOut - Token to buy
 * @param {string} weth - WETH address
 * @param {string} recipient - Address to receive tokens
 * @param {bigint} amountIn - ETH amount to spend
 * @param {bigint} amountOutMin - Minimum tokens to receive
 * @param {number} deadline - Transaction deadline timestamp
 * @returns {Promise<ContractTransactionResponse>}
 */
async function buyTokensWithETH(
    universalRouter,
    tokenOut,
    weth,
    recipient,
    amountIn,
    amountOutMin,
    deadline
) {
    // Commands: WRAP_ETH (0x0b) + V2_SWAP_EXACT_IN (0x08)
    const commands = buildCommands([COMMANDS.WRAP_ETH, COMMANDS.V2_SWAP_EXACT_IN]);

    // Inputs
    const inputs = [
        // WRAP_ETH: wrap ETH to WETH, keep in router
        encodeWrapETH(ADDRESS_THIS, amountIn),
        // V2_SWAP_EXACT_IN: swap WETH -> token, send to recipient
        // payerIsUser = false because WETH is already in router from WRAP_ETH
        encodeV2SwapExactIn(recipient, amountIn, amountOutMin, [weth, tokenOut], false),
    ];

    return universalRouter.execute(commands, inputs, deadline, { value: amountIn });
}

/**
 * Sell tokens for ETH via Universal Router (V2 path)
 * Flow: tokens -> V2_SWAP_EXACT_IN -> WETH -> UNWRAP_WETH -> ETH to recipient
 *
 * NOTE: User must approve Universal Router (or use Permit2) before calling
 *
 * @param {Contract} universalRouter - Universal Router contract instance
 * @param {string} tokenIn - Token to sell
 * @param {string} weth - WETH address
 * @param {string} recipient - Address to receive ETH
 * @param {bigint} amountIn - Token amount to sell
 * @param {bigint} amountOutMin - Minimum ETH to receive
 * @param {number} deadline - Transaction deadline timestamp
 * @returns {Promise<ContractTransactionResponse>}
 */
async function sellTokensForETH(
    universalRouter,
    tokenIn,
    weth,
    recipient,
    amountIn,
    amountOutMin,
    deadline
) {
    // Commands: V2_SWAP_EXACT_IN (0x08) + UNWRAP_WETH (0x0c)
    const commands = buildCommands([COMMANDS.V2_SWAP_EXACT_IN, COMMANDS.UNWRAP_WETH]);

    // Inputs
    const inputs = [
        // V2_SWAP_EXACT_IN: swap token -> WETH, keep WETH in router
        // payerIsUser = true because tokens come from msg.sender
        encodeV2SwapExactIn(ADDRESS_THIS, amountIn, amountOutMin, [tokenIn, weth], true),
        // UNWRAP_WETH: unwrap WETH to ETH, send to recipient
        encodeUnwrapWETH(recipient, amountOutMin),
    ];

    return universalRouter.execute(commands, inputs, deadline);
}

/**
 * Sell tokens for ETH with fee-on-transfer support
 * Same as sellTokensForETH but handles tokens that take fees on transfer
 *
 * For fee-on-transfer tokens, we use SWEEP instead of exact amounts
 * because the router receives less than expected due to transfer fees
 *
 * @param {Contract} universalRouter - Universal Router contract instance
 * @param {string} tokenIn - Token to sell (fee-on-transfer)
 * @param {string} weth - WETH address
 * @param {string} recipient - Address to receive ETH
 * @param {bigint} amountIn - Token amount to sell (before fees)
 * @param {bigint} amountOutMin - Minimum ETH to receive
 * @param {number} deadline - Transaction deadline timestamp
 * @returns {Promise<ContractTransactionResponse>}
 */
async function sellFeeTokensForETH(
    universalRouter,
    tokenIn,
    weth,
    recipient,
    amountIn,
    amountOutMin,
    deadline
) {
    // For fee-on-transfer tokens, the V2 pair receives less than amountIn
    // We set amountIn to 0 in the swap command to use the actual balance received
    // Then sweep remaining WETH and unwrap

    // Commands: V2_SWAP_EXACT_IN (0x08) + UNWRAP_WETH (0x0c)
    const commands = buildCommands([COMMANDS.V2_SWAP_EXACT_IN, COMMANDS.UNWRAP_WETH]);

    // Inputs
    const inputs = [
        // V2_SWAP_EXACT_IN: payerIsUser = true, but amount doesn't matter for V2 fee tokens
        // The V2 pair calculates based on actual received balance
        encodeV2SwapExactIn(ADDRESS_THIS, amountIn, 0, [tokenIn, weth], true),
        // UNWRAP_WETH: unwrap all WETH to ETH
        encodeUnwrapWETH(recipient, amountOutMin),
    ];

    return universalRouter.execute(commands, inputs, deadline);
}

/**
 * Get Universal Router contract instance
 * @param {Signer} signer - Ethers signer
 * @param {string} [address] - Optional custom router address
 * @returns {Contract}
 */
function getUniversalRouter(signer, address = UNIVERSAL_ROUTER_ADDRESS) {
    return new ethers.Contract(address, UNIVERSAL_ROUTER_ABI, signer);
}

/**
 * Setup Permit2 approvals for selling tokens via Universal Router
 * Must be called before sellTokensForETH or sellFeeTokensForETH
 *
 * @param {Contract} token - Token contract (connected to signer)
 * @param {string} tokenAddress - Token address
 * @param {Signer} signer - Ethers signer
 * @returns {Promise<void>}
 */
async function setupPermit2ForSell(token, tokenAddress, signer) {
    const PERMIT2_ABI = [
        "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
    ];

    // Step 1: Approve Permit2 to spend tokens (ERC20 approval)
    await (await token.approve(PERMIT2_ADDRESS, ethers.MaxUint256)).wait();

    // Step 2: Approve Universal Router via Permit2
    const permit2 = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
    const maxExpiration = Math.floor(Date.now() / 1000) + 86400 * 365; // 1 year
    await (await permit2.approve(
        tokenAddress,
        UNIVERSAL_ROUTER_ADDRESS,
        MAX_UINT160,
        maxExpiration
    )).wait();
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Constants
    UNIVERSAL_ROUTER_ADDRESS,
    PERMIT2_ADDRESS,
    MAX_UINT160,
    UNIVERSAL_ROUTER_ABI,
    COMMANDS,
    ADDRESS_THIS,
    MSG_SENDER,

    // Encoding helpers
    encodeWrapETH,
    encodeUnwrapWETH,
    encodeV2SwapExactIn,
    encodeSweep,
    buildCommands,

    // High-level functions
    buyTokensWithETH,
    sellTokensForETH,
    sellFeeTokensForETH,
    getUniversalRouter,
    setupPermit2ForSell,
};
