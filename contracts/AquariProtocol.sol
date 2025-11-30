// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {FixedPointMathLib} from "./FixedPointMathLib.sol";

/**
 * @title Aquari Protocol
 * @notice An advanced ERC20 token with burning capabilities, reflections, foundation fees, and Uniswap V2 integration.
 * @dev    The contract uses the OpenZeppelin upgradeable system, making it proxy-friendly.
 *
 * Features:
 *  - Burning capabilities on taxed trades.
 *  - Foundation fee directing funds to a specified foundation wallet.
 *  - Permits for gasless approvals (via ERC20Permit).
 *  - Safe token transfers using SafeERC20.
 *  - AntiBot functionality and direct trade enable/disable.
 *  - Token allocation by an owner that can be later unleashed into circulation.
 *  - Owner retains control (ownership cannot be renounced).
 */
contract AquariProtocol is
    Initializable,
    OwnableUpgradeable,
    ERC20Upgradeable,
    ERC20PermitUpgradeable,
    ERC20PausableUpgradeable,
    ERC20BurnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;
    using FixedPointMathLib for uint256;

    // -------------------------------------------------------------------------
    // Constants and Global Variables
    // -------------------------------------------------------------------------

    /// @notice The number of decimals for the token.
    uint256 private constant DECIMALS = 18;

    /// @notice The total initial supply: 100 million tokens with 18 decimals.
    uint256 private constant INITIAL_SUPPLY = 100_000_000 * 10 ** DECIMALS;

    /// @notice Denominator used to calculate taxes and fees. (e.g., 500 means 5%).
    uint256 private constant TAX_DENOMINATOR = 10000;

    /// @notice Standard precision used to compute reflection rates and multiplications.
    uint256 private constant PRECISION = 1e18;

    // -------------------------------------------------------------------------
    // Internal Mappings and State Variables
    // -------------------------------------------------------------------------

    /**
     * @notice Addresses that are allowed to trade when trading is turned off.
     *         Also used for certain owner-specific privileges.
     */
    EnumerableSet.AddressSet private _excludedAddresses;

    /**
     * @notice Addresses restricted by AntiBot measures.
     */
    EnumerableSet.AddressSet private _antiBotAddresses;

    /**
     * @notice Maps addresses to a bool indicating if they are excluded from paying taxes (burn/foundation).
     */
    mapping(address => bool) public isExcludedFromTax;

    /**
     * @notice Maps addresses to their allocated token balances that can be released (minted) in the future.
     */
    mapping(address => uint256) private _tokenAllocationBalances;

    // -------------------------------------------------------------------------
    // Configuration Variables
    // -------------------------------------------------------------------------

    /// @notice The wallet where foundation fees are sent.
    address public foundationWallet;

    /// @notice The foundation fee rate (out of `TAX_DENOMINATOR`).
    uint256 public foundationFee;

    /// @notice Address of the Uniswap V2 pair for this token, set once by the owner.
    address public uniswapV2Pair;

    /// @notice Flag indicating that the pair has been set successfully, preventing multiple sets.
    bool public pairIsSet;

    /// @notice Burn tax rate, out of `TAX_DENOMINATOR`.
    uint256 public burnTax;

    /// @notice Boolean indicating if normal trading is enabled. If false, only `_excludedAddresses` can transfer.
    bool public tradingEnabled;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /**
     * @notice Emitted when burn or foundation fees are updated.
     * @param burnTax Updated burn tax rate.
     * @param foundationFee Updated foundation fee.
     */
    event TaxConfigUpdated(uint256 burnTax, uint256 foundationFee);

    /**
     * @notice More detailed breakdown event emitted whenever tax config is updated.
     * @param burnTax Updated burn tax rate.
     * @param foundationFee Updated foundation fee.
     * @param totalTax Sum of all taxes combined.
     * @param timestamp Current timestamp when the update occurred.
     */
    event DetailedTaxUpdate(
        uint256 burnTax,
        uint256 foundationFee,
        uint256 totalTax,
        uint256 timestamp
    );

    /**
     * @notice Emitted when trading is enabled/disabled by the owner.
     * @param enabled True if trading is turned on, false if turned off.
     */
    event TradingStatusUpdated(bool enabled);

    /**
     * @notice Emitted whenever an address is added or removed from the AntiBot list.
     * @param account Address that was added/removed from AntiBot measures.
     * @param restricted True if restricted, false if removed.
     */
    event AntiBotStatusUpdated(address indexed account, bool restricted);

    /**
     * @notice Emitted when the Uniswap V2 Pair is set for this token.
     * @param pair The pair address that was set.
     */
    event UniswapV2PairSet(address indexed pair);

    /**
     * @notice Emitted when the foundation wallet is changed.
     * @param oldWallet The previous foundation wallet.
     * @param newWallet The new foundation wallet.
     */
    event FoundationWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );

    /**
     * @notice Emitted when a token allocation is initiated for an address.
     * @param account Address for which the token allocation is allocated.
     * @param amount Number of tokens added to token allocation balance.
     * @param reason A short note explaining the purpose.
     */
    event TokensAllocated(
        address indexed account,
        uint256 amount,
        string reason
    );

    /**
     * @notice Emitted when a token allocation is revoked.
     * @param account Address whose token allocation is revoked.
     * @param amount Number of tokens revoked.
     */
    event TokenAllocationRevoked(address indexed account, uint256 amount);

    /**
     * @notice Emitted when a previously allocated balance is officially minted.
     * @param account Address receiving the newly minted tokens.
     * @param amount Number of tokens minted.
     */
    event TokensReleasedFromAllocation(address indexed account, uint256 amount);

    /**
     * @notice Emitted when tokens (non-native) are withdrawn from the contract by the owner.
     * @param token Address of the token withdrawn.
     * @param amount Number of tokens withdrawn.
     * @param to Recipient address of the withdrawn tokens.
     */
    event TokenWithdrawn(
        address indexed token,
        uint256 amount,
        address indexed to
    );

    /**
     * @notice Emitted when native ETH is withdrawn from the contract by the owner.
     * @param amount The amount of ETH withdrawn.
     * @param to The recipient address.
     */
    event ETHWithdrawn(uint256 amount, address indexed to);

    /**
     * @notice Emitted when an address is excluded/included from paying tax.
     * @param account Address updated.
     * @param excluded True if excluded from tax, false otherwise.
     */
    event TaxExclusionUpdated(address indexed account, bool excluded);

    // -------------------------------------------------------------------------
    // Custom Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown when attempting to trade while trading is disabled
    error TradingNotEnabled();

    /// @notice Thrown when a restricted address attempts to perform a transaction
    error RestrictedByAntiBot();

    /// @notice Thrown when trying to transfer tokens while the contract is paused
    error ERC20Pausable__TokenPaused();

    /// @notice Thrown when attempting to set a pair address when one is already set
    error PairAlreadySet();

    /// @notice Thrown when attempting to set an invalid pair address
    error InvalidPairAddress();

    /// @notice Thrown when a non-Uniswap router attempts a restricted operation
    error NotUniswapRouter();

    /// @notice Thrown when attempting to set an invalid foundation wallet address
    error InvalidFoundationWallet();

    /// @notice Thrown when array lengths don't match in batch operations
    error ArrayLengthMismatch();

    /// @notice Thrown when tax configuration would exceed 100%
    error TaxesTooHigh(uint256 totalTax, uint256 maxAllowed);

    /// @notice Thrown when attempting operations with zero address
    error ZeroAddressTokenAllocation();

    /// @notice Thrown when attempting operations with zero amount
    error ZeroAmount();

    /// @notice Thrown when attempting to exclude an already excluded address
    /// @param account The address that is already excluded
    error AlreadyExcluded(address account);

    /// @notice Thrown when attempting to remove an address that isn't excluded
    /// @param account The address that isn't excluded
    error NotExcluded(address account);

    /// @notice Thrown when using an invalid address
    error InvalidAddress();

    /// @notice Thrown when attempting to include an address that isn't excluded from tax
    error NotExcludedFromTax();

    /// @notice Thrown when attempting to withdraw LP tokens
    error InvalidLPWithdrawal();

    /// @notice Thrown when attempting invalid token withdrawal
    error InvalidWithdrawal();

    /// @notice Thrown when ETH transfer fails
    error FailedETHTransfer();

    /// @notice Thrown when attempting to release more tokens than allocated
    error InsufficientAllocationBalance(uint256 requested, uint256 available);

    // -------------------------------------------------------------------------
    // Constructor (Prevent Implementation Initialization)
    // -------------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Disable initializer to prevent implementation contract misuse.
        _disableInitializers();
    }

    // -------------------------------------------------------------------------
    // Initialization
    // -------------------------------------------------------------------------

    /**
     * @notice Initializes the contract, setting the initial owner and minting the initial supply.
     * @dev    This follows the upgradeable pattern (instead of a constructor).
     * @param initialOwner The address that will receive ownership and the initial supply.
     */
    function initialize(address initialOwner) public initializer {
        if (initialOwner == address(0)) revert InvalidAddress();

        __ReentrancyGuard_init();
        __ERC20_init("Aquari", "AQUARI");
        __Ownable_init(initialOwner);
        __ERC20Permit_init_unchained("Aquari");
        __ERC20Pausable_init_unchained();
        __ERC20Burnable_init_unchained();

        // Set default taxes
        burnTax = 0; // 0%
        foundationFee = 900; // 9%

        // Configure foundation wallet
        foundationWallet = 0x13B9110A72A8D08A4c08c411143AEDbf0c3FC235;
        if (foundationWallet == address(0)) revert InvalidFoundationWallet();

        // Enable trading by default
        tradingEnabled = true;
        pairIsSet = false;

        // Exclude critical addresses from trading checks (they can always transfer)
        require(
            _excludedAddresses.add(initialOwner),
            "Fail exclude initialOwner"
        );
        require(_excludedAddresses.add(address(this)), "Fail exclude contract");
        require(
            _excludedAddresses.add(address(0)),
            "Fail exclude zero address"
        );

        // Mint the entire initial supply to the owner
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    // -------------------------------------------------------------------------
    // Owner-Only Functions
    // -------------------------------------------------------------------------

    /**
     * @notice Allows the owner to set a new foundation wallet.
     * @param newWallet The new foundation wallet address.
     */
    function setFoundationWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert InvalidFoundationWallet();
        address oldWallet = foundationWallet;
        foundationWallet = newWallet;
        emit FoundationWalletUpdated(oldWallet, newWallet);
    }

    /**
     * @notice Sets the Uniswap V2 pair address for this token, used to detect trades.
     * @dev    Can only be set once (pairIsSet).
     * @param newPairAddress The address of the newly created Uniswap V2 pair.
     */
    function setUniswapV2Pair(address newPairAddress) external onlyOwner {
        if (pairIsSet) revert PairAlreadySet();
        if (newPairAddress == address(0)) revert InvalidPairAddress();

        uniswapV2Pair = newPairAddress;
        pairIsSet = true;
        emit UniswapV2PairSet(newPairAddress);
    }

    /**
     * @notice Allows the owner to update the burn tax and foundation fee.
     *         The sum cannot exceed TAX_DENOMINATOR (100%).
     * @param newBurnTax New burn tax (out of 10,000).
     * @param newFoundationFee New foundation fee (out of 10,000).
     */
    function setTaxConfig(
        uint256 newBurnTax,
        uint256 newFoundationFee
    ) external onlyOwner {
        if (newBurnTax + newFoundationFee > TAX_DENOMINATOR) {
            revert TaxesTooHigh(newBurnTax + newFoundationFee, TAX_DENOMINATOR);
        }
        burnTax = newBurnTax;
        foundationFee = newFoundationFee;

        emit TaxConfigUpdated(newBurnTax, newFoundationFee);
        emit DetailedTaxUpdate(
            newBurnTax,
            newFoundationFee,
            newBurnTax + newFoundationFee,
            block.timestamp
        );
    }

    /**
     * @notice Toggles trading availability for non-excluded addresses.
     * @param newTradingStatus True to enable public trading, false to disable.
     */
    function setTradingEnabled(bool newTradingStatus) external onlyOwner {
        tradingEnabled = newTradingStatus;
        emit TradingStatusUpdated(newTradingStatus);
    }

    /**
     * @notice Adds or removes an address from AntiBot restrictions, preventing/enabling its transfers.
     * @param account Address to update in the AntiBot system.
     * @param restricted True to add restrictions, false to remove.
     */
    function setAntiBotRestriction(
        address account,
        bool restricted
    ) external onlyOwner {
        if (account == address(0)) revert ZeroAddressTokenAllocation();

        if (restricted) {
            if (!_antiBotAddresses.add(account))
                revert AlreadyExcluded(account);
        } else {
            if (!_antiBotAddresses.remove(account)) revert NotExcluded(account);
        }
        emit AntiBotStatusUpdated(account, restricted);
    }

    /**
     * @notice Excludes an address from paying the burn/foundation taxes.
     * @param account Address to exclude from tax.
     */
    function excludeFromTax(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddressTokenAllocation();
        if (isExcludedFromTax[account]) revert AlreadyExcluded(account);

        isExcludedFromTax[account] = true;
        emit TaxExclusionUpdated(account, true);
    }

    /**
     * @notice Re-includes an address so that it must pay taxes again.
     * @param account Address to include back into tax calculations.
     */
    function includeInTax(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddressTokenAllocation();
        if (!isExcludedFromTax[account]) revert NotExcludedFromTax();

        isExcludedFromTax[account] = false;
        emit TaxExclusionUpdated(account, false);
    }

    /**
     * @notice Owner can withdraw any non-native tokens from this contract.
     *         Cannot withdraw the token’s own liquidity pair tokens (uniswapV2Pair).
     * @param token The address of the ERC20 token to withdraw.
     * @param amount The number of tokens to withdraw.
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (token == address(this)) revert InvalidWithdrawal();
        if (token == uniswapV2Pair) revert InvalidLPWithdrawal();

        IERC20(token).safeTransfer(owner(), amount);
        emit TokenWithdrawn(token, amount, owner());
    }

    /**
     * @notice Owner can withdraw any native ETH balance from this contract.
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();

        (bool success, ) = owner().call{value: balance}("");
        if (!success) revert FailedETHTransfer();
        emit ETHWithdrawn(balance, owner());
    }

    /**
     * @notice Overrides the default renounceOwnership to forbid it.
     */
    function renounceOwnership() public virtual override onlyOwner {
        revert("Ownership Contract cannot be renounced");
    }

    // Detect if Trade is a Uniswap Trade
    function isUniswapV2Trade(
        address from,
        address to
    ) private view returns (bool) {
        return (from == uniswapV2Pair || to == uniswapV2Pair) && pairIsSet;
    }

    // -------------------------------------------------------------------------
    // ERC20 Overrides
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the balance of a given address.
     * @param account Address to get balance for.
     * @return The balance of `account`.
     */
    function balanceOf(
        address account
    ) public view override(ERC20Upgradeable) returns (uint256) {
        return super.balanceOf(account);
    }

    /**
     * @notice Internal hook overriding OpenZeppelin’s `_update` to integrate custom checks
     *         for taxes, AntiBot, and pausing.
     * @param from The sender address.
     * @param to The recipient address.
     * @param amount Number of tokens to be transferred.
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20Upgradeable, ERC20PausableUpgradeable) {
        if (amount == 0) revert ZeroAmount();
        if (paused()) revert ERC20Pausable__TokenPaused();

        // If trading is not enabled, only _excludedAddresses can transact
        if (
            !tradingEnabled &&
            !_excludedAddresses.contains(from) &&
            !_excludedAddresses.contains(to)
        ) {
            revert TradingNotEnabled();
        }

        // AntiBot checks
        if (
            _antiBotAddresses.contains(from) || _antiBotAddresses.contains(to)
        ) {
            revert RestrictedByAntiBot();
        }

        // Mint or burn
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }

        // Check if this is a taxed Uniswap trade
        bool isUniswapTrade = (from == uniswapV2Pair || to == uniswapV2Pair) &&
            pairIsSet;

        if (
            isUniswapTrade &&
            !_excludedAddresses.contains(from) &&
            !_excludedAddresses.contains(to) &&
            !isExcludedFromTax[from] &&
            !isExcludedFromTax[to]
        ) {
            // Calculate taxes
            uint256 burnAmount = (amount * burnTax) / TAX_DENOMINATOR;
            uint256 foundationAmount = (amount * foundationFee) /
                TAX_DENOMINATOR;
            uint256 transferAmount = amount - burnAmount - foundationAmount;

            // Burn tokens
            if (burnAmount > 0) {
                super._update(from, address(0), burnAmount);
            }

            // Foundation fee
            if (foundationAmount > 0) {
                super._update(from, foundationWallet, foundationAmount);
            }

            // Actual transfer
            if (transferAmount > 0) {
                super._update(from, to, transferAmount);
            }
        } else {
            // Standard transfer without fees
            super._update(from, to, amount);
        }
    }

    /**
     * @notice Atomically increases the allowance granted to `spender` by the caller.
     * @param spender The address which will spend the funds.
     * @param addedValue The additional number of tokens (in 18 decimals) to allow.
     * @return A boolean value indicating whether the operation succeeded.
     */
    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public returns (bool) {
        // Compute the new allowance amount for the spender.
        uint256 newAllowance = allowance(_msgSender(), spender) + addedValue;
        // Update the allowance using the internal _approve method.
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    /**
     * @notice Atomically decreases the allowance granted to `spender` by the caller.
     * @param spender The address which will spend the funds.
     * @param subtractedValue The number of tokens (in 18 decimals) to subtract from the current allowance.
     * @return A boolean value indicating whether the operation succeeded.
     */
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public returns (bool) {
        uint256 currentAllowance = allowance(_msgSender(), spender);
        // Ensure the current allowance is sufficient for the subtraction.
        if (subtractedValue > currentAllowance) {
            revert("ERC20: decreased allowance below zero");
        }
        uint256 newAllowance = currentAllowance - subtractedValue;
        // Update the allowance using the internal _approve method.
        _approve(_msgSender(), spender, newAllowance);
        return true;
    }

    // -------------------------------------------------------------------------
    // Token Allocation
    // -------------------------------------------------------------------------

    /**
     * @notice Allows the owner to add a mapped token allocation balance to an address.
     * @param account Address for which the token allocation is set.
     * @param amount Number of tokens to allocate (1 = 1 token).
     * @param reason Short string explaining the purpose of this allocation.
     */
    function allocateTokens(
        address account,
        uint256 amount,
        string memory reason
    ) external onlyOwner {
        if (account == address(0)) revert ZeroAddressTokenAllocation();
        if (amount == 0) revert ZeroAmount();
        if (_antiBotAddresses.contains(account)) revert RestrictedByAntiBot();

        uint256 scaledAmount = amount * 10 ** DECIMALS; // Scale the input amount to 18 decimals
        _tokenAllocationBalances[account] += scaledAmount;
        emit TokensAllocated(account, scaledAmount, reason);
    }

    /**
     * @notice Batch variant of allocateTokens, allocating tokens for multiple addresses at once.
     * @param accounts Array of addresses to receive tokens.
     * @param amounts Corresponding array of token amounts (1 = 1 token).
     * @param reason Explanation for these allocations.
     */
    function batchAllocateTokens(
        address[] calldata accounts,
        uint256[] calldata amounts,
        string memory reason
    ) external onlyOwner {
        if (accounts.length != amounts.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) revert ZeroAddressTokenAllocation();
            if (amounts[i] == 0) revert ZeroAmount();
            if (_antiBotAddresses.contains(accounts[i]))
                revert RestrictedByAntiBot();

            uint256 scaledAmount = amounts[i] * 10 ** DECIMALS;
            _tokenAllocationBalances[accounts[i]] += scaledAmount;
            emit TokensAllocated(accounts[i], scaledAmount, reason);
        }
    }

    /**
     * @notice Converts previously allocated tokens into actual minted tokens for a single address.
     * @dev    The contract’s total supply is increased.
     * @param account Address to receive the newly minted tokens.
     * @param amount Number of tokens to convert from allocation to real supply (1 = 1 token).
     */
    function releaseAllocatedTokens(
        address account,
        uint256 amount
    ) external onlyOwner nonReentrant {
        uint256 scaledAmount = amount * 10 ** DECIMALS;

        if (_tokenAllocationBalances[account] < scaledAmount) {
            revert InsufficientAllocationBalance(
                scaledAmount,
                _tokenAllocationBalances[account]
            );
        }
        if (_antiBotAddresses.contains(account)) revert RestrictedByAntiBot();
        if (amount == 0) revert ZeroAmount();

        _tokenAllocationBalances[account] -= scaledAmount;
        _mint(account, scaledAmount);

        emit TokensReleasedFromAllocation(account, scaledAmount);
    }

    /**
     * @notice Batch variant of releaseAllocatedTokens, converting allocated tokens into real supply for multiple addresses.
     * @param accounts Array of addresses to mint tokens for.
     * @param amounts Corresponding array of token amounts to convert from allocation (1 = 1 token).
     */
    function batchReleaseAllocatedTokens(
        address[] calldata accounts,
        uint256[] calldata amounts
    ) external onlyOwner nonReentrant {
        if (accounts.length != amounts.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            uint256 scaledAmount = amounts[i] * 10 ** DECIMALS;

            if (_tokenAllocationBalances[accounts[i]] < scaledAmount) {
                revert InsufficientAllocationBalance(
                    scaledAmount,
                    _tokenAllocationBalances[accounts[i]]
                );
            }
            if (_antiBotAddresses.contains(accounts[i]))
                revert RestrictedByAntiBot();
            if (amounts[i] == 0) revert ZeroAmount();

            _tokenAllocationBalances[accounts[i]] -= scaledAmount;
            _mint(accounts[i], scaledAmount);

            emit TokensReleasedFromAllocation(accounts[i], scaledAmount);
        }
    }

    /**
     * @notice View the allocated (unminted) balance set for a specific address.
     * @param account Address to query.
     * @return The number of tokens allocated but not yet released (in 18 decimals).
     */
    function getAllocatedBalance(
        address account
    ) external view returns (uint256) {
        return _tokenAllocationBalances[account];
    }

    /**
     * @notice Returns the total amount of tokens allocated across all addresses.
     * @return The sum of all allocated but unreleased tokens (in 18 decimals).
     */
    function getTotalAllocatedTokens() external view returns (uint256) {
        uint256 totalAllocated;
        for (uint256 i = 0; i < _excludedAddresses.length(); i++) {
            totalAllocated += _tokenAllocationBalances[
                _excludedAddresses.at(i)
            ];
        }
        return totalAllocated;
    }

    /**
     * @notice Checks if an address has any allocated tokens.
     * @param account Address to check.
     * @return True if the address has allocated tokens, false otherwise.
     */
    function isAddressAllocated(address account) external view returns (bool) {
        return _tokenAllocationBalances[account] > 0;
    }

    /**
     * @notice Reduces the token allocation balance from an address, effectively canceling a previously allocated amount.
     * @param account Address whose token allocation is being revoked.
     * @param amount Number of allocated tokens to revoke (1 = 1 token).
     */
    function revokeTokenAllocation(
        address account,
        uint256 amount
    ) external onlyOwner {
        uint256 scaledAmount = amount * 10 ** DECIMALS;

        if (_tokenAllocationBalances[account] < scaledAmount) {
            revert InsufficientAllocationBalance(
                scaledAmount,
                _tokenAllocationBalances[account]
            );
        }
        if (amount == 0) revert ZeroAmount();

        _tokenAllocationBalances[account] -= scaledAmount;
        emit TokenAllocationRevoked(account, scaledAmount);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /**
     * @notice Checks if an address is restricted by AntiBot measures.
     * @param account Address to check.
     * @return True if the address is restricted, otherwise false.
     */
    function isBotRestricted(address account) external view returns (bool) {
        return _antiBotAddresses.contains(account);
    }

    /**
     * @notice Returns the total number of addresses that are always allowed to trade even if trading is disabled.
     * @return The count of such addresses in the set.
     */
    function getExcludedAddressCount() external view returns (uint256) {
        return _excludedAddresses.length();
    }

    /**
     * @notice Returns a list of all addresses that can trade when trading is disabled.
     * @return An array of excluded addresses.
     */
    function getExcludedAddresses() external view returns (address[] memory) {
        return _excludedAddresses.values();
    }

    // -------------------------------------------------------------------------
    // ERC20Permit Overrides
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the current nonce for a given owner for EIP-2612 permit signatures.
     * @param owner The address to query nonces for.
     * @return The current nonce for `owner`.
     */
    function nonces(
        address owner
    ) public view virtual override(ERC20PermitUpgradeable) returns (uint256) {
        return super.nonces(owner);
    }

    /**
     * @notice Returns the domain separator for the EIP-2612 permit system.
     * @return The domain separator hash.
     */
    function DOMAIN_SEPARATOR() public view virtual override returns (bytes32) {
        return _domainSeparatorV4();
    }

    // -------------------------------------------------------------------------
    // Fallback and Receive
    // -------------------------------------------------------------------------

    /**
     * @notice Fallback function to receive ETH.
     *         Used if someone sends ETH directly to the contract.
     */
    receive() external payable {}

    /**
     * @dev This storage gap is used for future variable additions to avoid
     *      shifting the existing storage layout in an upgrade scenario.
     */
    uint256[50] private __gap;
}
