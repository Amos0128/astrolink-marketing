
const Datastore = require('nedb-promises');
const path = require('path');
const dotenv = require('dotenv');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const CONSTANT = require('../../adapters/constant');
const { generateCharacter } = require('../LLaMa/LLaMa');
dotenv.config();

class Context {
    db = null
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
            // const charInfoExists = await this.db.find({type: 'Char-Info'});
            // if(charInfoExists.length === 0){
            //     await this.updateToDB('Char-Info', "You are a social media personality, desiring to build your online presence and brand. Please read the associated information and use it as a context for your knowledge.");
            //     await this.updateToDB('Char-Personality', "Now imagine your character and define the role you'd take to be a provocative, scandalous personality online. List the character traits and how you'd reply to different types of comments and posts. Be true to your character");
            //     await this.updateToDB('Char-Purpose', " Your goal is to understand new keywords, and learn about the subjects discussed.");
            // }   
        }
    }  
    // Get the context
    async getContext(){
        const context = (await this.getFromDB('Char-Info')).map(item => item.info)[0];
        const personality = (await this.getFromDB('Char-Personality')).map(item => item.info)[0];
        const purpose = (await this.getFromDB('Char-Purpose')).map(item => item.info)[0];
        const contextInText = `${context}\n${personality}\n${purpose}`;
        return contextInText;
    }

    // async getDailyInfo(){
    //     const daily_info = await this.getFromDBWithTimestamp('Cron-Info', 24);
    //     const daily_genText = await this.getFromDBWithTimestamp('Cron-GenText', 24);
    //     const daily_info_string = daily_info.map(item => item.info).join('\n');
    //     const daily_genText_string = daily_genText.map(item => item.info).join('\n');
    //     return {daily_info: daily_info_string, daily_genText: daily_genText_string};
    // }

    // async updateContext(){
    //     const daily_info = await this.getDailyInfo();
    //     const info = (await this.getFromDB('Char-Info')).map(item => item.info)[0];
    //     const update_info_prompt = `Based on what you've learned today, how has your character changed and what do you want to say - be sure to inspire others, and use keywords from our research today. SUMMARIZE THE INFO YOU LEARNED. ${daily_info.daily_info} ${info}`;
    //     const personality = (await this.getFromDB('Char-Personality')).map(item => item.info)[0];
    //     const update_personality_prompt = `Based on the interactions we've had today, how has your character evolved - be sure to imagine a better version of yourself that empathizes with the comments you've read today. SUMMARIZE THE PERSONALITY YOU'VE DEVELOPED. ${daily_info.daily_genText}  ${personality}`;
    //     const updated_info = await askGeneralQuestion(update_info_prompt);
    //     const updated_personality = await askGeneralQuestion(update_personality_prompt);
    //     await this.updateToDB('Char-Info', updated_info);
    //     await this.updateToDB('Char-Personality', updated_personality);
    // }
    async getCharacter(){
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

    async addToDB(type, info){
        const data = {type: type, info: info, timestamp: Date.now()};
        // Check if info already exists
        const existing_info = await this.db.find({type: type, info: info});
        if (existing_info.length === 0){
            await this.db.insert(data);
        }
    }
    // async addTweetToDB(tweetText, tweet_id, views, likes){
    //     // if tweet_id already exists, update the info
    //     const existing_tweet = await this.db.find({tweet_id: tweet_id});
    //     if (existing_tweet.length === 0){
    //         const data = {type: "Cron-Info", info: tweetText, tweet_id: tweet_id, views: views, likes: likes, timestamp: Date.now()};
    //         await this.db.insert(data);
    //     }else{
    //         await this.db.update({tweet_id: tweet_id}, {info: tweetText, views: views, likes: likes}, {upsert: true});
    //     }
    // }
    
    // async addGenTextToDB(genText, generator_staking_wallet, tweet_id, likes, views){
    //     const data = {type: "Cron-GenText", info: genText, generator_staking_wallet: generator_staking_wallet, tweet_id: tweet_id, likes: likes, views: views, timestamp: Date.now()};
    //     await this.db.insert(data);
    // }

    // async updateGenTextInfo(tweet_id, likes, views) {
    //     await this.db.update({tweet_id: tweet_id}, {likes: likes, views: views}, {upsert: true});
    // }  

    async updateToDB(type, info){
        const data = {type: type, info: info, timestamp: Date.now()};
        await this.db.update({type: type}, data, {upsert: true});
    }
    async getFromDB(type){
        const data = await this.db.find({type: type});
        return data;
    }

    // async getFromDBWithTimestamp(type, past_hours){
    //     const timestamp_start = Date.now() - past_hours * 60 * 60 * 1000;
    //     const data = await this.db.find({type: type, timestamp: {$gte: timestamp_start, $lte: Date.now()}});
    //     return data;
    // }

}
const context = new Context();
async function test(){
    await context.initializeContext();
    const character = await context.getCharacter();
    console.log(character);
}
test();
module.exports = { Context };
