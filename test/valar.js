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
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    valarToken = await valarToken.deploy();

  });
  describe("Deployment", function () {
    it("Only the owner should be able to mint", async function () {
        await expect(valarToken.connect(addr1).mint(addr1.address, 1)).to.be.revertedWith("Ownable: caller is not the owner");
    });
    it("Only the owner should be able to mint", async function () {
        await expect(valarToken.mint(addr1.address, 2)).to.be.revertedWith("Can only mint one");
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
  });
});
