# Voting contract

A pack of contracts that allows users to vote for proposals, using token balances. Users own an ERC20 token, representing “voting power” or DAO ownership shares. Proposals are simply the keccak256 hashes and can be “accepted”, “rejected” or “discarded” (if TTL of proposal is expired). The fact of acceptance of a proposal is fixed in the event, nothing else is stored in contracts.

Requirements: 
- During creation totalSupply = 100.000000 (decimals = 6) tokens are minted to contract owner
- Any owner of voting tokens can create a proposal, time-to-live(TTL) of proposal is 3 days, after that time proposal becomes “discarded” if not enough votes are gathered
- Votes can be “for” or ”against” the proposal. Proposal becomes “accepted” or “declined” completed if > 50% of votes for the same decision (“for” or “against”) is gathered
- When votes threshold is reached, event is emitted and proposal is removed from queue
- There are no more than N=3 current proposals, new proposals cannot be added until old ones will be “accepted”, “declined” or “discarded” by TTL
- If > 1 old proposals are obsolete, then addition of a new proposal automatically “kicks out” the most obsolete proposal, making it “discarded”.
- voting should not “freeze” tokens
- but, voting should handle a situation, when voter transfers his tokens to another address and votes another time

## Building and running:
Preliminary add your ```ALCHEMY_KEY``` to environment variables.
```
npm i
npx hardhat test
```

## Logging output

```
Voting
    ✔ Decimals is 6 (3367ms)
    ✔ Total supply is 100000000
    ✔ addrA has 25% of total supply (228ms)
    ✔ addrB has 40% of total supply
    ✔ addrC has 35% of total supply
    ✔ addrEmpty has 0% of total supply
    ✔ Proposal is reverted because non-holder tried to create it
    ✔ Vote is reverted because there is not enough tokens to do it
    ✔ Vote is reverted because proposal does not exist
    ✔ Proposal was accepted
    ✔ Fourth proposal was reverted
    ✔ Fourth proposal was not reverted after ttl has expired, obsolete proposal was kicked out
    ✔ Proposal was removed afted it had been accepted
    ✔ Tokens were not freezed after voting
    ✔ Can not vote for proposal twice
    ✔ Can vote twice by transferring tokens
    ✔ Can not vote for proposal twice by transferring tokens
```