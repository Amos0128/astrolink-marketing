const Datastore = require('nedb-promises');
const path = require('path');
const dotenv = require('dotenv');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const CONSTANT = require('../../adapters/constant');
const { generateCharacter, askGeneralQuestion } = require('../LLaMa/LLaMa');
dotenv.config();

class Context {
  constructor() {
    this.db = null;
    this._initializationPromise = this.initializeContext();
  }

  async initialized() {
    await this._initializationPromise;
    return this;
  }

  // Helper function to create the database
  async createDB() {
    if (process.env.DEV_MODE) {
      this.db = new Datastore({
        filename: path.join(__dirname, CONSTANT.CONTEXT_DB_NAME),
        autoload: true,
      });
    } else {
      const taskPath = await namespaceWrapper.getBasePath();
      const namespacePath = await path.dirname(taskPath);
      const contextFolder = await path.join(namespacePath, 'contextTwitter');
      this.db = new Datastore({
        filename: path.join(contextFolder, CONSTANT.CONTEXT_DB_NAME),
        autoload: true,
      });
    }
  }
  // Initialize the context
  async initializeContext() {
    if (this.db == null) {
      await this.createDB();
      await this.getOrCreateCharacter();
      // await this.getOrCreateTweetsInfo();
    }
  }

  async getMarketingBrief() {
    const marketingBriefServer = 'http://155.138.159.140:3009/getEssentialInfo';
    const response = await fetch(marketingBriefServer);
    const data = await response.json();
    const randomIndex = Math.floor(Math.random() * data.MarketBrief.length);
    const randomBrief = data.MarketBrief[randomIndex][0];
    return { randomIndex, randomBrief };
  }
  // // Get the context
  // async getContext(){
  //     const charInfo = (await this.getFromDB('Char-Info')).map(item => item.info)[0];
  //     const charTweetsInfo = (await this.getFromDB('Char-TweetsInfo')).map(item => item.info)[0];
  //     return {charInfo: charInfo, charTweetsInfo: charTweetsInfo};
  // }

  // async updateCharInfo(){
  //     const currentCharInfo = await this.getOrCreateCharacter();
  //     const todayGenText = await this.getFromDBWithTimestamp('Daily-GenText', 24);
  //     if (todayGenText.length == 0){
  //         console.log("Retrieved charinfo but no todayGenText");
  //         return;
  //     }
  //     const todayGenTextStr = todayGenText.map(item => item.info).join('\n');
  //     const updatePrompt = CONSTANT.USER_CHARACTER_UPDATE_PROMPT + currentCharInfo + CONSTANT.USER_CHARACTER_UPDATE_PROMPT_2 + todayGenTextStr + CONSTANT.USER_CHARACTER_UPDATE_PROMPT_3;
  //     const updatedCharInfo = await askGeneralQuestion(updatePrompt);
  //     console.log("updatedCharInfo");
  //     console.log(updatedCharInfo);
  //     await this.updateToDB('Char-Info', updatedCharInfo);
  // }

  // async updateTweetsInfo(){
  //     let updatePrompt = "";
  //     const currentTweetsInfo = await this.getFromDB('Char-TweetsInfo');
  //     const currentTweetsInfoStr = currentTweetsInfo.map(item => item.info).join('\n');
  //     if (!currentTweetsInfoStr == ""){
  //         updatePrompt += CONSTANT.USER_TWEETS_INFO_UPDATE_PROMPT + currentTweetsInfoStr
  //     }
  //     const todayTweetsInfo = await this.getFromDBWithTimestamp('Tweet-content', 24);
  //     const todayTweetsInfoStr = todayTweetsInfo.map(item => item.info).join('\n');
  //     if (!todayTweetsInfoStr == ""){
  //         updatePrompt += CONSTANT.USER_TWEETS_INFO_UPDATE_PROMPT_2 + todayTweetsInfoStr;
  //     }
  //     updatePrompt += CONSTANT.USER_TWEETS_INFO_UPDATE_PROMPT_3;
  //     const updatedTweetsInfo = await askGeneralQuestion(updatePrompt);
  //     console.log("updatedTweetsInfo");
  //     console.log(updatedTweetsInfo);
  //     await this.updateToDB('Char-TweetsInfo', updatedTweetsInfo);
  // }

  async getOrCreateCharacter() {
    const contextCharacter = await this.getFromDB('Char-Info');
    if (contextCharacter.length > 0) {
      console.log('RETRIEVED CHARACTER');
      const character = contextCharacter[0].info;
      console.log(character);
      return character;
    } else {
      console.log('GENERATED CHARACTER');
      const response = await generateCharacter();
      const character = response.reply;
      await this.addToDB('Char-Info', character);
      return character;
    }
  }
  //     async getOrCreateTweetsInfo(){
  //         const contextTweetsInfo = await this.getFromDB('Char-TweetsInfo');
  //         if (contextTweetsInfo.length > 0){
  //             return contextTweetsInfo[0].info;
  //         }else{
  //           await this.addToDB('Char-TweetsInfo', '');
  //           return '';
  //         }
  //     }

  async addToDB(type, info) {
    const data = { type: type, info: info, timestamp: Date.now() };
    // Check if info already exists
    const existing_info = await this.db.find({ type: type, info: info });
    if (existing_info.length === 0) {
      await this.db.insert(data);
    }
  }

  //     async checkUpdates(){
  //         const contextTweetsInfo = await this.getFromDB('Char-TweetsInfo');
  //         const contextCharacter = await this.getFromDB('Char-Info');
  //         if (process.env.DEV_MODE){
  //             console.log("DEV_MODE on")
  //             await this.updateTweetsInfo();
  //             await this.updateCharInfo();
  //             return;
  //         }
  //         if (contextTweetsInfo.length > 0 && contextTweetsInfo[0].timestamp > Date.now() - 24 * 60 * 60 * 1000){
  //             await this.updateTweetsInfo();
  //         }

  //         if (contextCharacter.length > 0 && contextCharacter[0].timestamp > Date.now() - 24 * 60 * 60 * 1000){
  //             await this.updateCharInfo();
  //         }

  //     }

  //     async updateToDB(type, info){
  //         const data = {type: type, info: info, timestamp: Date.now()};
  //         await this.db.update({type: type}, data, {upsert: true});
  //     }
  async getFromDB(type) {
    const data = await this.db.find({ type: type });
    return data;
  }

  //     async getFromDBWithTimestamp(type, past_hours){
  //         const timestamp_start = Date.now() - past_hours * 60 * 60 * 1000;
  //         const data = await this.db.find({type: type, timestamp: {$gte: timestamp_start, $lte: Date.now()}});
  //         return data;
  //     }
}
// const context = new Context();
// async function test(){
//     await context.initializeContext();
//     const character = await context.getCharacter();
//     console.log(character);
// }
// test();
module.exports = { Context };
