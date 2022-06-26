const { expect } = require("chai");
const { upgrades } = require("hardhat");
const { time } = require("../utilities");

describe("maia contract", function () {
  let Token;
  let stakeToken;
  let goldToken;
  let maiaToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    Token = await ethers.getContractFactory("Gold1");
    stakeToken = await ethers.getContractFactory("Maia");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const startBlock = await time.latestBlock();

    goldToken = await upgrades.deployProxy(Token, [owner.address, 100000]);
    await goldToken.deployed();
    await goldToken.setTreasuryAddress(owner.address);
    await goldToken.setWhitelistAddress(addr1.address, true);
    await goldToken.setWhitelistAddress(addr2.address, true);
    await goldToken.setWhitelistAddress(addrs[0].address, true);
    await goldToken.setTax(0);
    maiaToken = await upgrades.deployProxy(stakeToken, [
      goldToken.address,
      owner.address,
      startBlock,
      2,
    ]);
    await maiaToken.deployed();
  });
  describe("Deployment", function () {
    it("Should set the right owner gold token", async function () {
      expect(await goldToken.owner()).to.equal(owner.address);
    });
    it("Should set the right owner of maia", async function () {
      expect(await maiaToken.owner()).to.equal(owner.address);
    });
  });
  describe("Add gold pool", function () {
    it("Should revert if non owner tries to add pool", async function () {
      await expect(
        maiaToken.connect(addr1).add(100, goldToken.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should set the right owner of maia", async function () {
      await maiaToken.connect(owner).add(100, goldToken.address, true);
      expect(await maiaToken.poolLength()).to.equal(1);
    });
  });

  describe("Delegate votes", function () {
    beforeEach(async function () {
      await maiaToken.connect(owner).add(100, goldToken.address, true);
      await goldToken.connect(owner).transfer(addr1.address, 1000);
      await goldToken.connect(owner).transfer(addr2.address, 1000);
      await goldToken.connect(owner).approve(maiaToken.address, 1000);
      await goldToken.connect(addr1).approve(maiaToken.address, 1000);
      await goldToken.connect(addr2).approve(maiaToken.address, 1000);
      await maiaToken.connect(owner).deposit(0, 800);
      await maiaToken.connect(addr1).deposit(0, 900);
      await maiaToken.connect(addr2).deposit(0, 1000);
    });
    it("User should have zero votes initially", async function () {
      expect(await maiaToken.getVotes(owner.address)).to.equal(0);
    });
    it("User should have votes after delegate", async function () {
      await maiaToken.connect(owner).delegate(owner.address);
      expect(await maiaToken.getVotes(owner.address)).to.equal(800);
    });
    it("User can delegate votes to other users ", async function () {
      await maiaToken.connect(owner).delegate(addr1.address);
      expect(await maiaToken.getVotes(addr1.address)).to.equal(800);
    });
    it("Delegated user cannot delegate votes to other users ", async function () {
      await maiaToken.connect(owner).delegate(addrs[0].address);
      await maiaToken.connect(addrs[0]).delegate(addr2.address);
      expect(await maiaToken.getVotes(addr2.address)).to.equal(0);
    });
    it("User votes will reduce on withdraw ", async function () {
      await maiaToken.connect(owner).delegate(addr1.address);
      await maiaToken.connect(owner).withdraw(0, 100);
      expect(await maiaToken.getVotes(addr1.address)).to.equal(700);
    });
    it("Delegated user votes will reduce on withdraw ", async function () {
      await maiaToken.connect(owner).delegate(addr1.address);
      await maiaToken.connect(owner).withdraw(0, 100);
      expect(await maiaToken.getVotes(addr1.address)).to.equal(700);
    });
    it("Should revert if top staker tries to delegate", async function () {
      await expect(
        maiaToken.connect(addr1).delegate(addr1.address)
      ).to.be.revertedWith("Top staker cannot delegate");
    });
  });

  describe("Check maia ERC20 token", function () {
    beforeEach(async function () {
      await maiaToken.connect(owner).add(100, goldToken.address, true);
      await goldToken.connect(owner).transfer(addr1.address, 1000);
      await goldToken.connect(addr1).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr1).deposit(0, 1000);
      await goldToken.connect(owner).transfer(maiaToken.address, 1000);
    });
    it("User should have should have maia token", async function () {
      expect(await maiaToken.balanceOf(addr1.address)).to.equal(1000);
    });

    it("User should have should have total token supply", async function () {
      const balance = await maiaToken.balanceOf(addr1.address);
      expect(await maiaToken.totalSupply()).to.equal(balance);
    });

    it("User should have should have maia token after ", async function () {
      await goldToken.connect(owner).transfer(addr2.address, 1000);
      await goldToken.connect(addr2).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr2).deposit(0, 1000);
      expect(await maiaToken.balanceOf(addr2.address)).to.equal(1000);
    });
    it("maia token should be burned on withdraw", async function () {
      await maiaToken.connect(addr1).withdraw(0, 100);
      expect(await maiaToken.balanceOf(addr1.address)).to.equal(900);
      expect(await maiaToken.totalSupply()).to.equal(900);

      await maiaToken.connect(addr1).withdraw(0, 900);
      expect(await maiaToken.balanceOf(addr1.address)).to.equal(0);
      expect(await maiaToken.totalSupply()).to.equal(0);
    });
    it("Token should be non transferable", async function () {
      await expect(
        maiaToken.connect(addr1).transfer(addr2.address, 900)
      ).to.be.revertedWith("Non transferable token");
      await expect(
        maiaToken.connect(addr1).transfer(maiaToken.address, 900)
      ).to.be.revertedWith("Non transferable token");
      await expect(
        maiaToken
          .connect(addr1)
          .transfer("0x0000000000000000000000000000000000000000", 900)
      ).to.be.revertedWith("ERC20: transfer to the zero address");
    });
  });
  describe("Check top stakers", function () {
    beforeEach(async function () {
      await maiaToken.connect(owner).add(100, goldToken.address, true);
      await goldToken.connect(owner).transfer(addr1.address, 1000);
      await goldToken.connect(addr1).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr1).deposit(0, 1000);
    });
    it("First User should have should be highest staker", async function () {
      expect(await maiaToken.checkHighestStaker(0, addr1.address)).to.equal(
        true
      );
    });

    it("All user under the limit should be top staker", async function () {
      await goldToken.connect(owner).transfer(addr2.address, 2000);
      await goldToken.connect(addr2).approve(maiaToken.address, 2000);
      await maiaToken.connect(addr2).deposit(0, 2000);

      expect(await maiaToken.checkHighestStaker(0, addr2.address)).to.equal(
        true
      );
    });

    it("User with more amount should remove the user with less staked amount", async function () {
      await goldToken.connect(owner).transfer(addr2.address, 2000);
      await goldToken.connect(addr2).approve(maiaToken.address, 2000);
      await maiaToken.connect(addr2).deposit(0, 2000);

      await goldToken.connect(owner).transfer(addrs[0].address, 2000);
      await goldToken.connect(addrs[0]).approve(maiaToken.address, 2000);
      await maiaToken.connect(addrs[0]).deposit(0, 2000);

      expect(await maiaToken.checkHighestStaker(0, addr1.address)).to.equal(
        false
      );
      expect(await maiaToken.checkHighestStaker(0, addr2.address)).to.equal(
        true
      );
      expect(await maiaToken.checkHighestStaker(0, addrs[0].address)).to.equal(
        true
      );
    });

    it("User shoul be removed from top staker list on withdrawal", async function () {
      await goldToken.connect(owner).transfer(addr2.address, 2000);
      await goldToken.connect(addr2).approve(maiaToken.address, 2000);
      await maiaToken.connect(addr2).deposit(0, 2000);

      await goldToken.connect(owner).transfer(addrs[0].address, 2000);
      await goldToken.connect(addrs[0]).approve(maiaToken.address, 2000);
      await maiaToken.connect(addrs[0]).deposit(0, 2000);

      await maiaToken.connect(addr2).withdraw(0, 2000);

      expect(await maiaToken.checkHighestStaker(0, addr1.address)).to.equal(
        false
      );
      expect(await maiaToken.checkHighestStaker(0, addr2.address)).to.equal(
        false
      );
      expect(await maiaToken.checkHighestStaker(0, addrs[0].address)).to.equal(
        true
      );
    });
  });
  describe("Check gold distribution with one user", function () {
    beforeEach(async function () {
      await maiaToken.connect(owner).add(100, goldToken.address, true);
      await goldToken.connect(owner).transfer(addr1.address, 1000);
      await goldToken.connect(addr1).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr1).deposit(0, 1000);
      await goldToken.connect(owner).transfer(maiaToken.address, 1000);
    });
    it("User pending should be correct", async function () {
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(1000);
    });
    it("User can claim token", async function () {
      const beforeClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await maiaToken.connect(addr1).claimGOLD(0);
      const afterClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(1000);
    });

    it("Second cannot claim for deposit/stake after reward send to contract", async function () {
      await goldToken.connect(owner).transfer(addr2.address, 1000);
      await goldToken.connect(addr2).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr2).deposit(0, 1000);
      await time.advanceBlock();
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(0);
      const beforeClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await maiaToken.connect(addr2).claimGOLD(0);
      const afterClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(0);
    });

    it("User rewards will be claimed during deposit", async function () {
      await goldToken.connect(owner).transfer(addr1.address, 10);
      await goldToken.connect(addr1).approve(maiaToken.address, 10);
      await time.advanceBlock();
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(1000);
      const beforeClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(10);
      await maiaToken.connect(addr1).deposit(0, 10);
      const afterClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(1000);
    });
  });

  describe("Check gold distribution with multiple address user", function () {
    beforeEach(async function () {
      await maiaToken.connect(owner).add(100, goldToken.address, true);
      await goldToken.connect(owner).transfer(addr1.address, 1000);
      await goldToken.connect(addr1).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr1).deposit(0, 1000);
      await goldToken.connect(owner).transfer(addr2.address, 1000);
      await goldToken.connect(addr2).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr2).deposit(0, 1000);
      await goldToken.connect(owner).transfer(maiaToken.address, 1000);
    });
    it("User first pending should be correct", async function () {
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(500);
    });
    it("User second pending should be correct", async function () {
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(500);
    });
    it("User first should claim half Reward", async function () {
      const beforeClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await maiaToken.connect(addr1).claimGOLD(0);
      const afterClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(afterClaimBalance).to.equal(500);
    });
    it("User second should claim half Reward", async function () {
      const beforeClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await time.advanceBlock();
      await maiaToken.connect(addr2).claimGOLD(0);
      const afterClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(500);
    });

    it("Second cannot claim extra rewards for deposit/stake after reward send to contract", async function () {
      await goldToken.connect(owner).transfer(addr2.address, 1000);
      await goldToken.connect(addr2).approve(maiaToken.address, 1000);
      await maiaToken.connect(addr2).deposit(0, 1000);
      await time.advanceBlock();
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(0);
      const beforeClaimBalance = await goldToken.balanceOf(addr1.address);
      expect(beforeClaimBalance).to.equal(0);
      await maiaToken.connect(addr1).claimGOLD(0);
      const afterClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(500);
    });

    it("Second cannot claim after withdrawal", async function () {
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(500);
      const beforeClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(beforeClaimBalance).to.equal(0);
      await maiaToken.connect(addr2).withdraw(0, 1000);
      const afterClaimBalance = await goldToken.balanceOf(addr2.address);
      expect(afterClaimBalance).to.equal(1500);
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(0);
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(500);
      await goldToken.connect(owner).transfer(maiaToken.address, 1000);
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(0);
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(1500);
      await maiaToken.connect(addr1).claimGOLD(0);
      expect(await goldToken.balanceOf(addr1.address)).to.equal(1500);
      await maiaToken.connect(addr2).claimGOLD(0);
      expect(await goldToken.balanceOf(addr2.address)).to.equal(1500);
    });

    it("Third user can only claim rewards after deposit", async function () {
      await goldToken.connect(owner).transfer(addrs[0].address, 2000);
      await goldToken.connect(addrs[0]).approve(maiaToken.address, 2000);
      await time.advanceBlock();
      // Third user reward will always 0 before
      expect(await maiaToken.pendingGOLD(0, addrs[0].address)).to.equal(0);

      await maiaToken.connect(addrs[0]).deposit(0, 2000);
      expect(await maiaToken.pendingGOLD(0, addrs[0].address)).to.equal(0);
      await goldToken.connect(owner).transfer(maiaToken.address, 2000);
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(1000);
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(1000);
      expect(await maiaToken.pendingGOLD(0, addrs[0].address)).to.equal(1000);

      const beforeClaimBalance = await goldToken.balanceOf(addrs[0].address);
      expect(beforeClaimBalance).to.equal(0);
      await maiaToken.connect(addrs[0]).claimGOLD(0);
      const afterClaimBalance = await goldToken.balanceOf(addrs[0].address);
      expect(afterClaimBalance).to.equal(1000);

      await maiaToken.connect(addrs[0]).withdraw(0, 1000);
      await goldToken.connect(owner).transfer(maiaToken.address, 3000);
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(2000);
      expect(await maiaToken.pendingGOLD(0, addr2.address)).to.equal(2000);
      expect(await maiaToken.pendingGOLD(0, addrs[0].address)).to.equal(1000);
    });
  });
});
