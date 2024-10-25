const {Context} = require('../adapters/context/context');
const Twitter = require('../adapters/twitter/twitter');
const dotenv = require('dotenv');
dotenv.config();
async function test(){

    const twitter = new Twitter();
    const x = await twitter.genText('The rise of DePIN is happening, and @AUKInetwork is positioning itself at the center of this revolution. This is just the beginning');
    // console.log(x);
}

test();