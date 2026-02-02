// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AquariMock
 * @notice Simplified mock contract for unit testing fee logic
 * @dev This is NOT the real contract - it's a simplified version for testing
 *      that avoids OpenZeppelin upgrades plugin validation issues.
 *
 *      Key differences from mainnet:
 *      - Not upgradeable (simpler for testing)
 *      - No ERC20Permit
 *      - Same fee logic as mainnet
 */
contract AquariMock is ERC20, Ownable {
    // ═══════════════════════════════════════════════════════════════════════════
    // CUSTOM ERRORS
    // ═══════════════════════════════════════════════════════════════════════════
    error PairAlreadySet();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════
    uint256 public burnTax;
    uint256 public foundationFee;
    address public foundationWallet;
    address public uniswapV2Pair;
    bool public pairIsSet;
    bool public tradingEnabled;

    mapping(address => bool) private _excludedFromTax;
    address[] private _excludedAddresses;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    event TaxConfigUpdated(uint256 burnTax, uint256 foundationFee);
    event FoundationWalletUpdated(address newWallet);
    event PairAddressSet(address pair);
    event AddressExcluded(address account);
    event AddressIncluded(address account);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    constructor(address initialOwner) ERC20("Aquari Mock", "AQMOCK") Ownable(initialOwner) {
        // Mint initial supply to owner
        _mint(initialOwner, 1_000_000_000 * 10**18); // 1B tokens

        // Enable trading
        tradingEnabled = true;

        // Exclude owner and contract from tax
        _excludedFromTax[initialOwner] = true;
        _excludedAddresses.push(initialOwner);
        _excludedFromTax[address(this)] = true;
        _excludedAddresses.push(address(this));

        // Set foundation wallet to owner initially
        foundationWallet = initialOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OWNER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    function setTaxConfig(uint256 newBurnTax, uint256 newFoundationFee) external onlyOwner {
        burnTax = newBurnTax;
        foundationFee = newFoundationFee;
        emit TaxConfigUpdated(newBurnTax, newFoundationFee);
    }

    function setFoundationWallet(address newWallet) external onlyOwner {
        if (newWallet == address(0)) revert ZeroAddress();
        foundationWallet = newWallet;
        emit FoundationWalletUpdated(newWallet);
    }

    function setUniswapV2Pair(address newPairAddress) external onlyOwner {
        if (pairIsSet) revert PairAlreadySet();
        if (newPairAddress == address(0)) revert ZeroAddress();
        uniswapV2Pair = newPairAddress;
        pairIsSet = true;
        emit PairAddressSet(newPairAddress);
    }

    function excludeFromTax(address account) external onlyOwner {
        if (!_excludedFromTax[account]) {
            _excludedFromTax[account] = true;
            _excludedAddresses.push(account);
            emit AddressExcluded(account);
        }
    }

    function includeInTax(address account) external onlyOwner {
        if (_excludedFromTax[account]) {
            _excludedFromTax[account] = false;
            // Remove from array
            for (uint256 i = 0; i < _excludedAddresses.length; i++) {
                if (_excludedAddresses[i] == account) {
                    _excludedAddresses[i] = _excludedAddresses[_excludedAddresses.length - 1];
                    _excludedAddresses.pop();
                    break;
                }
            }
            emit AddressIncluded(account);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    function isExcludedFromTax(address account) external view returns (bool) {
        return _excludedFromTax[account];
    }

    function getExcludedAddresses() external view returns (address[] memory) {
        return _excludedAddresses;
    }

    function paused() external pure returns (bool) {
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSFER OVERRIDE
    // ═══════════════════════════════════════════════════════════════════════════
    function _update(address from, address to, uint256 amount) internal override {
        // Check if fees should apply
        bool shouldTakeFee = pairIsSet &&
            !_excludedFromTax[from] &&
            !_excludedFromTax[to];

        if (shouldTakeFee) {
            uint256 burnAmount = (amount * burnTax) / 10000;
            uint256 foundationAmount = (amount * foundationFee) / 10000;
            uint256 totalFee = burnAmount + foundationAmount;
            uint256 netAmount = amount - totalFee;

            // Burn
            if (burnAmount > 0) {
                super._update(from, address(0), burnAmount);
            }

            // Foundation fee
            if (foundationAmount > 0) {
                super._update(from, foundationWallet, foundationAmount);
            }

            // Transfer net amount
            super._update(from, to, netAmount);
        } else {
            // No fees
            super._update(from, to, amount);
        }
    }
}
