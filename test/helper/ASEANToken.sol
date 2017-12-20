pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/StandardToken.sol";

/**
 * A basic token for testing the HashedTimelockERC20.
 */
contract ASEANToken is StandardToken {
    string public constant name = "ASEAN Token";
    string public constant symbol = "ASEAN";
    uint8 public constant decimals = 18;
    
    function ASEANToken(uint _initialBalance) public {
        balances[msg.sender] = _initialBalance;
        totalSupply = _initialBalance;
    }
}
