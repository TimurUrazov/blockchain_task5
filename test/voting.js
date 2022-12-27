const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Voting", function () {
    let addrA;
    let addrB;
    let addrC;
    let addrEmpty;
    let supply;
    const defaultMessage = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("Hello World"))

    async function deployment() {
        const [owner, ] = await ethers.getSigners();

        let votingTokenFactory = await ethers.getContractFactory("Voting");

        const votingToken = await votingTokenFactory.deploy();
        await votingToken.deployed();

        return { votingToken, owner };
    }

    async function deploymentAndTransfer() {
        const { votingToken, owner } = await deployment();

        const [addr1, addr2, addr3, addr4] = await ethers.getSigners();

        const totalSupply = await votingToken.totalSupply();

        await votingToken.connect(owner).transfer(addr1.address, 0.25 * totalSupply);
        await votingToken.connect(owner).transfer(addr2.address, 0.4 * totalSupply);
        await votingToken.connect(owner).transfer(addr3.address, 0.35 * totalSupply);


        addrA = addr1;
        addrB = addr2;
        addrC = addr3;
        addrEmpty = addr4;
        supply = totalSupply;

        return { votingToken, owner };
    }

    it("Decimals is 6", async function () {
        const { votingToken } = await loadFixture(deployment);
            expect(await votingToken.decimals()).to.equal(6);
    });
  
    it("Total supply is 100000000", async function () {
      const { owner, votingToken } = await loadFixture(deployment);
      const ownerBalance = await votingToken.balanceOf(owner.address);
      const balance = ethers.BigNumber.from('100000000')
      expect(ownerBalance).to.equal(balance);
    });

    it("addrA has 25% of total supply", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);
        const totalSupply = await votingToken.totalSupply();
        const addrABalance = await votingToken.balanceOf(addrA.address);
        const balance = ethers.BigNumber.from('25000000')
        expect(addrABalance).to.equal(balance);
    });

    it("addrB has 40% of total supply", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);
        const totalSupply = await votingToken.totalSupply();
        const addrBBalance = await votingToken.balanceOf(addrB.address);
        const balance = ethers.BigNumber.from('40000000')
        expect(addrBBalance).to.equal(balance);
    });

    it("addrC has 35% of total supply", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);
        const totalSupply = await votingToken.totalSupply();
        const addrCBalance = await votingToken.balanceOf(addrC.address);
        const balance = ethers.BigNumber.from('35000000')
        expect(addrCBalance).to.equal(balance);
    });

    it("addrEmpty has 0% of total supply", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);
        const totalSupply = await votingToken.totalSupply();
        const addrEmptyBalance = await votingToken.balanceOf(addrEmpty.address);
        const balance = ethers.BigNumber.from('0')
        expect(addrEmptyBalance).to.equal(balance);
    });

    it("Proposal is reverted because non-holder tried to create it", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await expect(votingToken.connect(addrEmpty).createProposal(defaultMessage)).to.be.revertedWith(
            "Only holders can create proposals"
        );
    });

    it("Vote is reverted because there is not enough tokens to do it", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        votingToken.connect(addrA).createProposal(defaultMessage)

        await expect(votingToken.connect(addrA).voteFor(0, supply)).to.be.revertedWith(
            "Not enough tokens to vote"
        );
    });

    it("Vote is reverted because proposal does not exist", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await expect(votingToken.connect(addrA).voteFor(0, 0.1 * supply)).to.be.revertedWith(
            "Proposal does not exist"
        );
    });

    it("Proposal was accepted", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).voteFor(1, 0.25 * supply)

        await expect(votingToken.connect(addrB).voteFor(1, 0.4 * supply)).to.emit(votingToken, 'ProposalAccepted').withArgs(1);
    });

    it("Fourth proposal was reverted", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).createProposal(defaultMessage)
        await expect(votingToken.connect(addrA).createProposal(defaultMessage)).to.be.revertedWith(
            "No place for new proposal"
        );
    });

    it("Fourth proposal was not reverted after ttl has expired, obsolete proposal was kicked out", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).createProposal(defaultMessage)
        await time.increase(3 * 24 * 60 * 60 + 1)
        const tx = votingToken.connect(addrA).createProposal(defaultMessage)

        await expect(tx).to.not.be.reverted;
        await expect(tx).to.emit(votingToken, 'ProposalDiscarded').withArgs(1);
    });

    it("Proposal was removed afted it had been accepted", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).voteFor(1, 0.25 * supply)
        await expect(votingToken.connect(addrB).voteFor(1, 0.4 * supply)).to.emit(votingToken, 'ProposalAccepted').withArgs(1);

        await expect(votingToken.connect(addrC).voteFor(1, 0.1 * supply)).to.be.revertedWith(
            "Proposal does not exist"
        );
    });

    it("Tokens were not freezed after voting", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).voteFor(1, 0.25 * supply)
        await expect(votingToken.connect(addrB).voteFor(1, 0.4 * supply)).to.emit(votingToken, 'ProposalAccepted').withArgs(1);

        const addrABalance = await votingToken.balanceOf(addrA.address);
        const balance = ethers.BigNumber.from('25000000')
        expect(addrABalance).to.equal(balance);
    });

    it("Can not vote for proposal twice", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).voteFor(1, 0.25 * supply)

        await expect(votingToken.connect(addrA).voteFor(1, 0.25 * supply)).to.be.revertedWith(
            "Already voted for this proposal"
        );
    });

    it("Can vote twice by transferring tokens", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).voteFor(1, 0.25 * supply)

        await votingToken.connect(addrA).transfer(addrEmpty.address, 0.25 * supply)

        await votingToken.connect(addrB).transfer(addrA.address, 0.1 * supply)

        await expect(votingToken.connect(addrA).voteAgainst(1, 0.1 * supply)).to.not.be.reverted;
    });

    it("Can not vote for proposal twice by transferring tokens", async function () {
        const { votingToken } = await loadFixture(deploymentAndTransfer);

        await votingToken.connect(addrA).createProposal(defaultMessage)
        await votingToken.connect(addrA).voteFor(1, 0.25 * supply)

        await votingToken.connect(addrA).transfer(addrEmpty.address, 0.2 * supply)

        await votingToken.connect(addrB).transfer(addrA.address, 0.1 * supply)

        await expect(votingToken.connect(addrA).voteAgainst(1, 0.1 * supply)).to.be.revertedWith(
            "Already voted for this proposal"
        );
    });
});