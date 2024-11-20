const { Context } = require('../adapters/context/context');
const {
    // askGeneralQuestion,
    askForComment,
    // askForKeywords,
    // generateCharacter,
  } = require('../adapters/LLaMa/LLaMa');
async function test(){
    const context = new Context();
    await context.initializeContext();
    // await this.context.checkUpdates();
    const character = await context.getOrCreateCharacter();
    // const tweetsInfo = await this.context.getOrCreateTweetsInfo();
    const marketingBrief = await context.getMarketingBrief();
    const textToRead = "No one is better than grass coin!"
    const commentResponse = await askForComment(
      textToRead,
      character,
      marketingBrief,
    );
    console.log(commentResponse)
}
test();