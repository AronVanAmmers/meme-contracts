const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const ERC20 = artifacts.require("@openzeppelin/contracts/token/ERC20/ERC20.sol");

const BancorFormula = artifacts.require("./bancor/BancorFormula.sol");
const Memecoin = artifacts.require("./Memecoin.sol");
const MemecoinRegister = artifacts.require("./MemecoinRegister.sol");
const MTokenFactory = artifacts.require("./MTokenFactory.sol");
const MToken = artifacts.require("./MToken.sol");

let MEMECOIN_DECIMALS = 18;

const DODGDE_MTOKEN_NAME = 'DodgeMToken';
const DODGDE_MTOKEN_SYMBOL = 'DGMT';
const COOLPANDA_MTOKEN_NAME = 'COOLPANDA';
const COOLPANDA_MTOKEN_SYMBOL = 'CLP';

let TEN_AS_BN = (new BN(10));
let MEMECOIN_DECIMALS_AS_BN = TEN_AS_BN.pow(new BN(18));
let MTOKEN_CREATION_PRICE = (new BN(1e6)).mul(MEMECOIN_DECIMALS_AS_BN);
let MTOKEN_INITIAL_SUPPLY = (new BN(1e3)).mul(MEMECOIN_DECIMALS_AS_BN);
let ENOUGH_COINS_TO_CREATE_MTOKEN = MTOKEN_CREATION_PRICE.add(MTOKEN_INITIAL_SUPPLY);

const addFundsToActor = async (actor, value, coin, coinOwner, allowanceTo, valueAllowance) => {
  await coin.transfer(actor, value, {from: coinOwner});

  if (allowanceTo) {
    await coin.increaseAllowance(this.memecoinRegister.address, value, { from: actor });
  }
}

const increaseAllowence = async (actor, value, coin, allowanceTo) => {
    await coin.increaseAllowance(this.memecoinRegister.address, value, { from: actor });
}

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
    await addFundsToActor(mortyAsNotEnoughBalance, ENOUGH_COINS_TO_CREATE_MTOKEN.sub(new BN(1000)), this.memecoin, owner);
    await increaseAllowence(mortyAsNotEnoughBalance, ENOUGH_COINS_TO_CREATE_MTOKEN, this.memecoin, this.memecoinRegister.address);

    await addFundsToActor(summerAsCorrectCreator, ENOUGH_COINS_TO_CREATE_MTOKEN.mul(new BN(3)), this.memecoin, owner);
    await increaseAllowence(summerAsCorrectCreator, ENOUGH_COINS_TO_CREATE_MTOKEN.mul(new BN(3)), this.memecoin, this.memecoinRegister.address);
    
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
          let lastAddress = await this.memecoinRegister.memecoinRegisterIndex(await this.memecoinRegister.totalRegistered() -1);
          let memecoinRegistration = await this.memecoinRegister.memecoinRegister(lastAddress);

          console.log(memecoinRegistration);
          expectEvent.inLogs(logs, 'MTokenRegistered', { mTokenContract: lastAddress});
        });

        it("Owner gets paid", async () => {
          //  set up allowance first
          let ownerAsCorrectCreatorBalance = await this.memecoin.balanceOf(owner);

          assert.equal(this.ownerBalanceBeforeTest.toString(), ownerAsCorrectCreatorBalance.sub(MTOKEN_CREATION_PRICE));
        });

        it("Check index of registered mToken", async () => {
          let lastRegisteredId = new BN(await this.memecoinRegister.totalRegistered()) -1;
          let lastMTokenContractAddress = await this.memecoinRegister.memecoinRegisterIndex(lastRegisteredId);
          let mToken = await ERC20.at(lastMTokenContractAddress);

          let mTokenNameHash = await this.memecoinRegister.getNumericHashFromString(await mToken.name());
          let mTokenSymbolHash = await this.memecoinRegister.getNumericHashFromString(await mToken.symbol());

          assert.equal(await this.memecoinRegister.nameHashIndex(mTokenNameHash), lastMTokenContractAddress);
          assert.equal(await this.memecoinRegister.symbolHashIndex(mTokenSymbolHash), lastMTokenContractAddress);
        });

        it("Reverts name exists", async () => {
          let ERROR_NAME_IS_TAKEN = await this.memecoinRegister.ERROR_NAME_IS_TAKEN();
          await expectRevert(this.memecoinRegister.createMToken(DODGDE_MTOKEN_NAME, COOLPANDA_MTOKEN_SYMBOL, {from: summerAsCorrectCreator}), ERROR_NAME_IS_TAKEN);
        });

        it("Reverts symbol exists", async () => {
          let ERROR_SYMBOL_IS_TAKEN = await this.memecoinRegister.ERROR_SYMBOL_IS_TAKEN();
          await expectRevert(this.memecoinRegister.createMToken(COOLPANDA_MTOKEN_NAME, DODGDE_MTOKEN_SYMBOL, {from: summerAsCorrectCreator}), ERROR_SYMBOL_IS_TAKEN);
        });

        it("Creates another cool MToken", async () => {
          let { logs } = await this.memecoinRegister.createMToken(COOLPANDA_MTOKEN_NAME, COOLPANDA_MTOKEN_SYMBOL, {from: summerAsCorrectCreator});
          let lastAddress = await this.memecoinRegister.memecoinRegisterIndex(await this.memecoinRegister.totalRegistered() -1);
          expectEvent.inLogs(logs, 'MTokenRegistered', { mTokenContract: lastAddress});

          let mToken = await ERC20.at(lastAddress);
          assert.equal(await mToken.name(), COOLPANDA_MTOKEN_NAME);
          assert.equal(await mToken.symbol(), COOLPANDA_MTOKEN_SYMBOL);
        });
      });

      describe("MToken creation - valid token name and symbol", async() => {

        beforeEach(async() => {
          await this.memecoin.transfer(summerAsCorrectCreator,  MTOKEN_CREATION_PRICE.add(MTOKEN_INITIAL_SUPPLY), {from: owner});
          await this.memecoin.increaseAllowance(this.memecoinRegister.address, MTOKEN_CREATION_PRICE.add(MTOKEN_INITIAL_SUPPLY), { from: summerAsCorrectCreator });
        });

        it("MToken name and symbol valid", async () => {
          let { logs } = await this.memecoinRegister.createMToken("Dodge Meme", "DGMXXXX", {from: summerAsCorrectCreator});
          let lastAddress = await this.memecoinRegister.memecoinRegisterIndex(await this.memecoinRegister.totalRegistered() -1);
          expectEvent.inLogs(logs, 'MTokenRegistered', { mTokenContract: lastAddress});
        });

        it("MToken name invalid and symbol valid", async () => {
          let ERROR_MEME_TOKEN_NAME_CONTAINS_INVALID_CHARS = await this.memecoinRegister.ERROR_MEME_TOKEN_NAME_CONTAINS_INVALID_CHARS();
          await expectRevert(this.memecoinRegister.createMToken("Dodge\tMeme 2", "DGMXXXX2", {from: summerAsCorrectCreator}), ERROR_MEME_TOKEN_NAME_CONTAINS_INVALID_CHARS);
        });

        it("MToken name empty and symbol valid", async () => {
          let ERROR_MEME_TOKEN_NAME_EMPTY_OR_WHITESPACES_ONLY = await this.memecoinRegister.ERROR_MEME_TOKEN_NAME_EMPTY_OR_WHITESPACES_ONLY();
          await expectRevert(this.memecoinRegister.createMToken("", "DGMXXXX3", {from: summerAsCorrectCreator}), ERROR_MEME_TOKEN_NAME_EMPTY_OR_WHITESPACES_ONLY);
        });

        it("MToken name valid and symbol invalid", async () => {
          let ERROR_MEME_TOKEN_SYMBOL_CONTAINS_INVALID_CHARS = await this.memecoinRegister.ERROR_MEME_TOKEN_SYMBOL_CONTAINS_INVALID_CHARS();
          await expectRevert(this.memecoinRegister.createMToken("Dodge Meme 4  ", "DGMXXXX\t4", {from: summerAsCorrectCreator}), ERROR_MEME_TOKEN_SYMBOL_CONTAINS_INVALID_CHARS);
        });

        it("MToken name valid and symbol empty", async () => {
          let ERROR_MEME_TOKEN_SYMBOL_EMPTY_OR_WHITESPACES_ONLY = await this.memecoinRegister.ERROR_MEME_TOKEN_SYMBOL_EMPTY_OR_WHITESPACES_ONLY();
          await expectRevert(this.memecoinRegister.createMToken("Dodge Meme 5", "  ", {from: summerAsCorrectCreator}), ERROR_MEME_TOKEN_SYMBOL_EMPTY_OR_WHITESPACES_ONLY);
        });

        it("MToken name and symbol are correctly stripped", async () => {
          await this.memecoinRegister.createMToken("   Dodge Meme 6     ", "   DGMXXXX6  ", {from: summerAsCorrectCreator});
          let lastAddress = await this.memecoinRegister.memecoinRegisterIndex(await this.memecoinRegister.totalRegistered() -1);
          let mToken = await MToken.at(lastAddress);

          let name = await mToken.name();
          let symbol = await mToken.symbol();

          assert.equal(name, "Dodge Meme 6");
          assert.equal(symbol, "DGMXXXX6");
        });

      });
    });
  });
});
