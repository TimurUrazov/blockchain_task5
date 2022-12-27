// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

/**
 * Contract for voting on proposals which allows to create them up to 3 at the same time.
 * Proposal is created by holder of tokens and can be voted for or against. 
 * Proposal is accepted if more than 50% of tokens voted for it and declined if more than 50% voted against.
 * Proposal is discarded if it is not accepted or declined in 3 days.
 *
 * @author Timur Urazov
 */
contract Voting is ERC20 {
    /**
     * Event emitted when proposal is discarded.
     * 
     * @param id id of discarded proposal
     */
    event ProposalDiscarded(uint256 id);

    /**
     * Event emitted when proposal is accepted.
     * 
     * @param id id of accepted proposal
     */
    event ProposalAccepted(uint256 id);

    /**
     * Event emitted when proposal is declined.
     * 
     * @param id id of declined proposal
     */
    event ProposalDeclined(uint256 id);

    /**
     * Modifier which allows to call function only by holder of tokens.
     */
    modifier onlyHolder() {
        require(balanceOf(msg.sender) != 0, "Only holders can create proposals");
        _;
    }

    /**
     * Enum for vote status.
     */
    enum VOTE_STATUS {
        FOR,
        AGAINST
    }

    /**
     * Struct for proposal.
     */
    struct Proposal {
        /**
         * Proposer of proposal.
         */
        address proposer;

        /**
         * Document which is proposed. It is represented by hash of text.
         */
        uint256 document;

        /**
         * Id of proposal.
         */
        uint256 id;

        /**
         * Time to live of proposal. Proposal is discarded if it is not accepted or declined in 3 days.
         */
        uint256 ttl;

        /**
         * Amount of votes for proposal.
         */
        uint256 votesFor;

        /**
         * Amount of votes against proposal.
         */
        uint256 votesAgainst;

        /**
         * Mapping of votes for proposal.
         */
        mapping (address => Vote) votes;
    }

    /**
     * Struct for vote.
     */
    struct Vote {
        /**
         * Amount of tokens voted.
         */
        uint256 amount;

        /**
         * Status of vote.
         */
        VOTE_STATUS vote;
    }

    /**
     * Time to live of proposal. Proposal is discarded if it is not accepted or declined in 3 days.
     */
    uint256 constant TTL = 3 * 24 * 60 * 60;

    /**
     * Amount of proposals.
     */
    uint8 constant PROPOSALS_AMOUNT = 3;

    /**
     * Id of proposal. It increases every time when new proposal is created.
     */
    uint256 private proposalId = 0;

    /**
     * Array of proposals which are not discarded. Actually there can be proposals which discarded but not deleted from array.
     * Such proposals are deleted when new proposal is created. It allows to spend less gas than if we would delete proposals.
     */
    uint256[PROPOSALS_AMOUNT] public proposals;

    /**
     * Array of all proposals. It is used to find proposal by id and store all proposals. 
     * It allows to spend less gas than if we would delete proposals.
     */
    Proposal[] public totalProposals;


    constructor() ERC20("Voting", "Voting") {
        Proposal storage proposal = totalProposals.push(); // dummy proposal to avoid checking if array is empty
        proposal.ttl = block.timestamp;
	    _mint(msg.sender, 100 * 10**6);
    }

    /**
     * Function to create proposal. It can be called only by holder of tokens. 
     * 
     * @param document document which is proposed. It is represented by hash of text.
     */
    function createProposal(uint256 document) public onlyHolder {
        uint8 index = findIndex();
        require(index != PROPOSALS_AMOUNT, "No place for new proposal");
        Proposal storage proposal = totalProposals.push();
        proposal.proposer = msg.sender;
        proposal.id = ++proposalId;
        proposal.ttl = block.timestamp + TTL;
        proposals[index] = proposal.id;
        proposal.document = document;
    }

    /**
     * Function to vote for proposal. It can be called only by holder of tokens.
     * 
     * @param id id of proposal
     * @param value amount of tokens voted
     */
    function voteFor(uint256 id, uint256 value) public {
        vote(id, VOTE_STATUS.FOR, value);
    }

    /**
     * Function to vote against proposal. It can be called only by holder of tokens.
     * 
     * @param id id of proposal
     * @param value amount of tokens voted
     */
    function voteAgainst(uint256 id, uint256 value) public {
        vote(id, VOTE_STATUS.AGAINST, value);
    }

    /**
     * Function to vote for or against proposal. It emits events if proposal is accepted or declined.
     * 
     * @param id id of proposal
     * @param _vote status of vote
     * @param value amount of tokens voted
     */
    function vote(uint256 id, VOTE_STATUS _vote, uint256 value) internal onlyHolder {
        require(value > 0, "Positive amount required");
        require(balanceOf(msg.sender) >= value, "Not enough tokens to vote");

        uint8 index = findIndexOfProposalIfExists(id);
        require(index != PROPOSALS_AMOUNT, "Proposal not found");
        Proposal storage proposal = totalProposals[proposals[index]];
        require(!(proposal.ttl <= block.timestamp), "Proposal does not exist");

        require(proposal.votes[msg.sender].amount == 0, "Already voted for this proposal");
        
        proposal.votes[msg.sender].amount = value;
        proposal.votes[msg.sender].vote = _vote;

        if (_vote == VOTE_STATUS.FOR) {
            proposal.votesFor += value;
            if (proposal.votesFor > totalSupply() / 2) {
                emit ProposalAccepted(proposal.id);
                proposal.ttl = block.timestamp;
            }
        } else {
            proposal.votesAgainst += value;
            if (proposal.votesAgainst > totalSupply() / 2) {
                emit ProposalDeclined(proposal.id);
                proposal.ttl = block.timestamp;
            }
        }
    }

    /**
     * Function to find index of proposal which is to be discarded. It emits event if proposal is discarded.
     * 
     * @return index of proposal which is to be discarded or PROPOSALS_AMOUNT if there is no such proposal
     */
    function findIndex() internal returns (uint8) {
        uint8 i;
        for (i = 0; i < PROPOSALS_AMOUNT; i++) {
            if (totalProposals[proposals[i]].ttl <= block.timestamp) {
                if (proposals[i] != 0) {
                    emit ProposalDiscarded(proposals[i]);
                }
                break;
            }
        }
        return i;
    }

    /**
     * Function to find index of proposal by id.
     * 
     * @param id id of proposal
     * @return index of proposal if it exists, PROPOSALS_AMOUNT otherwise
     */
    function findIndexOfProposalIfExists(uint256 id) internal view returns (uint8) {
        for (uint8 i = 0; i < PROPOSALS_AMOUNT; i++) {
            if (proposals[i] == id) {
                return i;
            }
        }
        return PROPOSALS_AMOUNT;
    }

    function decimals() public view override returns (uint8) {
	    return 6;
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {
        for (uint8 i = 0; i < PROPOSALS_AMOUNT; i++) {
            Proposal storage proposal = totalProposals[proposals[i]];
            if (proposal.ttl <= block.timestamp) {
                continue;
            }
            if (proposal.votes[from].amount > 0) {
                if (proposal.votes[from].vote == VOTE_STATUS.FOR) {
                    if (balanceOf(from) < proposal.votes[from].amount) {
                        proposal.votesFor -= (proposal.votes[from].amount - balanceOf(from));
                        proposal.votes[from].amount = balanceOf(from);
                    }
                } else {
                    proposal.votesAgainst -= amount;
                    if (balanceOf(from) < proposal.votes[from].amount) {
                        proposal.votesAgainst -= (proposal.votes[from].amount - balanceOf(from));
                        proposal.votes[from].amount = balanceOf(from);
                    }
                }
            }
        }
    }
}
