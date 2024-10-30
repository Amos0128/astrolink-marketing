
const Datastore = require('nedb-promises');
const path = require('path');
const dotenv = require('dotenv');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const CONSTANT = require('../../adapters/constant');
const { generateCharacter, askGeneralQuestion } = require('../LLaMa/LLaMa');
dotenv.config();

class Context {

    constructor(){
        this.db = null;
    }
    // Helper function to create the database
    async createDB(){

        if (process.env.DEV_MODE){
            this.db = new Datastore({ filename: path.join(__dirname, CONSTANT.CONTEXT_DB_NAME), autoload: true });
        }else{
            const taskPath = await namespaceWrapper.getBasePath();
            const namespacePath = await path.dirname(taskPath);
            const contextFolder = await path.join(namespacePath, 'contextTwitter');
            this.db = new Datastore({ filename: path.join(contextFolder, CONSTANT.CONTEXT_DB_NAME), autoload: true });
        }
    }
    // Initialize the context
    async initializeContext(){
        if (this.db == null){
            await this.createDB();
            await this.getOrCreateCharacter();
            await this.getOrCreateTweetsInfo();
        }
    }  
    // Get the context
    async getContext(){
        const charInfo = (await this.getFromDB('Char-Info')).map(item => item.info)[0];
        const charTweetsInfo = (await this.getFromDB('Char-TweetsInfo')).map(item => item.info)[0];
        return {charInfo: charInfo, charTweetsInfo: charTweetsInfo};
    }

    async updateCharInfo(){
        const currentCharInfo = await this.getOrCreateCharacter();
        const todayGenText = await this.getFromDBWithTimestamp('Daily-GenText', 24);
        const updatePrompt = CONSTANT.USER_CHARACTER_UPDATE_PROMPT + currentCharInfo + CONSTANT.USER_CHARACTER_UPDATE_PROMPT_2 + todayGenText.map(item => item.info).join('\n') + CONSTANT.USER_CHARACTER_UPDATE_PROMPT_3;
        const updatedCharInfo = await askGeneralQuestion(updatePrompt);
        await this.updateToDB('Char-Info', updatedCharInfo);
    }

    async updateTweetsInfo(){
        const currentTweetsInfo = await this.getFromDB('Char-TweetsInfo');
        const todayTweetsInfo = await this.getFromDBWithTimestamp('Tweet-content', 24);
        const updatePrompt = CONSTANT.USER_TWEETS_INFO_UPDATE_PROMPT + currentTweetsInfo + CONSTANT.USER_TWEETS_INFO_UPDATE_PROMPT_2 + todayTweetsInfo.map(item => item.info).join('\n') + CONSTANT.USER_TWEETS_INFO_UPDATE_PROMPT_3;
        const updatedTweetsInfo = await askGeneralQuestion(updatePrompt);
        await this.updateToDB('Char-TweetsInfo', updatedTweetsInfo);
    }

    async getOrCreateCharacter(){
        await this.initializeContext();
        const contextCharacter = await this.getFromDB('Char-Info');
        if (contextCharacter.length > 0){
          return contextCharacter[0].info;
        }else{
          const character = await generateCharacter();
          await this.addToDB('Char-Info', character);
          return character;
        }
    }
    async getOrCreateTweetsInfo(){
        const contextTweetsInfo = await this.getFromDB('Char-TweetsInfo');
        if (contextTweetsInfo.length > 0){
            return contextTweetsInfo[0].info;
        }else{
          await this.addToDB('Char-TweetsInfo', '');
          return '';
        }
    }

    async addToDB(type, info){
        const data = {type: type, info: info, timestamp: Date.now()};
        // Check if info already exists
        const existing_info = await this.db.find({type: type, info: info});
        if (existing_info.length === 0){
            await this.db.insert(data);
        }
    }

    async checkUpdates(){
        const contextTweetsInfo = await this.getFromDB('Char-TweetsInfo');
        if (contextTweetsInfo.length > 0 && contextTweetsInfo[0].timestamp > Date.now() - 24 * 60 * 60 * 1000){
            await this.updateTweetsInfo();
        }
        const contextCharacter = await this.getFromDB('Char-Info');
        if (contextCharacter.length > 0 && contextCharacter[0].timestamp > Date.now() - 24 * 60 * 60 * 1000){
            await this.updateCharInfo();
        }
    }

    async updateToDB(type, info){
        const data = {type: type, info: info, timestamp: Date.now()};
        await this.db.update({type: type}, data, {upsert: true});
    }
    async getFromDB(type){
        const data = await this.db.find({type: type});
        return data;
    }

    async getFromDBWithTimestamp(type, past_hours){
        const timestamp_start = Date.now() - past_hours * 60 * 60 * 1000;
        const data = await this.db.find({type: type, timestamp: {$gte: timestamp_start, $lte: Date.now()}});
        return data;
    }

}
// const context = new Context();
// async function test(){
//     await context.initializeContext();
//     const character = await context.getCharacter();
//     console.log(character);
// }
// test();
module.exports = { Context };
