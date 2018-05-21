pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

/**
 * A basic token for testing the HashedTimelockERC20.
 */
contract ASEANToken is StandardToken {
    string public constant name = "ASEAN Token";
    string public constant symbol = "ASEAN";
    uint8 public constant decimals = 18;
    
    constructor(uint _initialBalance) public {
        balances[msg.sender] = _initialBalance;
    }
}
