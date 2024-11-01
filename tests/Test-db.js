const { Context } = require('../adapters/context/context');
async function test(){
    const context = new Context();
    await context.updateCharInfo();
}
test();