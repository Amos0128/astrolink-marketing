const CONSTANT = require('../constant');
async function filterResponse(text){
    if (text.includes("off-limit") || text.includes("not able")|| text.includes("cannot")|| text.includes("can't")){
        return '';
    }
    const filteredText = text.replace(/"/g, '');
    return filteredText;
}
async function getEndpoints(){
    if (process.env.DEV_MODE === "true"){
        return ["http://localhost:4628"];
    }
    const endpoints = await fetch("https://vps-tasknet.koii.network/nodes/73DREuENc1NawrvdsZbvUfhUVYF6voujiEVBaAxmnBwM")
    const endpointsList = (await endpoints.json()).map(node => node.data.url);
    console.log(endpointsList);
    return endpointsList;
}
async function askllama(messages, options) {
    console.log("messages", messages);
    const endpoints = await getEndpoints();
    console.log(endpoints);
    // shuffle the endpoints
    const shuffledEndpoints = endpoints.sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledEndpoints.length; i++) {
        const randomEndpoint = shuffledEndpoints[i];
        const accessLink = randomEndpoint + "/task/73DREuENc1NawrvdsZbvUfhUVYF6voujiEVBaAxmnBwM";
        const response = await fetch(`${accessLink}/ask-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ model: "koiiLlama", messages: messages, options: options }) 
          });
        try{
            const data = await response.json();
            const reply = data.reply;  
            console.log("REPLY HERE"); 
            console.log(reply);
            if (!reply) continue;
            return reply;
        } catch (error) {
            console.log(error);
        }
    }
    // if no reply from any endpoint, try the default one
    // const accessLink = "https://vps-tasknet.koii.network/task/73DREuENc1NawrvdsZbvUfhUVYF6voujiEVBaAxmnBwM";
    // const response = await fetch(`${accessLink}/ask-query`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' }, 
    //     body: JSON.stringify({ model: "koiiLlama", messages: messages, options: options }) 
    //   });
    // try{
    //     const data = await response.json();
    //     const reply = data.reply;   
    //     console.log(reply);
    //     if (!reply) return "";
    //     return reply;
    // } catch (error) {
    //     console.log(error);
    //     return "";
    // }
}
async function askGeneralQuestion(generaalQuestion){
    const messages = [
        {role: "user", content: generaalQuestion}
    ]; 
    return await askllama(messages, {temperature: 1});
    
}
async function askForComment(tweetText, character, tweetsInfo){
    
    const messages = [
        {role:"system", content: CONSTANT.COMMENT_SYSTEM_PROMPT},
        {role:"user", content: `Your character is ${character}`},
        {role:"user", content: `Your knowledge is ${tweetsInfo}`},
        {role: "user", content: `You have read the following tweet: ${tweetText}`}
    ];
    const response = await askllama(messages, {temperature: 1, num_predict: 45});
    return await filterResponse(response);
}

async function generateCharacter(){
    const userCharacterPrompt = Math.random() < 0.5 ? CONSTANT.USER_CHARACTER_PROMPT : CONSTANT.USER_CHARACTER_PROMPT_2;
    const messages = [
        {role:"system", content: CONSTANT.CHARACTER_SYSTEM_PROMPT},
        {role: "user", content: userCharacterPrompt}
    ];
    const response = await askllama(messages, {temperature: 1, num_predict: 45});
    return await filterResponse(response);
}

async function askForKeywords(){
    const messages = [
        {role:"system", content: CONSTANT.KEYWORD_SYSTEM_PROMPT},
        {role: "user", content: CONSTANT.BREIF_BG_INFO},
        {role: "user", content: CONSTANT.USER_KEYWORD_PROMPT}
    ];
    const response = await askllama(messages, {temperature: 1, num_predict: 10});
    return await filterResponse(response);
}

module.exports = { askllama, askGeneralQuestion, askForComment, askForKeywords, generateCharacter };
