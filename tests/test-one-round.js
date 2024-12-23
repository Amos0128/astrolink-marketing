const dotenv = require('dotenv');
require('dotenv').config();
const TwitterTask = require('../twitter-task');
const Twitter = require('../adapters/twitter/twitter.js');
const { coreLogic } = require('../coreLogic');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeTasks() {
  let db;
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;
  const verification = process.env.TWITTER_VERIFICATION;
  let credentials = {
    username: username,
    password: password,
    verification: verification,
  };
  let data = {
    user_name: 'DropsTab',
    screen_name: '@Dropstab_com',
    user_url: 'https://x.com/Dropstab_com',
    user_img:
      'https://pbs.twimg.com/profile_images/1399106045226672130/-yZqAe23_x96.jpg',
    tweets_id: '1849018132272402562',
    tweets_content:
      ' Top Node Sales Calendar<br><br>@Moonveil_Studio, @huddle01com, @0G_labs, @SonicSVM and @paloma_chain<br><br>You can also explore the latest funding rounds among #DePIN projects for more insights.<br><br> https://dropstab.com/insights/latest-fundraising-rounds…',
    time_post: 1729675250,
    keyword: 'depin',
    hash: '$2a$10$6NtXnr.n.xc2r3H/Y5oJnOyme1Pm8zp89eqpCORYlYC.QDD4qyQny',
    commentDetails: {
      username: 'Soma41717079',
      commentId: '1849122458412224772',
      commentText:
        "Who else is ready to join the revolution? Let's get the scoop on these #DePIN projects and see which ones are making waves in the crypto world!",
    },
  };

  for (let i = 3; i < 4; i++) {
    let delay = 1800000;
    let round = i;
    coreLogic.task(round);
    await new Promise(resolve => setTimeout(resolve, 5000));
    coreLogic.submitTask(round);
    // await sleep(50000);

    // let adapter = new Twitter(credentials, db, 3);
    // await sleep(5000);
    // let audit = await adapter.verify(data, i);
    // console.log('audit', audit);
    // coreLogic.auditTask(round - 1);

    await sleep(delay);

    console.log('stopping searcher at round', round);
  }
}

executeTasks();
