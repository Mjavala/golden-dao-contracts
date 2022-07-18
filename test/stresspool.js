const { expect } = require("chai");
const { upgrades, ethers } = require("hardhat");
const { time } = require("../utilities");

const tx = async (contract, call, sender, params) => {
    const tx = await contract.connect(sender).populateTransaction[call](...params)
    await sender.sendTransaction(tx)
}

const parse = (num) => {
    return ethers.utils.parseUnits(Number(num).toString(), 9)
}

const format = (num) => {
    return Number(Number(ethers.utils.formatUnits(Number(num).toString(), 9)).toFixed(0))
}

const generateRandomness = () => {
    return Math.floor((Math.random() * 1000000) + 1);
}

const randomIntFromInterval = (min, max) =>{ // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
  }

describe("maia contract", () => {
  let addrs;
  let maia;
  let gold;
  let valar;

  beforeEach(async () => {
    [owner, ...addrs] = await ethers.getSigners();

    gold = await ethers.getContractFactory("Gold1");
    gold = await gold.deploy();

    valar = await ethers.getContractFactory("Valar");
    valar = await valar.deploy()

    const startBlock = await time.latestBlock();
    maia = await ethers.getContractFactory("Maia");
    maia = await upgrades.deployProxy(maia, [
        gold.address,
        valar.address,
        owner.address,
        startBlock,
      ]);

    await maia.deployed()

    await maia.add(100, gold.address, true)

    for await (const t of addrs) {
        await tx(gold, 'transfer(address,uint256)', owner, [t.address, parse(10_000_000)])
        await tx(gold, 'approve(address,uint256)', t, [maia.address, parse(10_000_000)])
    }
  });
    it("Should deposit 1M each, check pool variables, see if anyone can claim", async () => {
        for await (const t of addrs) {
            await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(1_000_000)])
        }
        expect(await gold.balanceOf(maia.address)).to.equal(await maia.totalGOLDStaked())
        expect(await maia.totalGOLDStaked()).to.equal(parse(960_000 * 19))

        /** no one should have any rewards at this point */

        for await (const t of addrs) {
            expect(format(await maia.pendingGOLD(0, t.address))).to.equal(0)
            expect(format(await maia.balanceOf(t.address))).to.equal(960_000)
        }

        /** add some claimable gold to the pool */
        await gold.transfer(maia.address, parse(1_000_000))

        for await (const t of addrs) {
            expect(format(await maia.pendingGOLD(0, t.address))).to.equal(47_368);
            await tx(maia, 'claimGOLD(uint256)', t, [0])
            expect(format(await gold.balanceOf(t.address))).to.equal(9_045_474)
            expect(format(await maia.pendingGOLD(0, t.address))).to.equal(0);
        }

        // 100_000 = 10% of 1_000_000
        expect(format(await gold.balanceOf(maia.address))).to.equal(format(await maia.totalGOLDStaked()) + 100_000)

        await gold.transfer(maia.address, parse(900_000))

        for await (const t of addrs) {
            await tx(valar, 'mint(address,uint256)', owner, [t.address, 1])
        }

        for await (const t of addrs) {
            expect(format(await maia.pendingGOLD(0, t.address))).to.equal(47_368);
            await tx(maia, 'claimGOLD(uint256)', t, [0])
            // why is it slightly more?
            expect(format(await gold.balanceOf(t.address))).to.equal(9_090_947)
            expect(format(await maia.pendingGOLD(0, t.address))).to.equal(0);
        }

        expect(format(await gold.balanceOf(maia.address))).to.equal(format(await maia.totalGOLDStaked()) + 100_000)

        // as long as the is never below the totalStakedAmount, we will not error.
        expect(format(await gold.balanceOf(maia.address))).to.be.greaterThan(format(await maia.totalGOLDStaked()))
    });
    it("Deposit claim deposit withdraw cycle", async () => {
        /** add some claimable gold to the pool */
        await gold.transfer(maia.address, parse(1_000_000))
        
        for await (const t of addrs) {
            let num = generateRandomness();
            await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
            await tx(maia, 'claimGOLD(uint256)', t, [0])
            num = generateRandomness();
            await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
            await tx(maia, 'withdraw(uint256,uint256)', t, [0, parse(num - (num * 0.04))])
        }
        expect(format(await gold.balanceOf(maia.address))).to.be.greaterThan(format(await maia.totalGOLDStaked()))
    })

    it("Full Cycle Repeating", async () => {
        /** add some claimable gold to the pool */
        await gold.transfer(maia.address, parse(1_000_000))

        for await (const t of addrs) {
            const num = generateRandomness();
            await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
            const bal = format(await gold.balanceOf(t.address))
            await tx(maia, 'claimGOLD(uint256)', t, [0])
            expect(bal).to.be.lessThanOrEqual(format(await gold.balanceOf(t.address)))
            await tx(maia, 'withdraw(uint256,uint256)', t, [0, parse(num - (num * 0.04))])
            expect(format(await maia.balanceOf(t.address))).to.equal(0)
            // as long as the is never below the totalStakedAmount, we will not error.
        }
        expect(format(await gold.balanceOf(maia.address))).to.be.equal(format(await maia.totalGOLDStaked())).to.be.equal(0)
    }),
    it("Full Cycle Chaos", async () => {

        for await (const t of addrs) {
            // simulating different pathways
            // const path = randomIntFromInterval(0, 2)
            const deify = randomIntFromInterval(0, 1)

            const num = generateRandomness();

            if (deify == 1) await tx(valar, 'mint(address,uint256)', owner, [t.address, 1])

            await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
        }

        /** add some claimable gold to the pool */
        await gold.transfer(maia.address, parse(10_000_000))

        for await (const t of addrs) {
            const path = randomIntFromInterval(0, 2)
            const num = generateRandomness();
            const user = await maia.getUser(0, t.address);

            switch(path) {                
                case 0:
                    // just close out
                    await tx(maia, 'withdraw(uint256,uint256)', t, [0, user.amount])
                    break
                case 1:
                    await tx(maia, 'claimGOLD(uint256)', t, [0])
                    await tx(maia, 'withdraw(uint256,uint256)', t, [0, user.amount])
                    break
                case 2:
                    const num = generateRandomness();
                    await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
            }
        }
        // as long as the is never below the totalStakedAmount, we will not error.
        expect(format(await gold.balanceOf(maia.address))).to.be.greaterThan(format(await maia.totalGOLDStaked()))

        for await (const t of addrs) {
            const path = randomIntFromInterval(0, 2)
            const num = generateRandomness();
            const user = await maia.getUser(0, t.address);

            switch(path) {                
                case 0:
                    // just close out
                    if (user.amount == 0) break;
                    await tx(maia, 'withdraw(uint256,uint256)', t, [0, user.amount])
                    break
                case 1:
                    await tx(maia, 'claimGOLD(uint256)', t, [0])
                    if (user.amount == 0) break;
                    await tx(maia, 'withdraw(uint256,uint256)', t, [0, user.amount])
                    break
                case 2:
                    await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
            }
        }

        for await (const t of addrs) {
            const path = randomIntFromInterval(0, 2)
            const num = generateRandomness();
            const user = await maia.getUser(0, t.address);

            switch(path) {                
                case 0:
                    // just close out
                    if (user.amount == 0) {
                        await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)]);
                        break;
                    }
                    await tx(maia, 'withdraw(uint256,uint256)', t, [0, user.amount])
                    break
                case 1:
                    await tx(maia, 'claimGOLD(uint256)', t, [0])
                    if (user.amount == 0) break;
                    await tx(maia, 'withdraw(uint256,uint256)', t, [0, user.amount])
                    break
                case 2:
                    await tx(maia, 'deposit(uint256,uint256)', t, [0, parse(num)])
            }
        }
    })
});
