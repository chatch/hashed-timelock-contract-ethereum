pragma solidity ^0.4.15;

import "zeppelin-solidity/contracts/token/ERC20.sol";

/**
 * @title Hash Time Lock Contracts for Tokens.
 *
 * A contract that provides an implementation of Hashed Timelock Contracts for
 * ERC20 tokens.
 *
 *  Protocol is as follows:
 *
 *  1) A contract is created by calling newContract with the terms of the
 *      contract including the time lock expiry and the hash lock hash.
 *  2) Funds can be unlocked by the specified reciever when they know the hash
 *      preimage by calling withdraw().
 *  3) In the event that funds were not unlocked by the receiver, the sender /
 *      contract creater can get a refund by calling refund() some time after
 *      the time lock has expired.
 */
contract HashedTimelockERC20 {
    event LogNewContract(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint amount,
        bytes32 hashlock,
        uint timelock
    );
    event LogContractPayed(bytes32 indexed contractId);
    event LogContractRefunded(bytes32 indexed contractId);

    struct LockContract {
        address sender;
        address receiver;
        address token;
        uint amount;
        bytes32 hashlock;
        uint timelock; // UNIX timestamp seconds - locked UNTIL this time
        bool withdrawn;
        bool refunded;
        bytes32 preimage;
    }

    modifier tokensTransferable(address _token, address _sender, uint _amount) {
        require(_amount > 0);
        require(ERC20(_token).allowance(_sender, this) >= _amount);
        _;
    }
    modifier futureTimelock(uint _time) {
        // only requirement is the timelock time is after the last blocktime (now).
        // probably want something a bit further in the future then this.
        // but this is still a useful sanity check:
        require(_time > now);
        _;
    }
    modifier contractExists(bytes32 _contractId) {
        require(haveContract(_contractId));
        _;
    }
    modifier hashlockMatches(bytes32 _contractId, bytes32 _x) {
        require(contracts[_contractId].hashlock == sha256(_x));
        _;
    }
    modifier withdrawable(bytes32 _contractId) {
        require(contracts[_contractId].receiver == msg.sender);
        require(contracts[_contractId].withdrawn == false);
        require(contracts[_contractId].timelock > now);
        _;
    }
    modifier refundable(bytes32 _contractId) {
        require(contracts[_contractId].sender == msg.sender);
        require(contracts[_contractId].refunded == false);
        require(contracts[_contractId].withdrawn == false);
        require(contracts[_contractId].timelock <= now);
        _;
    }

    mapping (bytes32 => LockContract) contracts;

    /**
     * Sender / Payer sets up a new hash time lock contract depositing the
     * funds and providing the reciever and terms.
     *
     * @param _receiver Receiver of hash time locked funds
     * @param _hashlock Hash lock for which the reciever must provide the preimage for.
     * @param _timelock Refunds can be made after this time
     * @param _token ERC20 Token contract address
     * @param _amount Amount of the token to lock up
     */
    function newContract(
        address _receiver,
        bytes32 _hashlock,
        uint _timelock,
        address _token,
        uint _amount
    )
        external
        tokensTransferable(_token, msg.sender, _amount)
        futureTimelock(_timelock)
        returns (bytes32 contractId)
    {
        contractId = sha256(
            msg.sender,
            _receiver,
            _token,
            _amount,
            _hashlock,
            _timelock
        );

        // Reject if a contract already exists with the same parameters. The
        // sender must change one of these parameters (ideally providing a
        // different _hashlock).
        if (haveContract(contractId))
            revert();

        // This contract becomes the temporary owner of the tokens
        if (!ERC20(_token).transferFrom(msg.sender, this, _amount))
            revert();
            
        contracts[contractId] = LockContract(
            msg.sender,
            _receiver,
            _token,
            _amount,
            _hashlock,
            _timelock,
            false,
            false,
            0x0
        );

        LogNewContract(
            contractId,
            msg.sender,
            _receiver,
            _token,
            _amount,
            _hashlock,
            _timelock
        );
    }

    /**
     * Called by the receiver once they know the preimage. This will transfer
     * the locked funds to their address..
     *
     * @param _contractId Id of contract to withdraw from.
     * @param _preimage sha256(_preimage) should equal the contract hashlock
     */
    function withdraw(bytes32 _contractId, bytes32 _preimage)
        external
        contractExists(_contractId)
        withdrawable(_contractId)
        hashlockMatches(_contractId, _preimage)
        returns (bool)
    {
        LockContract storage c = contracts[_contractId];
        c.preimage = _preimage;
        c.withdrawn = true;
        ERC20(c.token).transfer(c.receiver, c.amount);
        LogContractPayed(_contractId);
        return true;
    }

    /**
     * Called by the sender if there was no withdraw AND the time lock has
     * expired. This will refund the contract amount.
     *
     * @param _contractId Id of contract to refund from.
     */
    function refund(bytes32 _contractId)
        external
        contractExists(_contractId)
        refundable(_contractId)
        returns (bool)
    {
        LockContract storage c = contracts[_contractId];
        c.refunded = true;
        ERC20(c.token).transfer(c.sender, c.amount);
        LogContractRefunded(_contractId);
        return true;
    }

    /**
     * Get contract details.
     *
     * @param _contractId Return details of this contract
     */
    function getContract(bytes32 _contractId)
        constant
        returns (
            address sender,
            address receiver,
            address token,
            uint amount,
            bytes32 hashlock,
            uint timelock,
            bool withdrawn,
            bool refunded,
            bytes32 preimage
        )
    {
        if (haveContract(_contractId) == false)
            return;
        LockContract storage c = contracts[_contractId];
        return (
            c.sender,
            c.receiver,
            c.token,
            c.amount,
            c.hashlock,
            c.timelock,
            c.withdrawn,
            c.refunded,
            c.preimage
        );
    }

    function haveContract(bytes32 _contractId)
        internal
        returns (bool exists)
    {
        exists = (contracts[_contractId].sender != address(0));
    }

}
