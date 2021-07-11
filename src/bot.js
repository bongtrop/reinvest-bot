require('dotenv').config()

import Web3 from 'web3';
import PolycatMasterChef from './abi/PolycatMasterChef.json';
import WPool from './abi/WPool.json';
import WMATIC from './abi/WMATIC.json';
import FishToken from './abi/FishToken.json';
import FireBirdPair from './abi/FireBirdPair.json';
import FireBirdRouter from './abi/FireBirdRouter.json';
import ContractAddress from './ContractAddress.json';

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REFFERAL_ADDRESS = process.env.REFFERAL_ADDRESS;
const HARVEST_POOLS = process.env.HARVEST_POOLS;
const HARVEST_MATIC = process.env.HARVEST_MATIC === "true" ? true : false;
const REINVEST_POOL = process.env.REINVEST_POOL;
const INTERVAL_HR = process.env.INTERVAL_HR;
const GAS_TOPUP = process.env.GAS_TOPUP;
const GAS_LIMIT = process.env.GAS_LIMIT;

const web3 = new Web3(RPC_URL);
const account = web3.eth.accounts.wallet.add(PRIVATE_KEY);
const polycatMasterChef = new web3.eth.Contract(PolycatMasterChef, ContractAddress["PolycatMasterChef"]);
const waultPool = new web3.eth.Contract(WPool, ContractAddress["WPool"]);
const wmaticToken = new web3.eth.Contract(WMATIC, ContractAddress["WMATIC"]);
const fishToken = new web3.eth.Contract(FishToken, ContractAddress["FishToken"]);
const fishLPToken = new web3.eth.Contract(FireBirdPair, ContractAddress["FishLP"]);
const fireBirdRouter = new web3.eth.Contract(FireBirdRouter, ContractAddress["FireBirdRouter"]);

const intervalHr = parseInt(INTERVAL_HR);
const gasTopup = parseInt(GAS_TOPUP);
const gasLimit = parseInt(GAS_LIMIT);

const harvestPools = [];
for (let harvestPool of HARVEST_POOLS.split(',')) {
    harvestPools.push(parseInt(harvestPool));
}
const reinvestPool = parseInt(REINVEST_POOL);

const reinvest = async () => {
    console.log(`[${new Date()}] Reinvest !!`);
    const gasPrice = (new web3.utils.BN(await web3.eth.getGasPrice())).add(new web3.utils.BN(gasTopup));
    // Harvest from Polycat
    for (let harvestPool of harvestPools) {
        if (isNaN(harvestPool)) continue;
        try {
            await polycatMasterChef.methods.deposit(harvestPool, 0, REFFERAL_ADDRESS).send({
                gasPrice: gasPrice.toString(),
                gas: gasLimit,
                from: account.address
            }).on('transactionHash', function (transactionHash) {
                console.log(`Harvest from Polycat pool ${harvestPool}: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
            });
        } catch (err) {
            console.error("Transaction Error")
            console.error(err.message);
        }
    }

    if (HARVEST_MATIC) {
        // Harvest WMATIC from Wault Pool
        try {
            await waultPool.methods.claim().send({
                gasPrice: gasPrice.toString(),
                gas: GAS_LIMIT,
                from: account.address
            }).on('transactionHash', function (transactionHash) {
                console.log(`Harvest from Wault: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
            });
        } catch (err) {
            console.error("Transaction Error")
            console.error(err.message);
        }

        // Unwrap WMATIC to MATIC
        const wmaticBalance = new web3.utils.BN(await wmaticToken.methods.balanceOf(account.address).call());
        if (wmaticBalance.gt(0)) {
            try {
                await wmaticToken.methods.withdraw(wmaticBalance).send({
                    gasPrice: gasPrice.toString(),
                    gas: GAS_LIMIT,
                    from: account.address
                }).on('transactionHash', function (transactionHash) {
                    console.log(`Unwrap (${web3.utils.fromWei(wmaticBalance)} WMATIC): ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
                });
            } catch (err) {
                console.error("Transaction Error")
                console.error(err.message);
            }
        }
    }

    // Reinvest in FISH pool
    if (reinvestPool === 1) {
        const fishBalance = new web3.utils.BN(await fishToken.methods.balanceOf(account.address).call());
        if (fishBalance.gt(0)) {
            try {
                await polycatMasterChef.methods.deposit(reinvestPool, fishBalance, "0x0000000000000000000000000000000000000000").send({
                    gasPrice: gasPrice.toString(),
                    gas: gasLimit,
                    from: account.address
                }).on('transactionHash', function (transactionHash) {
                    console.log(`Reinvest to pool ${reinvestPool} (${web3.utils.fromWei(fishBalance)} FISH): ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
                });
            } catch (err) {
                console.error("Transaction Error")
                console.error(err.message);
            }
        }
    }
    // Reinvest in FISH-MATIC FireBird Farm
    else if (reinvestPool === 26) {
        // Add FISH-WMATIC Liquidity
        const fishBalance = new web3.utils.BN(await fishToken.methods.balanceOf(account.address).call());
        if (fishBalance.gt(0)) {
            try {
                // Calculate the amount of MATIC needed for the available FISH
                const reserves = await fishLPToken.methods.getReserves().call();
                const wmaticReserve = new web3.utils.BN(reserves[0]);
                const fishReserve = new web3.utils.BN(reserves[1]);
                const quote = fishBalance.mul(wmaticReserve).div(fishReserve); // Naively assume that we would always have enough MATIC

                // Add without caring about the current price
                await fireBirdRouter.methods.addLiquidityETH(ContractAddress["FishLP"], ContractAddress["FishToken"], fishBalance, "0", "0", account.address, Math.floor(Date.now() / 1000) + 60).send({
                    gasPrice: gasPrice.toString(),
                    gas: GAS_LIMIT,
                    from: account.address,
                    value: quote
                }).on('transactionHash', function (transactionHash) {
                    console.log(`Provide liquidity (${web3.utils.fromWei(fishBalance)} FISH, ${web3.utils.fromWei(quote)} WMATIC): ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
                });
            } catch (err) {
                console.error("Transaction Error")
                console.error(err.message);
            }
        }
        // Stake FISH-WMATIC LP into Polycat
        const fishLPBalance = new web3.utils.BN(await fishLPToken.methods.balanceOf(account.address).call());
        if (fishLPBalance.gt(0)) {
            try {
                await polycatMasterChef.methods.deposit(reinvestPool, fishBalance, "0x0000000000000000000000000000000000000000").send({
                    gasPrice: gasPrice.toString(),
                    gas: GAS_LIMIT,
                    from: account.address
                }).on('transactionHash', function (transactionHash) {
                    console.log(`Reinvest to pool ${reinvestPool} (${web3.utils.fromWei(fishLPBalance)} FISH-WMATIC LP): ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
                });
            } catch (err) {
                console.error("Transaction Error")
                console.error(err.message);
            }
        }
    }
}

async function main() {
    await reinvest();
    setInterval(reinvest, intervalHr * 60 * 60 * 1000);
}

main()
    .then(async () => {
        // do nothing
    })
    .catch((err) => {
        console.error(err);
        process.exit(1337)
    });
