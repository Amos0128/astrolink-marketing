const { askllama } = require("../adapters/LLaMa/LLaMa");

require("dotenv").config();
process.env.DEV_MODE = "false";

async function testLlama(){
    console.log(process.env.DEV_MODE);
    const response = await askllama([{role: "user", content: "What is the capital of France?"}], {});
    console.log(response);
  
}

testLlama();