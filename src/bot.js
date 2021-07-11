require('dotenv').config()

import Web3 from 'web3';
import PolycatMasterChef from './abi/PolycatMasterChef.json';
import FishToken from './abi/FishToken.json';
import ContractAddress from './ContractAddress.json';

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REFFERAL_ADDRESS = process.env.REFFERAL_ADDRESS;
const HARVEST_POOLS = process.env.HARVEST_POOLS;
const REINVEST_POOL = process.env.REINVEST_POOL;
const INTERVAL_HR = process.env.INTERVAL_HR;
const GAS_TOPUP = process.env.GAS_TOPUP;

const web3 = new Web3(RPC_URL);
const account = web3.eth.accounts.wallet.add(PRIVATE_KEY);
const polycatMasterChef = new web3.eth.Contract(PolycatMasterChef, ContractAddress["PolycatMasterChef"]);
const fishToken = new web3.eth.Contract(FishToken, ContractAddress["FishToken"]);

const intervalHr = parseInt(INTERVAL_HR);
const gasTopup = parseInt(GAS_TOPUP);

const harvestPools = [];
for (let harvestPool of HARVEST_POOLS.split(',')) {
    harvestPools.push(parseInt(harvestPool));
}
const reinvestPool = parseInt(REINVEST_POOL);

const reinvest = async () => {
    console.log("Reinvest !!");
    for (let harvestPool of harvestPools) {
        const gasPrice = (new web3.utils.BN(await web3.eth.getGasPrice())).add(new web3.utils.BN(gasTopup));
        try {
            await polycatMasterChef.methods.deposit(harvestPool, 0, REFFERAL_ADDRESS).send({
                gasPrice: gasPrice.toString(),
                gas: 20000000,
                from: account.address
            }).on('transactionHash', function (transactionHash) {
                console.log(`Harvest from pool ${harvestPool}: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
            });
        } catch (err) {
            console.error("Transaction Error")
            console.error(err.message);
        }
        
    }

    const fishBalance = new web3.utils.BN(await fishToken.methods.balanceOf(account.address).call());
    if (fishBalance.gt(0)) {
        const gasPrice = (new web3.utils.BN(await web3.eth.getGasPrice())).add(new web3.utils.BN(gasTopup));
        try {
            await polycatMasterChef.methods.deposit(reinvestPool, fishBalance, "0x0000000000000000000000000000000000000000").send({
                gasPrice: gasPrice.toString(),
                gas: 20000000,
                from: account.address
            }).on('transactionHash', function (transactionHash) {
                console.log(`Reinvest to pool ${reinvestPool} (${web3.utils.fromWei(fishBalance)} FISH): ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
            });
        } catch (err) {
            console.error("Transaction Error")
            console.error(err.message);
        }
    }
};

async function main(){
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
