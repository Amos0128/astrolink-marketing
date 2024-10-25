async function filterResponse(text){
    if (text.includes("off-limit") || text.includes("not able")|| text.includes("cannot")){
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
async function askForComment(commentPrompt){
    const messages = [
        {role:"system", content:"Your task is to generate a short, witty, and engaging Twitter-like comment, using popular internet slang and memes for a fun and relatable vibe, in response to a user-provided tweet. Please REPLY with the COMMENT only."},
        {role: "user", content: commentPrompt}
    ];
    const response = await askllama(messages, {temperature: 1, num_predict: 45});
    return await filterResponse(response);
}

async function askForKeywords(keywordsPrompt){
    const messages = [
        {role:"system", content:"Please REPLY a KEYWORD based on the user request only."},
        {role: "user", content: keywordsPrompt}
    ];
    const response = await askllama(messages, {temperature: 1, num_predict: 10});
    return await filterResponse(response);
}

module.exports = { askllama, askGeneralQuestion, askForComment, askForKeywords };
