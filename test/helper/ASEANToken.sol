pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 * A basic token for testing the HashedTimelockERC20.
 */
contract ASEANToken is ERC20 {
    string public constant name = "ASEAN Token";
    string public constant symbol = "ASEAN";
    uint8 public constant decimals = 18;

    constructor(uint256 _initialBalance) public {
        _mint(msg.sender, _initialBalance);
    }
}
