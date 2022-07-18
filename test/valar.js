const { expect } = require("chai");
const { upgrades, ethers } = require("hardhat");
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
    valarToken = await ethers.getContractFactory("Valar");
    maiaToken = await ethers.getContractFactory("Maia");
    gold1 = await ethers.getContractFactory("Gold1Mock");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    const startBlock = await time.latestBlock();


    gold1 = await gold1.deploy();
    valarToken = await valarToken.deploy();
    
    maiaToken = await upgrades.deployProxy(maiaToken, [
      gold1.address,
      valarToken.address,
      owner.address,
      startBlock,
    ]);
    await maiaToken.deployed();

    await maiaToken.add(100, gold1.address, true);
  });
  describe("Deployment", function () {
    it("Only the owner should be able to mint", async function () {
        await expect(valarToken.connect(addr1).mint(addr1.address, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Only the owner should be able to transfer", async function () {
        await expect(valarToken.connect(addr1).transfer(addr1.address, addr2.address, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Should only be able to transfer one", async function () {
        await valarToken.mint(addr1.address, 1)
        await expect(valarToken.transfer(addr1.address, addr2.address, 2)).to.be.revertedWith("Can only transfer one");

    });
    it("Owner should be able to revoke token", async function () {
        await valarToken.mint(addr1.address, 1)
        expect (await valarToken.balanceOf(addr1.address)).to.equal(1)

        await valarToken.transfer(owner.address, addr1.address, 1);

        expect(await valarToken.balanceOf(owner.address)).to.equal(1)
    });
    it("Should allow for multiple deposits, withdrawals, and claims", async () => {
      await valarToken.mint(owner.address, 1)
      expect(await valarToken.balanceOf(owner.address)).to.equal(1)
      await gold1.connect(owner).approve(maiaToken.address, ethers.utils.parseUnits((2_000_000_000).toString(), 9));

      await maiaToken.deposit(0,  ethers.utils.parseUnits((500_000_000).toString(), 9))

      await maiaToken.deposit(0,  ethers.utils.parseUnits((500_000_000).toString(), 9))

      expect(await maiaToken.balanceOf(owner.address)).to.equal(ethers.utils.parseUnits((960_000_000).toString(), 9))
      expect(await maiaToken.pendingGOLD(0, owner.address)).to.equal(ethers.utils.parseUnits((18_000_000).toString(), 9))

      await maiaToken.claimGOLD(0)
      
      // why is this 38_xxx_xxx instead of the expected 40_xxx_xxx ?
      expect(await gold1.balanceOf(owner.address)).to.equal(ethers.utils.parseUnits((9_038_000_000).toString(), 9))

      await maiaToken.withdraw(0, ethers.utils.parseUnits((960_000_000).toString(), 9))

      expect(Number(await maiaToken.pendingGOLD(0, owner.address))).to.equal(0)

      await maiaToken.claimGOLD(0)

      expect(await gold1.balanceOf(owner.address)).to.equal(ethers.utils.parseUnits((9_998_200_000).toString(), 9))
    }),
    it("Should allow for multiple deposits, withdrawals, and claims", async () => {
      await valarToken.mint(addr1.address, 1)
      expect(await valarToken.balanceOf(addr1.address)).to.equal(1)
      await gold1.connect(addr1).approve(maiaToken.address, ethers.utils.parseUnits((1_000_000_000).toString(), 9));
      await gold1.transfer(addr1.address, ethers.utils.parseUnits((1_000_000_000).toString(), 9))

      await maiaToken.connect(addr1).deposit(0,  ethers.utils.parseUnits((500_000_000).toString(), 9))

      await maiaToken.connect(addr1).deposit(0,  ethers.utils.parseUnits((500_000_000).toString(), 9))

      expect(await maiaToken.balanceOf(addr1.address)).to.equal(ethers.utils.parseUnits((960_000_000).toString(), 9))
      expect(await maiaToken.pendingGOLD(0, addr1.address)).to.equal(ethers.utils.parseUnits((0).toString(), 9))

      await maiaToken.connect(addr1).claimGOLD(0)
      
      // why is this 38_xxx_xxx instead of the expected 40_xxx_xxx ?
      expect(await gold1.balanceOf(addr1.address)).to.equal(ethers.utils.parseUnits((0).toString(), 9))

      await maiaToken.connect(addr1).withdraw(0, ethers.utils.parseUnits((960_000_000).toString(), 9))

      expect(Number(await maiaToken.pendingGOLD(0, addr1.address))).to.equal(0)

      await maiaToken.connect(addr1).claimGOLD(0)

      expect(await gold1.balanceOf(addr1.address)).to.equal(ethers.utils.parseUnits((921_600_000).toString(), 9))
    }),
    it("Alice, bob, charlie, dany and emily all deposit 100k, they all claim, bob withdraws, alice doubles down", async () => {
      
    })
  });
});
