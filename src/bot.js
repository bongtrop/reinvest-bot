require('dotenv').config()

import Web3 from 'web3';
import Booster from './abi/Booster.json';
import OGNFT from './abi/OGNFT.json';
import MasterBarista from './abi/MasterBarista.json';
import LATTE from './abi/LATTE.json';
import DripBar from './abi/DripBar.json';
import ContractAddress from './ContractAddress.json';

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BOOSTER_POOLS = process.env.BOOSTER_POOLS;
const OGNFT_POOLS = process.env.OGNFT_POOLS;
const STAKE_POOL = process.env.STAKE_POOL;
const INTERVAL_HR = process.env.INTERVAL_HR;
const GAS_TOPUP = process.env.GAS_TOPUP;
const GAS_LIMIT = process.env.GAS_LIMIT;

const web3 = new Web3(RPC_URL);
const account = web3.eth.accounts.wallet.add(PRIVATE_KEY);
const booster = new web3.eth.Contract(Booster, ContractAddress["Booster"]);
const ognft = new web3.eth.Contract(OGNFT, ContractAddress["OGNFT"]);
const masterBarista = new web3.eth.Contract(MasterBarista, ContractAddress["MasterBarista"]);
const latte = new web3.eth.Contract(LATTE, ContractAddress["LATTE"]);
const bean = new web3.eth.Contract(LATTE, ContractAddress["BEAN"]);
const dripBar = new web3.eth.Contract(DripBar, ContractAddress["DripBar"]);

const intervalHr = parseInt(INTERVAL_HR);
const gasTopup = parseInt(GAS_TOPUP);
const gasLimit = parseInt(GAS_LIMIT);
const stakePool = parseInt(STAKE_POOL);

const boosterPools = BOOSTER_POOLS.split(',');
const ognftPools = [];

for (let ognftPool of OGNFT_POOLS.split(',')) {
    ognftPools.push(new web3.utils.BN(ognftPool));
}

const reinvest = async () => {
    console.log("[*] Booster Harvest");
    try {
        const gasPrice = (new web3.utils.BN(await web3.eth.getGasPrice())).add(new web3.utils.BN(gasTopup));
        await booster.methods.harvest(boosterPools).send({
            gasPrice: gasPrice.toString(),
            gas: gasLimit,
            from: account.address
        }).on('transactionHash', function (transactionHash) {
            console.log(`[+] Harvest from Booster pool ${BOOSTER_POOLS}: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
        });
    } catch (err) {
        console.error("[-] Transaction Error")
        console.error(err.message);
    }
    
    console.log("[*] OGNFT Harvest");
    try {
        const gasPrice = (new web3.utils.BN(await web3.eth.getGasPrice())).add(new web3.utils.BN(gasTopup));
        await ognft.methods['harvest(uint256[])'](ognftPools).send({
            gasPrice: gasPrice.toString(),
            gas: gasLimit,
            from: account.address
        }).on('transactionHash', function (transactionHash) {
            console.log(`[+] Harvest from OGNFT ${OGNFT_POOLS}: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
        });
    } catch (err) {
        console.error("[-] Transaction Error")
        console.error(err.message);
    }
    
    const latteBalance = new web3.utils.BN(await latte.methods.balanceOf(account.address).call());
    if (latteBalance.gt(0)) {
        console.log(`[*] Stake ${web3.utils.fromWei(latteBalance)} LATTE to MasterBarista`);
        
        try {
            const gasPrice = (new web3.utils.BN(await web3.eth.getGasPrice())).add(new web3.utils.BN(gasTopup));
            await masterBarista.methods.depositLatteV2(account.address, latteBalance).send({
                gasPrice: gasPrice.toString(),
                gas: gasLimit,
                from: account.address
            }).on('transactionHash', function (transactionHash) {
                console.log(`[+] Stake LATTE to MasterBarista: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
            });

            const beanBalance = new web3.utils.BN(await bean.methods.balanceOf(account.address).call());
            console.log(`[*] Stake ${web3.utils.fromWei(beanBalance)} BEAN to DripBar`);
            await dripBar.methods.deposit(stakePool, beanBalance).send({
                gasPrice: gasPrice.toString(),
                gas: GAS_LIMIT,
                from: account.address
            }).on('transactionHash', function (transactionHash) {
                console.log(`[+] Stake BEAN to DripBar: ${transactionHash} (${web3.utils.fromWei(gasPrice, 'gwei')} Gwei)`);
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
                await polycatMasterChef.methods.deposit(reinvestPool, fishLPBalance, "0x0000000000000000000000000000000000000000").send({
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
