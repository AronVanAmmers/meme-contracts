const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const ERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol");

const BancorFormula = artifacts.require("./bancor/BancorFormula.sol");
const Memecoin = artifacts.require("./Memecoin.sol");
const MemecoinRegister = artifacts.require("./MemecoinRegister.sol");
const MTokenFactory = artifacts.require("./MTokenFactory.sol");

let MEMECOIN_DECIMALS = 18;

const DODGDE_MTOKEN_NAME = 'DodgeMToken';
const DODGDE_MTOKEN_SYMBOL = 'DGMT';

let TEN_AS_BN = (new BN(10));
let MEMECOIN_DECIMALS_AS_BN = TEN_AS_BN.pow(new BN(18));
let MTOKEN_CREATION_PRICE = (new BN(1e6)).mul(MEMECOIN_DECIMALS_AS_BN);
let MTOKEN_INITIAL_SUPPLY = (new BN(1e3)).mul(MEMECOIN_DECIMALS_AS_BN);


contract("MemecoinRegister", accounts => {

  const [owner, rickAsNotEnoughAllowance, mortyAsNotEnoughBalance, summerAsCorrectCreator, beth, jerry] = accounts;

  let ownerBalanceBeforeEachTest = null;
  let summerAsCorrectCreatorBalanceBeforeEachTest = null;

  before(async () => {
    this.memecoin = await Memecoin.new(new BN(1e8), "Memecoin", "mCoin", {from: owner});
    this.memecoinRegister = await MemecoinRegister.new();

    this.bancor = await BancorFormula.new();
    await this.bancor.init();

    this.mTokenFactory = await MTokenFactory.new(this.memecoin.address, this.bancor.address);

    await this.mTokenFactory.setMemecoinRegsiter(this.memecoinRegister.address);
    this.initialReserveCurrencySupplyOfMToken = MTOKEN_INITIAL_SUPPLY;

    // sets actors
    await this.memecoin.increaseAllowance(this.memecoinRegister.address, MTOKEN_CREATION_PRICE.add(MTOKEN_INITIAL_SUPPLY), { from: summerAsCorrectCreator });
    await this.memecoin.increaseAllowance(this.memecoinRegister.address, MTOKEN_CREATION_PRICE.add(MTOKEN_INITIAL_SUPPLY), { from: mortyAsNotEnoughBalance });
    await this.memecoin.transfer(mortyAsNotEnoughBalance,  MTOKEN_CREATION_PRICE.sub(new BN(1000)), {from: owner});
    await this.memecoin.transfer(summerAsCorrectCreator,  MTOKEN_CREATION_PRICE.add(MTOKEN_INITIAL_SUPPLY), {from: owner});
  });

  describe("MemecoinRegister behavior", async() => {
    describe("Set related contracts", async() => {
      it("Reverts when Memecoin is not set.", async () => {
        let ERROR_MEME_COIN_CONTRACT_IS_NOT_SET = await this.memecoinRegister.ERROR_MEME_COIN_CONTRACT_IS_NOT_SET();
        await expectRevert(this.memecoinRegister.createMToken('DodgeMToken', 'DMT'), ERROR_MEME_COIN_CONTRACT_IS_NOT_SET);
      });
    
      it("Set Memecoin contract", async () => {
        let newMemecoinAddress = await this.memecoin.address;
        let currentMemecoinAddress = await this.memecoinRegister.memecoin();
    
        const { logs } = await this.memecoinRegister.setReserveCurrency(newMemecoinAddress);
        expectEvent.inLogs(logs, 'ReserveCurrencyChanged', { newReserveCurrency: newMemecoinAddress, oldReserveCurrency: currentMemecoinAddress});
    
        currentMemecoinAddress = await this.memecoinRegister.memecoin();
    
        assert.equal(newMemecoinAddress, currentMemecoinAddress);
      });
    
      it("Reverts when MTokenFactory is not set", async () => {
        let ERROR_FACTORY_CONTRACT_IS_NOT_SET = await this.memecoinRegister.ERROR_FACTORY_CONTRACT_IS_NOT_SET();
        await expectRevert(this.memecoinRegister.createMToken('DodgeMToken', 'DMT'), ERROR_FACTORY_CONTRACT_IS_NOT_SET);
      });
    
      it("Set MTokenFactory contract", async () => {
        let newTokenFactoryAddress = await this.mTokenFactory.address;
        let currentMTokenFactoryAddress = await this.memecoinRegister.mTokenFactory();
    
        const { logs } = await this.memecoinRegister.setMTokenFactory(newTokenFactoryAddress);
        expectEvent.inLogs(logs, 'MTokenFactoryChanged', { newMTokenFactory: newTokenFactoryAddress, oldMTokenFactory: currentMTokenFactoryAddress});
    
        currentMTokenFactoryAddress = await this.memecoinRegister.mTokenFactory();
    
        assert.equal(newTokenFactoryAddress, currentMTokenFactoryAddress);
      });

      describe("MToken creation", async() => {

        before(async() => {
          this.ownerBalanceBeforeTest = await this.memecoin.balanceOf(owner);
          this.summerAsCorrectCreatorBalanceBeforeTest = await this.memecoin.balanceOf(summerAsCorrectCreator);
        });

        it("Sets MToken creation Price", async () => {
          let currentMTokenCreationPrice = await this.memecoinRegister.mTokenCreationPrice();
    
          let { logs } = await this.memecoinRegister.setMTokenCreationPrice(MTOKEN_CREATION_PRICE);
          expectEvent.inLogs(logs, 'MTokenCreationPriceChanged', { newPrice: MTOKEN_CREATION_PRICE, oldPrice: currentMTokenCreationPrice});
    
          currentMTokenCreationPrice = await this.memecoinRegister.mTokenCreationPrice();
    
          assert.equal(MTOKEN_CREATION_PRICE.toString(), currentMTokenCreationPrice);
        });

        it("Sets MToken initial supply of reserve currency", async () => {
          
          let currentMTokenInititalSupply = await this.memecoinRegister.mTokenReserveCurrencyInitialSupply();
    
          let { logs } = await this.memecoinRegister.setMTokenReserveCurrencyInititalSupply(MTOKEN_INITIAL_SUPPLY);
          expectEvent.inLogs(logs, 'MTokenReserveCurrencyInititalSupplyChanged', { newInitialSupply: MTOKEN_INITIAL_SUPPLY, oldInitialSupply: currentMTokenInititalSupply});
    
          currentMTokenInititalSupply = await this.memecoinRegister.mTokenReserveCurrencyInitialSupply();
          console.log(MTOKEN_INITIAL_SUPPLY.toString())
          console.log(currentMTokenInititalSupply.toString());
          assert.equal(MTOKEN_INITIAL_SUPPLY.toString(), currentMTokenInititalSupply);
        });
    
        it("Reverts when creator has not set enough allowance", async () => {
          let ERROR_CREATOR_ALLOWANCE_LOWER_THAN_CREATION_PRICE = await this.memecoinRegister.ERROR_CREATOR_ALLOWANCE_LOWER_THAN_CREATION_PRICE();
          await expectRevert(this.memecoinRegister.createMToken(DODGDE_MTOKEN_NAME, DODGDE_MTOKEN_SYMBOL, {from: rickAsNotEnoughAllowance}), ERROR_CREATOR_ALLOWANCE_LOWER_THAN_CREATION_PRICE);
        });

        it("Reverts when creator has not enough balance", async () => {
          let ERROR_CREATOR_BALANCE_LOWER_THAN_CREATION_PRICE = await this.memecoinRegister.ERROR_CREATOR_BALANCE_LOWER_THAN_CREATION_PRICE();
          await expectRevert(this.memecoinRegister.createMToken(DODGDE_MTOKEN_NAME, DODGDE_MTOKEN_SYMBOL, {from: mortyAsNotEnoughBalance}), ERROR_CREATOR_BALANCE_LOWER_THAN_CREATION_PRICE);
        });
    
        it("Creates new MToken", async () => {
          //  set up allowance first
          let { logs } = await this.memecoinRegister.createMToken(DODGDE_MTOKEN_NAME, DODGDE_MTOKEN_SYMBOL, {from: summerAsCorrectCreator});
          let lastAddress = await this.memecoinRegister.memecoinRegister(await this.memecoinRegister.memecoinRegisterCount() -1);
          expectEvent.inLogs(logs, 'MTokenRegistered', { mTokenContract: lastAddress});
        });

        it("Owner gets paid", async () => {
          //  set up allowance first
          let ownerAsCorrectCreatorBalance = await this.memecoin.balanceOf(owner);

          assert.equal(this.ownerBalanceBeforeTest.toString(), ownerAsCorrectCreatorBalance.sub(MTOKEN_CREATION_PRICE));
        });

        it("Check index of register", async () => {
          let lastRegisteredId = new BN(await this.memecoinRegister.memecoinRegisterCount()) -1;
          let lastMTokenContractAddress = await this.memecoinRegister.memecoinRegister(lastRegisteredId);
          let mToken = await ERC20.at(lastMTokenContractAddress);

          let mTokenNameHash = await this.memecoinRegister.getNumericHashFromString(await mToken.name());
          let mTokenSymbolHash = await this.memecoinRegister.getNumericHashFromString(await mToken.symbol());

          assert.equal(await this.memecoinRegister.memecoinRegisterIndex(mTokenNameHash), lastRegisteredId);
          assert.equal(await this.memecoinRegister.memecoinSymbolRegisterIndex(mTokenSymbolHash), lastRegisteredId);
        });

        it("Reverts when caller is not in MTOKEN_FACTORY_ROLE role", async () => {
          let ERROR_CALLER_IS_NOT_MTOKEN_FACTORY = await this.memecoinRegister.ERROR_CALLER_IS_NOT_MTOKEN_FACTORY();
          await expectRevert(this.memecoinRegister.addMToken(await this.memecoin.address, {from: rickAsNotEnoughAllowance}), ERROR_CALLER_IS_NOT_MTOKEN_FACTORY);
        });
      });
    });
  });
});
