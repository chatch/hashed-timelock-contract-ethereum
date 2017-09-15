# hashed-timelock-contract-ethereum
An implementation of a Hashed Timelock Contract on Ethereum

Use this contract for creating locks on the ETH side of a cross chain atomic swap.

## Protocol

1. A contract is created by calling newContract() with the time lock expiry, hash lock hash and receivers address.
2. Funds can be unlocked by the reciever when they know the hash preimage by calling withdraw().
3. In the event that the funds were not unlocked by the receiver, the sender (contract creater) can get a refund by calling refund() some time after the time lock has expired.
