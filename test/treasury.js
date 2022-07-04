const { expect } = require("chai");
const { upgrades, ethers } = require("hardhat");
const { time } = require("../utilities");

describe("Treasury contract", function () {
  let Token;
  let governanceToken;
  let goldToken;
  let governance;
  let swapContract;
  let swap;
  let treasuryContract;
  let treasury;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  let valar;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    Token = await ethers.getContractFactory("Gold1");
    governanceToken = await ethers.getContractFactory("GovernorBravoDelegate");
    swapContract = await ethers.getContractFactory("UniswapV2RouterMock");
    treasuryContract = await ethers.getContractFactory("Treasury");
    valar = await ethers.getContractFactory("Valar");

    valar = await valar.deploy();
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    swap = await swapContract.deploy();

    goldToken = await upgrades.deployProxy(Token, [
      owner.address,
      "100000000000000000000000",
    ]);
    await goldToken.deployed();

    treasury = await upgrades.deployProxy(treasuryContract, [
      goldToken.address,
      swap.address,
    ]);
    await treasury.deployed();

    governance = await upgrades.deployProxy(governanceToken, [
      addr2.address,
      goldToken.address,
      17280,
      1,
      "60000000000000000000000",
      treasury.address,
      valar.address
    ]);
    await governance.deployed();
    await goldToken.setTreasuryAddress(treasury.address);
  });
  describe("Deployment", function () {
    it("Should set the right owner GOLD token", async function () {
      expect(await goldToken.owner()).to.equal(owner.address);
    });
    it("Should set the right owner of governance", async function () {
      expect(await governance.admin()).to.equal(addr2.address);
    });
  });

  describe("Check Fees", function () {
    it("0.4 percent should be deducted on transfer from one account to another account", async function () {
      await goldToken.transfer(addr1.address, 1000);
      expect(await goldToken.balanceOf(addr1.address)).to.equal(996);
      expect(await goldToken.balanceOf(treasury.address)).to.equal(4);
    });
    it("No fees for whitelisted", async function () {
      await goldToken.setWhitelistAddress(addr1.address, true);
      await goldToken.transfer(addr1.address, 1000);
      expect(await goldToken.balanceOf(addr1.address)).to.equal(1000);
      expect(await goldToken.balanceOf(treasury.address)).to.equal(0);
    });

    it("Only owners can whitelist", async function () {
      await expect(
        goldToken.connect(addr1).setWhitelistAddress(addr1.address, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Add Investee", function () {
    it("Only admin/Timelock can add", async function () {
      await expect(
        governance.connect(addr1)._setInvesteeDetails(addr1.address)
      ).to.be.revertedWith("GovernorBravo::_setInvesteeDetails: admin only");
    });
    it("Should add from admin account", async function () {
      await governance.connect(addr2)._setInvesteeDetails(addr1.address);
      expect(await governance.investeeDetails(0)).to.equal(addr1.address);
      expect(await governance.nextInvestee()).to.equal(1);
    });

    it("Multiple investee", async function () {
      await governance.connect(addr2)._setInvesteeDetails(addr1.address);
      expect(await governance.investeeDetails(0)).to.equal(addr1.address);
      expect(await governance.nextInvestee()).to.equal(1);
      await governance.connect(addr2)._setInvesteeDetails(addrs[0].address);
      expect(await governance.investeeDetails(1)).to.equal(addrs[0].address);
      expect(await governance.nextInvestee()).to.equal(2);
    });
  });

  describe("Fund Investee", function () {
    beforeEach(async function () {
      await treasury.connect(owner).setDAOAddress(governance.address);
      await governance.connect(addr2)._setInvesteeDetails(addr1.address);
      await governance.connect(addr2)._setInvesteeDetails(addrs[0].address);
    });
    it("Only treasury can fund", async function () {
      await expect(
        governance.connect(addr1)._fundInvestee()
      ).to.be.revertedWith("GovernorBravo::_fundInvestee: treasury only");
    });
    it("Should fund investee ", async function () {
      await goldToken
        .connect(owner)
        .transfer(treasury.address, "40000000000000000000");
      await goldToken.connect(owner).transfer(addr2.address, "10");
      expect(await goldToken.balanceOf(addr1.address)).to.equal(
        "13000000000000000000"
      );
      expect(
        await goldToken.balanceOf("0x000000000000000000000000000000000000dEaD")
      ).to.equal("2500000000000000000");
    });
    it("Should fund to other investee ", async function () {
      await goldToken
        .connect(owner)
        .transfer(treasury.address, "40000000000000000000");
      await goldToken.connect(owner).transfer(addr2.address, "10");
      await goldToken.connect(owner).transfer(addr2.address, "10");
      expect(await goldToken.balanceOf(addrs[0].address)).to.equal(
        "13000000000000000000"
      );
      expect(
        await goldToken.balanceOf("0x000000000000000000000000000000000000dEaD")
      ).to.equal("5000000000000000000");
    });
    it("Should update the mapping", async function () {
      await goldToken
        .connect(owner)
        .transfer(treasury.address, "80000000000000000000");
      await goldToken.connect(owner).transfer(addr2.address, "10");
      expect(await governance.nextInvesteeFund()).to.equal("1");
      await goldToken.connect(owner).transfer(addr2.address, "10");
      expect(await governance.nextInvesteeFund()).to.equal("2");
      await goldToken.connect(owner).transfer(addr2.address, "10");
      expect(await governance.nextInvesteeFund()).to.equal("2");
      expect(await goldToken.balanceOf(addrs[0].address)).to.equal(
        "13000000000000000000"
      );
      expect(
        await goldToken.balanceOf("0x000000000000000000000000000000000000dEaD")
      ).to.equal("5000000000000000000");
    });
  });
});
