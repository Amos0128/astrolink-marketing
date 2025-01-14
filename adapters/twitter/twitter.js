// Import required modules
const Adapter = require('../../model/adapter');
const cheerio = require('cheerio');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk');
const Data = require('../../model/data');
const puppeteer = require('puppeteer-core');
const PCR = require('puppeteer-chromium-resolver');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const nlp = require('compromise');
const context = require('../context/context');
const os = require('os');
const {
  // askGeneralQuestion,
  askForComment,
  // askForKeywords,
  // generateCharacter,
} = require('../LLaMa/LLaMa');
/**
 * Twitter
 * @class
 * @extends Adapter
 * @description
 * Provides a searcher interface for the data gatherer nodes to use to interact with twitter
 */

class Twitter extends Adapter {
  constructor(credentials, db, maxRetry) {
    super(credentials, maxRetry);
    this.credentials = credentials;
    this.db = new Data('db', []);
    this.db.initializeData();
    this.proofs = new Data('proofs', []);
    this.proofs.initializeData();
    this.cids = new Data('cids', []);
    this.cids.initializeData();
    this.commentsDB = new Data('comment', []);
    this.commentsDB.initializeData();
    this.searchTerm = [];
    this.lastSessionCheck = null;
    this.sessionValid = false;
    this.browser = null;
    this.round = null;
    this.maxRetry = maxRetry;
    this.comment = '';
    this.meme = '';
    this.username = '';
    this.context = context;
  }

  /**
   * checkSession
   * @returns {Promise<boolean>}
   * @description
   * 1. Check if the session is still valid
   * 2. If the session is still valid, return true
   * 3. If the session is not valid, check if the last session check was more than 1 minute ago
   * 4. If the last session check was more than 1 minute ago, negotiate a new session
   */
  checkSession = async () => {
    if (this.sessionValid) {
      return true;
    } else if (Date.now() - this.lastSessionCheck > 50000) {
      await this.negotiateSession();
      return true;
    } else {
      return false;
    }
  };

  getOptions = () => {
    let revision;

    if (os.platform() === 'darwin') {
      if (os.arch() === 'arm64') {
        // Apple Silicon (M1/M2) Mac
        revision = '1398047'; // Replace with the correct revision number for Mac_Arm
      } else {
        // Intel-based Mac
        revision = '1398623'; // Replace with the correct revision number for Mac
      }
    } else {
      switch (os.platform()) {
        case 'linux':
          revision = '1398043';
          break;
        case 'win32': // Windows
          revision = '1398050';
          break;
        default:
          throw new Error('Unsupported platform');
      }
    }

    return {
      revision, // Chromium revision based on OS
      detectionPath: './.chromium-browser-snapshots', // Path to store Chromium
      download: true, // Automatically download Chromium
    };
  };

  /**
   * negotiateSession
   * @returns {Promise<void>}
   * @description
   * 1. Get the path to the Chromium executable
   * 2. Launch a new browser instance
   * 3. Open a new page
   * 4. Set the viewport size
   * 5. Queue twitterLogin()
   */
  negotiateSession = async () => {
    await this.context.initializeContext();
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('Old browser closed');
      }
      // Resolve Chromium
      const options = this.getOptions();

      const stats = await PCR(options);
      console.log(options);
      console.log('Step: Launch browser');

      this.browser = await puppeteer.launch({
        executablePath: stats.executablePath, // Dynamic Chromium executablePath
        // executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        // headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-gpu',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-software-rasterizer',
        ],
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });

      console.log('Step: Open new page');
      this.page = await this.browser.newPage();

      // Set a mobile viewport size
      await this.page.setViewport({
        width: 1920,
        height: 1080,
      });
      // Set a mobile user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      );

      // TEST ONLY
      // await this.page.goto('https://bot-detector.rebrowser.net/');
      // await new Promise(resolve => setTimeout(resolve, 1000));
      // await this.page.screenshot({ path: 'screenshot.png' });

      await new Promise(resolve => setTimeout(resolve, 10000));
      await this.twitterLogin(this.page, this.browser);
      return true;
    } catch (e) {
      console.log('Error negotiating session', e);
      return false;
    }
  };

  /**
   * twitterLogin
   * @returns {Promise<void>}
   * @description
   * 1. Go to x.com
   * 2. Go to login page
   * 3. Fill in username
   * 4. Fill in password
   * 5. Click login
   * 6. Wait for login to complete
   * 7. Check if login was successful
   * 8. If login was successful, return true
   * 9. If login was unsuccessful, return false
   * 10. If login was unsuccessful, try again
   */
  twitterLogin = async (currentPage, currentBrowser) => {
    let currentAttempt = 0;
    const cookieLoginSuccess = await this.tryLoginWithCookies(currentPage);
    if (cookieLoginSuccess) {
      this.sessionValid = true;
      return this.sessionValid;
    }
    while (currentAttempt < this.maxRetry && !this.sessionValid) {
      try {
        console.log(currentAttempt, this.maxRetry);
        console.log('Step: Go to login page');
        await currentPage.goto('https://x.com/i/flow/login', {
          timeout: await 60000,
          waitUntil: 'networkidle0',
        });
        let basePath = '';
        basePath = await namespaceWrapper.getBasePath();
        console.log('Waiting for login page to load');

        // Retrieve the outer HTML of the body element
        const bodyHTML = await currentPage.evaluate(
          () => document.body.outerHTML,
        );

        // Write the HTML to a file
        fs.writeFileSync(`${basePath}/bodyHTML.html`, bodyHTML);

        await currentPage.waitForSelector('input', {
          timeout: await 60000,
        });
        // Select the div element by its aria-labelledby attribute
        const usernameHTML = await currentPage.$eval(
          'input',
          el => el.outerHTML,
        );

        // Use fs module to write the HTML to a file
        fs.writeFileSync(`${basePath}/usernameHTML.html`, usernameHTML);

        await currentPage.waitForSelector('input[name="text"]', {
          timeout: await 60000,
        });

        console.log('Step: Fill in username');
        console.log(this.credentials.username);

        await this.humanType(
          currentPage,
          'input[name="text"]',
          this.credentials.username,
        );

        await currentPage.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const twitter_verify = await currentPage
          .waitForSelector('input[data-testid="ocfEnterTextTextInput"]', {
            timeout: 5000,
            visible: true,
          })
          .then(() => true)
          .catch(() => false);

        if (twitter_verify) {
          console.log('Twitter verify needed, trying verification');
          console.log('Step: Fill in verification');

          await this.humanType(
            currentPage,
            'input[data-testid="ocfEnterTextTextInput"]',
            this.credentials.verification,
          );
          await currentPage.keyboard.press('Enter');

          // add delay
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // Select the div element by its aria-labelledby attribute
        const passwordHTML = await currentPage.$$eval('input', elements =>
          elements.map(el => el.outerHTML).join('\n'),
        );

        // Use fs module to write the HTML to a file
        fs.writeFileSync(`${basePath}/passwordHTML.html`, passwordHTML);

        await currentPage.waitForSelector('input[name="password"]');
        console.log('Step: Fill in password');
        await this.humanType(
          currentPage,
          'input[name="password"]',
          this.credentials.password,
        );

        console.log('Step: Click login button');
        await currentPage.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!(await this.checkLogin(currentBrowser))) {
          console.log('Password is incorrect or email verification needed.');
          namespaceWrapper.logger(
            'error',
            'Password is incorrect or email verification needed. Login attempt failed.',
            'Check your username and password! Do not use email as your username!',
          );
          await new Promise(resolve => setTimeout(resolve, 5000));
          this.sessionValid = false;
          process.exit(1);
        } else if (await this.isEmailVerificationRequired(currentPage)) {
          console.log('Email verification required.');
          this.sessionValid = false;
          await new Promise(resolve => setTimeout(resolve, 2000));
          process.exit(1);
        } else {
          console.log('Password is correct.');
          currentPage.waitForNavigation({ waitUntil: 'load' });
          await new Promise(resolve => setTimeout(resolve, 2000));

          this.sessionValid = true;
          this.lastSessionCheck = Date.now();

          console.log('Step: Login successful');

          // Extract cookies
          const cookies = await currentPage.cookies();
          // console.log('cookies', cookies);
          // Save cookies to database
          await this.saveCookiesToDB(cookies);
        }
        return this.sessionValid;
      } catch (e) {
        console.log(
          `Error logging in, retrying ${currentAttempt + 1} of ${
            this.maxRetry
          }`,
          e,
        );
        currentAttempt++;

        if (currentAttempt === this.maxRetry) {
          console.log('Max retry reached, exiting');
          process.exit(1);
        }
      }
    }
  };

  tryLoginWithCookies = async currentPage => {
    const cookies = await this.db.getItem({ id: 'cookies' });
    // console.log('cookies', cookies);
    if (cookies !== null) {
      // set the cookies
      await currentPage.setCookie(...cookies[0].data);
      await currentPage.goto('https://x.com/home');
      await new Promise(resolve => setTimeout(resolve, 3000));

      const isLoggedIn =
        (await currentPage.url()) !==
          'https://x.com/i/flow/login?redirect_after_login=%2Fhome' &&
        !(await currentPage.url()).includes('https://x.com/?logout=');

      if (isLoggedIn) {
        console.log('Logged in using existing cookies');
        console.log('Updating last session check');
        const cookies = await currentPage.cookies();
        this.saveCookiesToDB(cookies);
        this.sessionValid = true;
        // Optionally, refresh or validate cookies here
      } else {
        console.log('No valid cookies found, proceeding with manual login');
        this.sessionValid = false;
      }
      return this.sessionValid;
    } else {
      console.log('No cookies found');
      return false;
    }
  };

  checkLogin = async currentBrowser => {
    const newPage = await currentBrowser.newPage();
    await new Promise(resolve => setTimeout(resolve, 3000));
    await newPage.goto('https://x.com/home');
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Replace the selector with a Twitter-specific element that indicates a logged-in state
    const isLoggedIn =
      (await newPage.url()) !==
        'https://x.com/i/flow/login?redirect_after_login=%2Fhome' &&
      !(await newPage.url()).includes('https://x.com/?logout=');
    if (isLoggedIn) {
      // console.log('Logged in using existing cookies');
      console.log('Updating last session check');
      this.sessionValid = true;
    } else {
      console.log('No valid cookies found, proceeding with manual login');
      this.sessionValid = false;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    await newPage.close();
    return this.sessionValid;
  };

  isEmailVerificationRequired = async currentPage => {
    // Wait for some time to allow the page to load the required elements
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if the specific text is present on the page
    const textContent = await currentPage.evaluate(
      () => document.body.textContent,
    );
    return textContent.includes(
      'Verify your identity by entering the email address associated with your X account.',
    );
  };

  // create new page
  createNewPage = async () => {
    let currentAttempt = 0;
    while (currentAttempt < 3) {
      try {
        const newPage = await this.browser.newPage();
        return newPage;
      } catch (e) {
        console.log('Error creating new page', e);
        currentAttempt++;
      }
    }
    return null;
  };

  // save to db
  saveCookiesToDB = async cookies => {
    try {
      const data = await this.db.getItem({ id: 'cookies' });
      if (data && data.data) {
        await this.db.updateCookie({ id: 'cookies', data: cookies });
      } else {
        await this.db.create({ id: 'cookies', data: cookies });
      }
    } catch (e) {
      console.log('Error saving cookies to database', e);
    }
  };

  /**
   * getSubmissionCID
   * @param {string} round - the round to get the submission cid for
   * @returns {string} - the cid of the submission
   * @description - this function should return the cid of the submission for the given round
   * if the submission has not been uploaded yet, it should upload it and return the cid
   */
  getSubmissionCID = async round => {
    if (this.proofs) {
      // we need to upload proofs for that round and then store the cid
      const data = await this.cids.getList({ round: round });
      console.log(`got data for round ${round}`);
      console.log(data);
      if (data && data.length === 0) {
        console.log('No cids found for round ' + round);
        return null;
      } else {
        let proof_cid;
        let path = `dataList.json`;
        let basePath = '';
        try {
          basePath = await namespaceWrapper.getBasePath();
          fs.writeFileSync(`${basePath}/${path}`, JSON.stringify(data));
        } catch (err) {
          console.log(err);
        }
        try {
          const client = new KoiiStorageClient(undefined, undefined, false);
          const userStaking = await namespaceWrapper.getSubmitterAccount();
          console.log(`Uploading ${basePath}/${path}`);
          const fileUploadResponse = await client.uploadFile(
            `${basePath}/${path}`,
            userStaking,
          );
          console.log(`Uploaded ${basePath}/${path}`);
          const cid = fileUploadResponse.cid;
          proof_cid = cid;
          await this.proofs.create({
            id: 'proof:' + round,
            proof_round: round,
            proof_cid: proof_cid,
          });

          console.log('returning proof cid for submission', proof_cid);
          return proof_cid;
        } catch (error) {
          if (error.message === 'Invalid Task ID') {
            console.error('Error: Invalid Task ID');
          } else {
            console.error('An unexpected error occurred:', error);
          }
        }
      }
    } else {
      throw new Error('No proofs database provided');
    }
  };

  humanType = async (page, selector, genText) => {
    // Focus on the input field
    if (selector !== null) {
      await page.click(selector);
    }
    // Use Array.from to correctly handle emojis and surrogate pairs
    const characters = Array.from(genText);

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      // console.log('Typing character:', char);

      // Check if the character is an emoji or special character (non-ASCII)
      if (char.match(/[\u{1F600}-\u{1F6FF}]/u) || char.match(/[^\x00-\x7F]/)) {
        // Use page.type for emojis and other non-ASCII characters
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.type(selector, char);
      } else {
        // Use keyboard.press for normal characters
        if (char === ' ') {
          await page.keyboard.press('Space'); // Handle spaces explicitly
        } else if (char === char.toUpperCase() && char.match(/[a-zA-Z]/)) {
          await page.keyboard.down('Shift'); // Hold down Shift for capital letters
          await page.keyboard.press(char); // Press the capital letter
          await page.keyboard.up('Shift'); // Release Shift
        } else {
          await page.keyboard.press(char); // Press lowercase letters and other symbols
        }
      }

      // Randomly vary typing speed to mimic human behavior
      const typingSpeed = Math.random() * 250 + 50;
      await new Promise(resolve => setTimeout(resolve, typingSpeed));

      // Randomly add "thinking pauses" after some words
      if (char === ' ' && Math.random() < 0.2) {
        const thinkingPause = Math.random() * 1500 + 500;
        await new Promise(resolve => setTimeout(resolve, thinkingPause));
      }

      // Randomly simulate small typing errors and corrections
      if (Math.random() < 0.08) {
        // 8% chance of error
        const errorChar = String.fromCharCode(
          Math.floor(Math.random() * 26) + 97,
        ); // Random lowercase letter
        await page.keyboard.type(errorChar); // Type incorrect character
        await new Promise(resolve => setTimeout(resolve, typingSpeed / 0.8)); // Short delay after mistake
        await page.keyboard.press('Backspace'); // Correct the mistake
      }

      // Randomly add a longer pause to mimic thinking (more rarely)
      if (Math.random() < 0.1) {
        const longPause = Math.random() * 2000 + 500;
        await new Promise(resolve => setTimeout(resolve, longPause));
      }
    }

    // Extra delay after finishing typing to simulate human thinking or reviewing
    const finishDelay = Math.random() * 2000 + 1000;
    console.log(
      `Finished typing. Waiting for additional mouse delay of ${finishDelay} ms`,
    );

    // Simulate random mouse movement during the pause
    await new Promise(resolve => setTimeout(resolve, finishDelay));
  };

  // clean text
  cleanText = async text => {
    return text.replace(/\s+/g, '').trim();
  };

  moveMouseSmoothly = async (page, targetX, targetY) => {
    const minSteps = 5;
    const maxSteps = 20;
    const steps =
      Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;

    for (let i = 0; i <= steps; i++) {
      await page.mouse.move(
        targetX - (targetX / steps) * (steps - i),
        targetY - (targetY / steps) * (steps - i),
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  getArticleContainer = async (currentPage, tweetId, tweets_content) => {
    // Fetch all article containers
    const articles = await currentPage.$$('article[data-testid="tweet"]');

    for (const article of articles) {
      // Check if this article matches the tweetId or tweet content
      const tweetUrl = await article.$eval(
        'a[href*="/status/"]',
        el => el.href,
      );
      const extractedTweetId = tweetUrl.split('/').pop();

      // console.log(extractedTweetId, tweetId);

      if (extractedTweetId === tweetId) {
        return article; // Return the article container that matches the tweetId or content
      }
    }

    return null; // Return null if no matching article is found
  };

  clickArticle = async (currentPage, tweets_content, tweetId) => {
    // console.log('Target article: ' + tweets_content + ' ' + tweetId);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find the correct article container for the given tweetId or tweets_content
    const articleContainer = await this.getArticleContainer(
      currentPage,
      tweetId,
      tweets_content,
    );

    if (!articleContainer) {
      console.log('Article container not found.');
      return;
    }

    let textContentContainer = await articleContainer.$(
      'div[data-testid="tweetText"]',
    );

    if (!textContentContainer) {
      console.log('Text content container not found in the article.');
      return;
    }

    let textBox = await textContentContainer.boundingBox();

    const isVisible = async box => {
      const viewport = await currentPage.viewport();
      return box && box.y >= 0 && box.y + box.height <= viewport.height;
    };

    while (!(await isVisible(textBox))) {
      const viewport = await currentPage.viewport();
      const scrollAmount = Math.max(0, textBox.y - viewport.height / 2);

      if (scrollAmount <= 0) break;

      await this.humanLikeScroll(currentPage, scrollAmount, 5, 10);
      await new Promise(resolve => setTimeout(resolve, 2000));

      textBox = await textContentContainer.boundingBox();
    }

    if (textBox) {
      try {
        // Attempt to click the element using elementHandle.click()
        await textContentContainer.click();
        console.log('Text content clicked successfully.');
      } catch (clickError) {
        console.log(
          'elementHandle.click() failed, attempting backup click with evaluate.',
        );

        await currentPage.evaluate(el => el.click(), textContentContainer);
        console.log('Backup evaluate click executed.');
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const currentUrl = currentPage.url();
      if (currentUrl.includes('/photo/')) {
        console.log('Photo was clicked by mistake. Closing the photo.');

        const closeButtonSelector = 'div[role="button"][aria-label="Close"]';
        const closeButton = await currentPage.$(closeButtonSelector);

        if (closeButton) {
          await closeButton.click();
          console.log('Photo closed successfully.');

          // Retry clicking the text content container
          console.log('Retrying to click the text content of the article.');
          await textContentContainer.click();
          console.log(
            'Text content clicked successfully after closing the photo.',
          );
        } else {
          console.log(
            'Could not find close button for the photo. Trying to close with ESC key.',
          );
          await currentPage.keyboard.press('Escape');
        }
      } else if (currentUrl.includes(tweetId)) {
        console.log(
          'Article text content clicked successfully, continuing to comment and like.',
        );
      }
    } else {
      console.log('Text content bounding box not available.');
    }
  };

  clickLikeButton = async (currentPage, commentContainer) => {
    try {
      const buttonSelector = 'button[data-testid="like"]';
      const likeButton = await commentContainer.$(buttonSelector);

      if (!likeButton) {
        console.log('Post already liked.');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      let buttonBox = await likeButton.boundingBox();

      const isButtonVisible = async box => {
        const viewport = await currentPage.viewport();
        return box && box.y >= 0 && box.y + box.height <= viewport.height - 100;
      };

      // Scroll until the like button is within the viewport
      while (!(await isButtonVisible(buttonBox))) {
        const viewport = await currentPage.viewport();

        const scrollAmount = Math.max(0, buttonBox.y - viewport.height / 2);

        if (scrollAmount <= 0) break;

        await this.humanLikeScroll(currentPage, scrollAmount, 5, 10);
        await new Promise(resolve => setTimeout(resolve, 2000));

        buttonBox = await likeButton.boundingBox();
      }

      const isLikeButtonVisible =
        buttonBox && (await isButtonVisible(buttonBox));
      // console.log(buttonBox, await isButtonVisible(buttonBox));
      if (isLikeButtonVisible) {
        const unlikeButtonSelector = 'button[data-testid="unlike"]';
        const isUnlike = await commentContainer.$(unlikeButtonSelector);

        if (isUnlike) {
          console.log(
            'Post is already liked (unlike button present). No action taken.',
          );
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            await likeButton.click(); // Attempt direct click on the like button
            console.log('Like button clicked successfully.');
          } catch (clickError) {
            console.log('Direct click failed, trying fallback with evaluate.');

            await currentPage.evaluate(el => el.click(), likeButton);
            console.log('Fallback evaluate click executed.');
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.error('Like button is not visible or clickable.');
      }
    } catch (e) {
      console.error('Error clicking the like button:', e);
    }
  };

  // Helper function to get the comment container
  getCommentContainer = async (currentPage, commentText) => {
    const containers = await currentPage.$$('article[aria-labelledby]');

    try {
      for (const container of containers) {
        const textContent = await container.$eval(
          'div[data-testid="tweetText"]',
          el => el.innerText,
        );
        if (textContent.toLowerCase().includes(commentText.toLowerCase())) {
          return container; // Return the correct comment container
        }
      }

      return null; // No matching comment container found
    } catch (e) {
      console.log('Error getting comment container:', e);
      return null;
    }
  };

  clickCommentButton = async (currentPage, tweets_content) => {
    // Find the comment button
    const replybuttonSelector = 'button[data-testid="reply"]'; // Selector for the reply button

    // Wait for the reply button selector to appear on the page
    await currentPage.waitForSelector(replybuttonSelector, { timeout: 10000 });

    // Find all instances of the reply button
    const replyButtons = await currentPage.$$(replybuttonSelector);

    // Select the second reply button if there are at least two
    // const replyButton =
    //   replyButtons.length >= 1 ? replyButtons[1] : replyButtons[0];

    const replyButton = replyButtons[0];

    if (replyButton) {
      let replybuttonBox = await replyButton.boundingBox();

      const isButtonVisible = async box => {
        const viewport = await currentPage.viewport();
        return box && box.y >= 0 && box.y + box.height <= viewport.height - 100;
      };

      // Scroll until the like button is within the viewport
      while (!(await isButtonVisible(replybuttonBox))) {
        const viewport = await currentPage.viewport();

        const scrollAmount = Math.max(
          0,
          replybuttonBox.y - viewport.height / 2,
        );

        if (scrollAmount <= 0) break;

        await this.humanLikeScroll(currentPage, scrollAmount, 5, 10);
        await new Promise(resolve => setTimeout(resolve, 2000));

        replybuttonBox = await replyButton.boundingBox();
      }

      const isReplyButtonVisible =
        replybuttonBox && (await isButtonVisible(replybuttonBox));

      if (isReplyButtonVisible) {
        // Click on the button with random offsets
        console.log('Clicking on reply button');
        await currentPage.mouse.click(
          replybuttonBox.x + replybuttonBox.width / 2,
          replybuttonBox.y + replybuttonBox.height / 2,
        );
      } else {
        console.log('Button is not visible.');
        return false;
      }
    } else {
      console.log('No reply button found.');
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // reply gif
    const replyGifSelector = 'button[data-testid="gifSearchButton"]';
    const replyGifButton = await currentPage.$(replyGifSelector);

    if (replyGifButton) {
      await replyGifButton.click();
      console.log('Reply gif button clicked successfully.');
      await new Promise(resolve => setTimeout(resolve, 2000));

      let gifKeywordList = ['lol', 'great', 'funny', 'haha', 'wow', 'amazing'];
      let randomIndex = Math.floor(Math.random() * gifKeywordList.length);
      let gifKeyword = gifKeywordList[randomIndex];

      await this.humanType(currentPage, null, gifKeyword);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const gifSelector = 'div[data-testid="gifSearchGifImage"]';
      const gif = await currentPage.$(gifSelector);

      await gif.click();
    } else {
      console.log('Reply gif button not found.');
    }

    // write a comment and post
    console.log('Start genText *******************');
    let commentResponse = await this.genText(tweets_content);
    let genText = commentResponse.reply;
    console.log('genText:', genText);
    // let genText = 'Hi there!';
    if (!genText) {
      return;
    }
    console.log('End genText *******************');
    await this.context.addToDB('Daily-GenText', genText);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // IF BUTTON CLICKED: THEN DEFAULT CONSIDERED IT AS SUCCESS
    const currentTimeStamp = await this.getCurrentTimestamp();

    await new Promise(resolve => setTimeout(resolve, 3000));

    await this.humanType(currentPage, null, genText);
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Wait for the reply button to appear and be ready for interaction
    const tweetButtonSelector = 'button[data-testid="tweetButton"]';
    const tweetButton = await currentPage.$(tweetButtonSelector);

    if (tweetButton) {
      // click the tweet button
      await tweetButton.click();
      await tweetButton.click(); // make sue to click the button twice
      console.log('Reply button clicked successfully!');
      this.commentsDB.createTimestamp('LAST_COMMENT_MADE', currentTimeStamp);
      await new Promise(resolve => setTimeout(resolve, 4000));

      const checkComments = await currentPage.evaluate(() => {
        const elements = document.querySelectorAll('article[aria-labelledby]');
        return Array.from(elements).map(element => element.outerHTML);
      });

      for (const comment of checkComments) {
        const $ = cheerio.load(comment);

        const tweetUrl = $('a[href*="/status/"]').attr('href');
        console.log(tweetUrl);
        const tweetId = tweetUrl.split('/').pop();
        // Find the href for the username inside each individual comment
        const linkElement = $('a[tabindex="-1"]');
        const href = linkElement.attr('href'); // Get the href attribute value

        if (href) {
          const user_name = href.replace('/', '').trim(); // Remove leading slash
          // console.log('user_name:', user_name);

          if (user_name === this.username) {
            let commentDetails = {
              username: this.username,
              commentId: tweetId,
              commentText: genText,
              comment_endpoint: commentResponse.endpoint || null,
              marketingBriefIndex: commentResponse.marketingBriefIndex,
            };
            console.log('Found comment');
            // Store the current timestamp as the new 'LAST_COMMENT_MADE'

            return commentDetails;
          }
        }
      }
      return null;
    } else {
      console.log('Reply button not found.');
      return null;
    }
  };

  clickBackButton = async currentPage => {
    try {
      await this.humanLikeScroll(this.page, -500, 10, 10); // Slide up to make sure back button is visible
      await new Promise(resolve => setTimeout(resolve, 2000));
      const backButtonSelector = 'button[data-testid="app-bar-back"]';

      // Wait for the back button to appear and be visible
      await currentPage.waitForSelector(backButtonSelector, { visible: true });

      // Find the back button
      const backButton = await currentPage.$(backButtonSelector);

      if (backButton) {
        const buttonBox = await backButton.boundingBox();

        if (buttonBox) {
          // Function to add a random offset to simulate human-like clicking
          const getRandomOffset = range => {
            return Math.floor(Math.random() * (range * 2 + 1)) - range;
          };

          // Simulate a click on the back button with random offsets
          await currentPage.mouse.click(
            buttonBox.x + buttonBox.width / 2 + getRandomOffset(5),
            buttonBox.y + buttonBox.height / 2 + getRandomOffset(5),
          );

          console.log('Back button clicked successfully!');
        } else {
          console.log('Back button is not visible.');
          await currentPage.keyboard.press('Alt+Left'); // Common shortcut for browser back
        }
      } else {
        console.log('Back button not found.');
        await currentPage.keyboard.press('Alt+Left'); // Common shortcut for browser back
      }
    } catch (e) {
      console.error('Error clicking the back button:', e);
      await currentPage.keyboard.press('Alt+Left'); // Common shortcut for browser back
    }
  };

  clickVerifiedUser = async currentPage => {
    // Define the selector for the follow button based on the given data-testid
    const verifiedIconSelector = 'svg[data-testid="icon-verified"]';

    // Wait for the follow button to be visible
    await currentPage.waitForSelector(verifiedIconSelector, { visible: true });

    // Locate the follow button within the page
    let verifiedIcon = await currentPage.$(verifiedIconSelector);

    if (verifiedIcon) {
      let buttonBox = await verifiedIcon.boundingBox();

      // Function to check if the button is in the viewport
      const isButtonVisible = async box => {
        const viewport = await currentPage.viewport();
        // console.log(box);
        return box && box.y >= 0 && box.y + box.height <= viewport.height - 300;
      };

      // Scroll until the button is fully visible
      while (!(await isButtonVisible(buttonBox))) {
        const viewport = await currentPage.viewport();
        const scrollAmount = Math.max(0, buttonBox.y - viewport.height / 2);

        if (scrollAmount <= 0) break;

        await this.humanLikeScroll(currentPage, scrollAmount, 5, 10);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check if the button has become visible
        buttonBox = await verifiedIcon.boundingBox();
      }

      // Check if bounding box is available and click the center of the button with random offsets
      if (buttonBox) {
        await currentPage.mouse.click(
          buttonBox.x + buttonBox.width / 2 + this.getRandomOffset(5),
          buttonBox.y + buttonBox.height / 2 + this.getRandomOffset(5),
        );

        console.log('Verified Icon clicked successfully.');
        return;
      } else {
        console.log('Verified Icon bounding box not available.');
      }
    } else {
      console.log('Verified Icon not found.');
    }
  };

  clickFollowButton = async currentPage => {
    // Define the selector for the follow button based on the given data-testid
    const followButtonSelector = 'button[data-testid*="-follow"]';

    // Wait for the follow button to be visible
    await currentPage.waitForSelector(followButtonSelector, { visible: true });

    // Locate the follow button within the page
    let followButton = await currentPage.$(followButtonSelector);

    if (followButton) {
      let buttonBox = await followButton.boundingBox();

      // Function to check if the button is in the viewport
      const isButtonVisible = async box => {
        const viewport = await currentPage.viewport();
        // console.log(box);
        return box && box.y >= 0 && box.y + box.height <= viewport.height - 300;
      };

      // Scroll until the button is fully visible
      while (!(await isButtonVisible(buttonBox))) {
        const viewport = await currentPage.viewport();
        const scrollAmount = Math.max(0, buttonBox.y - viewport.height / 2);

        if (scrollAmount <= 0) break;

        await this.humanLikeScroll(currentPage, scrollAmount, 5, 10);
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check if the button has become visible
        buttonBox = await followButton.boundingBox();
      }

      // Check if bounding box is available and click the center of the button with random offsets
      if (buttonBox) {
        await currentPage.mouse.click(
          buttonBox.x + buttonBox.width / 2 + this.getRandomOffset(5),
          buttonBox.y + buttonBox.height / 2 + this.getRandomOffset(5),
        );

        console.log('Follow button clicked successfully.');
        return;
      } else {
        console.log('Follow button bounding box not available.');
      }
    } else {
      console.log('Follow button not found.');
    }
  };

  clickExploreButton = async currentPage => {
    // Wait for the explore link to be available
    const exploreLinkSelector = 'a[data-testid="AppTabBar_Explore_Link"]';
    await currentPage.waitForSelector(exploreLinkSelector, { visible: true });

    await new Promise(resolve => setTimeout(resolve, 3000));
    const exploreLink = await currentPage.$(exploreLinkSelector);

    if (exploreLink) {
      const linkBox = await exploreLink.boundingBox();

      if (linkBox) {
        // Simulate a click on the link using mouse.click with random offsets
        await currentPage.mouse.click(
          linkBox.x + linkBox.width / 2 + this.getRandomOffset(5),
          linkBox.y + linkBox.height / 2 + this.getRandomOffset(5),
        );
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (currentPage.url().includes('explore')) {
          console.log('Explore link clicked successfully!');
        } else {
          // retry click
          await currentPage.mouse.click(
            linkBox.x + linkBox.width / 2 + this.getRandomOffset(5),
            linkBox.y + linkBox.height / 2 + this.getRandomOffset(5),
          );
          await new Promise(resolve => setTimeout(resolve, 3000));
          if (currentPage.url().includes('explore')) {
            console.log('Explore link clicked successfully!');
          }
        }
      } else {
        console.log('Link bounding box not available.');
      }
    } else {
      console.log('Explore link not found.');
    }
  };

  clickInputBox = async (currentpage, inputSelector) => {
    // Wait for the input element to be visible
    await currentpage.waitForSelector(inputSelector, { visible: true });

    let searchInputField = await currentpage.$(inputSelector);

    if (searchInputField) {
      const inputBox = await searchInputField.boundingBox();

      if (inputBox) {
        // Simulate a click on the input field with random offsets
        await currentpage.mouse.click(
          inputBox.x + inputBox.width / 2 + this.getRandomOffset(5),
          inputBox.y + inputBox.height / 2 + this.getRandomOffset(5),
        );

        console.log(
          'Search input field clicked successfully, ready for typing.',
        );
      } else {
        console.log('Search input field bounding box not available.');
      }
    } else {
      console.log('Search input field not found.');
    }
  };

  clickLatest = async currentPage => {
    const latestSelector =
      'div[role="presentation"] > a[role="tab"][href*="&f=live"]';

    try {
      await currentPage.waitForSelector(latestSelector, { visible: true });

      const LatestField = await currentPage.$(latestSelector);

      if (LatestField) {
        const LatestBox = await LatestField.boundingBox();
        if (LatestBox) {
          await currentPage.mouse.click(
            LatestBox.x + LatestBox.width / 2 + this.getRandomOffset(5),
            LatestBox.y + LatestBox.height / 2 + this.getRandomOffset(5),
          );
        }
        console.log("Clicked on the 'Latest' tab");
      }
    } catch (error) {
      console.error("Could not find or click on the 'Latest' tab:", error);
    }
  };

  clickPeople = async currentPage => {
    const latestSelector =
      'div[role="presentation"] > a[role="tab"][href*="&f=user"]';

    try {
      await currentPage.waitForSelector(latestSelector, { visible: true });

      const LatestField = await currentPage.$(latestSelector);

      if (LatestField) {
        const LatestBox = await LatestField.boundingBox();
        if (LatestBox) {
          await currentPage.mouse.click(
            LatestBox.x + LatestBox.width / 2 + this.getRandomOffset(5),
            LatestBox.y + LatestBox.height / 2 + this.getRandomOffset(5),
          );
        }
        console.log("Clicked on the 'Latest' tab");
      }
    } catch (error) {
      console.error("Could not find or click on the 'Latest' tab:", error);
    }
  };

  /**
   * parseItem
   * @param {string} url - the url of the item to parse
   * @param {object} query - the query object to use for parsing
   * @returns {object} - the parsed item
   * @description - this function should parse the item at the given url and return the parsed item data
   *               according to the query object and for use in either search() or validate()
   */
  parseItem = async (item, url, currentPage, currentBrowser) => {
    // check if the browser has valid cookie or login session or not
    if (this.sessionValid == false) {
      await this.negotiateSession();
    }
    try {
      const $ = cheerio.load(item);
      let data = {};

      // get the article details
      const articles = $('article[data-testid="tweet"]').toArray();
      const el = articles[0];
      const tweetUrl = $('a[href*="/status/"]').attr('href');
      const tweetId = tweetUrl.split('/').pop();
      // get the other info about the article
      const screen_name = $(el).find('a[tabindex="-1"]').text();
      const allText = $(el).find('a[role="link"]').text();
      const user_name = allText.split('@')[0];
      const user_url =
        'https://x.com' + $(el).find('a[role="link"]').attr('href');
      const user_img = $(el).find('img[draggable="true"]').attr('src');
      let tweet_text = '';
      $(el)
        .find('div[data-testid="tweetText"]')
        .contents()
        .each((index, element) => {
          if (element.tagName === 'span') {
            tweet_text += $(element).text(); // Append text
          } else if (element.tagName === 'img' && $(element).attr('alt')) {
            tweet_text += $(element).attr('alt'); // Append emoji from alt attribute
          }
        });
      const timeRaw = $(el).find('time').attr('datetime');
      const time = await this.convertToTimestamp(timeRaw);
      // this is for the hash and salt
      const tweets_content = tweet_text.replace(/\n/g, '<br>');
      const round = await namespaceWrapper.getRound();
      const originData = tweets_content + round;
      const saltRounds = 10;
      const salt = bcrypt.genSaltSync(saltRounds);
      const hash = bcrypt.hashSync(originData, salt);
      await this.context.addToDB('Tweet-content', tweets_content);
      // console.log('checking tweet: ', tweets_content);
      // click on article
      await this.clickArticle(currentPage, tweets_content, tweetId);

      await new Promise(resolve => setTimeout(resolve, 3000));

      // // Click like button (now unused)
      // const commentContainer = await this.getCommentContainer(
      //   currentPage,
      //   tweet_text,
      // );
      // if (commentContainer) {
      //   let currentUrl = currentPage.url();
      //   await this.clickLikeButton(currentPage, commentContainer);

      //   // check if url changed
      //   if (currentUrl !== currentPage.url()) {
      //     console.log(
      //       'Url changed after like action. Changed to:',
      //       currentPage.url(),
      //     );
      //     return false;
      //   } else {
      //     console.log('Like action performed successfully.');
      //   }
      // } else {
      //   console.log('Comment container not found for the tweet.');
      // }

      //       await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if already posted the comment
      let isAlreadComment = false;
      // Fetch the current comments
      const existComments = await currentPage.evaluate(() => {
        const elements = document.querySelectorAll('article[aria-labelledby]');
        return Array.from(elements).map(element => element.outerHTML);
      });

      let commentDetails = {};
      for (const comment of existComments) {
        const $ = cheerio.load(comment);

        // Find the href for the username inside each individual comment
        const linkElement = $('a[tabindex="-1"]');
        const href = linkElement.attr('href'); // Get the href attribute value

        if (href) {
          const user_name = href.replace('/', '').trim(); // Remove leading slash

          // console.log('user_name:', user_name);

          if (user_name === this.username) {
            console.log('Already posted the comment');
            isAlreadComment = true;
            break;
          }
        }
      }

      // check comment cooldown
      const currentTimeStamp = await this.getCurrentTimestamp(); // Fetch the current timestamp
      let isTimestampValid = await this.checkCommentTimestamp(currentTimeStamp);
      console.log('isTimestampValid', isTimestampValid);
      if (isTimestampValid && !isAlreadComment) {
        // Click the comment button if the timestamp check is valid
        commentDetails = await this.clickCommentButton(
          currentPage,
          tweets_content,
        );
        console.log('commentDetails', commentDetails);
        console.log('Comment action performed, and timestamp updated.');
      } else {
        console.log('No comment action was taken due to recent activity.');
      }

      try {
        // let processedComments = new Set(); // Track processed comments

        for (let i = 0; i < 3; i++) {
          await this.humanLikeScroll(this.page, 500, 10, 10); // Slide down to load more comments
          await new Promise(resolve => setTimeout(resolve, 2000));
          // // Fetch the current comments
          // const comments = await currentPage.evaluate(() => {
          //   const elements = document.querySelectorAll(
          //     'article[aria-labelledby]',
          //   );
          //   return Array.from(elements).map(element => element.outerHTML);
          // });

          // // console.log('Found comments: ', comments.length);

          // for (const comment of comments) {
          //   const $ = cheerio.load(comment);
          //   const commentText = $('div[data-testid="tweetText"]').text().trim(); // Get comment text

          //   await this.context.addToDB('Tweet-content', commentText);
          //   // Check if the comment is already processed
          //   if (processedComments.has(commentText)) {
          //     // console.log('Skipping duplicate comment.');
          //     continue; // Skip if the comment has already been processed
          //   }

          //   // Add this comment to the processed set
          //   processedComments.add(commentText);

          //   let shouldLike = Math.random() < 0.3;

          //   if (shouldLike) {
          //     // Find the correct like button for this comment
          //     const commentContainer = await this.getCommentContainer(
          //       currentPage,
          //       commentText,
          //     );
          //     if (commentContainer) {
          //       // console.log('Found comment container for the matching comment.');
          //       let currentUrl = currentPage.url();
          //       await this.clickLikeButton(currentPage, commentContainer); // Pass the comment container to the click function
          //       // check if url changed
          //       if (currentUrl !== currentPage.url()) {
          //         console.log(
          //           'Url changed after like action. Changed to:',
          //           currentPage.url(),
          //         );
          //         return false;
          //       } else {
          //         console.log('Like action performed successfully.');
          //       }
          //     } else {
          //       console.log(
          //         'Could not find comment container for the matching comment.',
          //       );
          //     }
          //   } else {
          //     // Skipping like for this comment
          //     // console.log('Skipping like for this comment.');
          //   }
          // }
        }
      } catch (e) {
        console.log('Something went wrong when performing Like action', e);
      }

      if (screen_name && tweet_text && commentDetails.commentId) {
        data = {
          user_name: user_name,
          screen_name: screen_name,
          user_url: user_url,
          user_img: user_img,
          tweets_id: tweetId,
          tweets_content: tweets_content,
          time_post: time,
          keyword: this.searchTerm,
          hash: hash,
          commentDetails: commentDetails,
        };
      }

      // click back button after all comments and like
      await this.clickBackButton(currentPage);

      return data;
    } catch (e) {
      console.log(
        'Something went wrong when comment or like post, back to other post',
        e,
      );
      // click back button after all comments and like
      await this.clickBackButton(currentPage);
    }
  };

  getRandomOffset = range => {
    return Math.floor(Math.random() * (range * 2 + 1)) - range;
  };
  /*
    @genText
    Receives a blurb to read, then returns a random blurb
    * textToRead receives a blurb of text 
    @return => templated blurb
*/

  async genText(textToRead) {
    await this.context.initializeContext();
    // await this.context.checkUpdates();
    const character = await this.context.getOrCreateCharacter();
    // const tweetsInfo = await this.context.getOrCreateTweetsInfo();
    const marketingBriefResponse = await this.context.getMarketingBrief();
    const userIndex = await this.context.getUserIndex();
    const marketingBrief = marketingBriefResponse.randomBrief;
    for (let i = 0; i < 10; i++) {
      const commentResponse = await askForComment(
        textToRead,
        character,
        marketingBrief,
      );
      if (commentResponse.reply.length > 220) {
        console.log(commentResponse.reply);
        console.log('Comment too long, try again');
        continue;
      }
      console.log('Done');
      commentResponse.marketingBriefIndex = userIndex;
      return commentResponse;
    }
  }

  /**
   * Attempts to return a sensible snippet from the provided text
   * @param {*} text
   */
  selectSnippet(snippetSelector, textToRead) {
    let doc = nlp(textToRead);

    let snippet = doc.match(snippetSelector).text();
    snippet = nlp(snippet);
    snippet.nouns().toPlural();
    snippet.people().normalize();
    snippet.toLowerCase();
    snippet.verbs().toGerund();
    snippet = snippet.text();
    if (snippet.length < 1) snippet = 0;
    // console.log( 'selector', snippetSelector, 'found snippet: ', snippet);

    return snippet;
  }

  convertToTimestamp = async dateString => {
    const date = new Date(dateString);
    return Math.floor(date.getTime() / 1000);
  };

  /**
   * search
   * @param {string} query
   * @returns {Promise<string[]>}
   * @description searchs the queue of known links
   */
  search = async query => {
    console.log('valid? ', this.sessionValid);
    if (this.sessionValid == true) {
      this.searchTerm = query.searchTerm;
      this.round = query.round;
      this.comment = query.comment;

      // check if the input is email or not
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const checkEmail = emailRegex.test(query.username);
      if (checkEmail) {
        // get the username from the home
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.page.goto('https://x.com/home');
        await new Promise(resolve => setTimeout(resolve, 2000));
        const loggedInUsername = await this.page.evaluate(() => {
          const elements = document.querySelectorAll(
            '[data-testid^="UserAvatar-Container-"]',
          );
          const extractUsername = element => {
            const dataTestId = element.getAttribute('data-testid');
            if (dataTestId) {
              const username = dataTestId.split('-').pop();
              return username && username.trim() ? username : null;
            }
            return null;
          };
          let username =
            elements.length > 0 ? extractUsername(elements[0]) : null;
          if (!username && elements.length > 1) {
            username = extractUsername(elements[1]);
          }
          return username ? username : 'No username found';
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (loggedInUsername && loggedInUsername !== 'No username found') {
          this.username = loggedInUsername;
          await this.fetchList(query.query, query.round, query.searchTerm);
        }
        console.log('Failed to retrieve a valid username.');
      } else {
        this.username = query.username;
        await this.fetchList(query.query, query.round, query.searchTerm);
      }
    } else {
      await this.negotiateSession();
    }
  };

  // get the current timestamp
  getCurrentTimestamp = async () => {
    const currentDate = new Date();
    const millisecondsTimestamp = currentDate.getTime();
    const currentTimeStamp = Math.floor(millisecondsTimestamp / 1000);
    return currentTimeStamp;
  };

  checkCommentTimestamp = async currentTimeStamp => {
    try {
      // Retrieve the last comment timestamp from the database (in seconds)
      const lastCommentTimestamp = await this.commentsDB.getTimestamp(
        'LAST_COMMENT_MADE',
      );
      if (!lastCommentTimestamp) {
        console.log('No previous comment timestamp found in the database.');
        return true; // No timestamp, allow the new comment
      }

      // Convert both timestamps from seconds to milliseconds for comparison
      const lastTimestamp = lastCommentTimestamp * 1000;
      const currentTimestamp = currentTimeStamp * 1000;

      console.log(`Last comment timestamp: ${lastTimestamp}`);
      console.log(`Current timestamp: ${currentTimestamp}`);

      // Check if the timestamps are valid numbers
      if (isNaN(lastTimestamp) || isNaN(currentTimestamp)) {
        console.log('Invalid timestamp detected.');
        return false; // Avoid proceeding if timestamps are invalid
      }

      // Define the random cooldown range: 30 minutes ± 5 minutes (25 to 35 minutes) in milliseconds
      const MIN_COOLDOWN_IN_MS = 25 * 60 * 1000; // 25 minutes in milliseconds
      const MAX_COOLDOWN_IN_MS = 35 * 60 * 1000; // 30 minutes in milliseconds

      // Generate a random cooldown between 25 and 35 minutes
      const randomCooldown =
        Math.floor(
          Math.random() * (MAX_COOLDOWN_IN_MS - MIN_COOLDOWN_IN_MS + 1),
        ) + MIN_COOLDOWN_IN_MS;

      // Calculate the difference between the current time and the last comment time
      const timeDifference = currentTimestamp - lastTimestamp;

      // If the time difference is less than or equal to the random cooldown, skip the comment
      if (timeDifference <= randomCooldown) {
        console.log(
          `Last comment was made within the cooldown period of ${
            randomCooldown / (60 * 1000)
          } minutes, skipping comment action.`,
        );
        return false;
      }
      // If the last comment is older than the allowed range, allow the new comment
      return true;
    } catch (error) {
      console.log(`Error in checkCommentTimestamp: `, error);
      return false; // Fail-safe: don't proceed with the comment action
    }
  };

  /**
   * fetchList
   * @param {string} url
   * @returns {Promise<string[]>}
   * @description Fetches a list of links from a given url
   */
  fetchList = async (url, round, searchTerm) => {
    try {
      if (
        this.username === '' ||
        this.username === null ||
        this.username === undefined
      ) {
        console.log(
          'fetching list stopped: Please replace TWITTER_USERNAME with your Twitter username, not your Email Address.',
        );
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
      console.log('Go to search page');

      await this.clickExploreButton(this.page);

      // Type the search term into the input field
      const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';
      await this.clickInputBox(this.page, searchInputSelector);

      await new Promise(resolve => setTimeout(resolve, 2000));

      await this.humanType(this.page, searchInputSelector, searchTerm);

      // hit enter
      await this.page.keyboard.press('Enter');

      await new Promise(resolve => setTimeout(resolve, 2000));

      // await this.clickLatest(this.page);
      await this.clickPeople(this.page);

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('fetching list for ', this.page.url());

      // error message
      const errorMessage = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('div[dir="ltr"]');
        for (let element of elements) {
          // console.log(element.textContent);
          if (element.textContent === 'Something went wrong. Try reloading.') {
            return true;
          }
        }
        return false;
      });

      if (errorMessage) {
        console.log('Something went wrong, please check your account');
        this.browser.close();
      }

      console.log('Waiting for tweets loaded');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // get the users
      await this.page.evaluate(() => {
        const elements = document.querySelectorAll(
          'button[data-testid="UserCell"]',
        );
        elements.forEach(element => element.click());
      });

      await new Promise(resolve => setTimeout(resolve, 4500));

      // get the articles
      const items = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('article[aria-labelledby]');
        return Array.from(elements).map(element => element.outerHTML);
      });
      console.log('Found items: ', items.length);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // loop the articles
      for (const item of items) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // @soma Nice delay timer, never thought of doing it this way
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          // add the comment on the post
          let data = await this.parseItem(item, url, this.page, this.browser);
          console.log('data', data);
          if (data === false) {
            // Try again
            console.log('Try again');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.fetchList(url, round, searchTerm);
            break;
          }

          // check if comment found or not
          // console.log(data.tweets_id);
          if (data.tweets_id !== undefined) {
            this.cids.create({
              id: data.tweets_id,
              round: round,
              data: data,
            });
            console.log('Success storing data');
          } else {
            console.log('Only scraping, no need to store data.');
          }
        } catch (e) {
          console.log(
            'Something went wrong while fetching the list of items, continue to next post ',
            e,
          );
        }
      }

      // DO NOT FOLLOW USER FOR SAFETY REASON
      // await this.clickExploreButton(this.page);

      // await new Promise(resolve => setTimeout(resolve, 2000));

      // // Call the function to perform the slow slide
      // await this.humanLikeScroll(this.page, 300, 5, 10);

      // // Follow user
      // await new Promise(resolve => setTimeout(resolve, 2000));

      // await this.clickVerifiedUser(this.page);

      // await new Promise(resolve => setTimeout(resolve, 4000));

      // await this.clickFollowButton(this.page);

      // await new Promise(resolve => setTimeout(resolve, 2000));

      // await this.humanLikeScroll(this.page, 300, 5, 10);

      console.log('Time to take a break');

      // Optional: wait for a moment to allow new elements to load
      await new Promise(resolve => setTimeout(resolve, 180000));
      this.browser.close();
      return;
    } catch (e) {
      console.log('Last round fetching list stop', e);
      return;
    }
  };

  humanLikeScroll = async (page, scrollDistance, steps, delay) => {
    // Calculate the scroll increment per step
    const scrollStep = scrollDistance / steps;

    for (let i = 0; i < steps; i++) {
      // Scroll step by step
      await page.mouse.wheel({ deltaY: scrollStep });

      // Wait for a short period to simulate natural scrolling
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // console.log('Human-like scrolling performed successfully!');
  };

  compareHash = async (data, saltRounds) => {
    const round = await namespaceWrapper.getRound();
    const dataToCompare = data.data.tweets_content + round; // + data.data.tweets_id;
    console.log(dataToCompare);
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(dataToCompare, salt);
    console.log(hash);
    const hashCompare = bcrypt.compareSync(dataToCompare, hash);
    console.log(hashCompare);
    const hashCompareWrong = bcrypt.compareSync(data.data.tweets_id, hash);
    console.log(hashCompareWrong);
  };

  /**
   * retrieveItem derived from fetchList
   * @param {*} url
   * @param {*} item
   * @returns
   */
  retrieveItem = async (verify_page, comment, selectedPage) => {
    try {
      const items = await verify_page.evaluate(() => {
        const elements = document.querySelectorAll('article[aria-labelledby]');
        return Array.from(elements).map(element => element.outerHTML);
      });

      if (items.length === 0) {
        return { result: {}, bool: true };
      }

      const $ = cheerio.load(items[0]);
      const articles = $('article[data-testid="tweet"]').toArray();
      const el = articles[0];
      const tweetUrl = $('a[href*="/status/"]').attr('href');
      const tweetId = tweetUrl.split('/').pop();
      // get the other info about the article
      const screen_name = $(el).find('a[tabindex="-1"]').text();
      const allText = $(el).find('a[role="link"]').text();
      const user_name = allText.split('@')[0];
      const user_url =
        'https://x.com' + $(el).find('a[role="link"]').attr('href');
      const user_img = $(el).find('img[draggable="true"]').attr('src');
      let tweet_text = '';
      $(el)
        .find('div[data-testid="tweetText"]')
        .contents()
        .each((index, element) => {
          if (element.tagName === 'span') {
            tweet_text += $(element).text(); // Append text
          } else if (element.tagName === 'img' && $(element).attr('alt')) {
            tweet_text += $(element).attr('alt'); // Append emoji from alt attribute
          }
        });
      const timeRaw = $(el).find('time').attr('datetime');
      const time = await this.convertToTimestamp(timeRaw);

      // Get views
      const viewsElement = $(el)
        .find('span[data-testid="app-text-transition-container"]')
        .text();
      const views = viewsElement || '0'; // Default to '0' if views are not found
      console.log(views);
      // this is for the hash and salt
      const tweets_content = tweet_text.replace(/\n/g, '<br>');

      var foundItem = {};
      if (selectedPage === 'commentPage') {
        // get the comment details
        let trimCommentText = await this.cleanText(comment);
        const commentDetails = await verify_page.evaluate(
          async cleanTextStr => {
            const cleanText = new Function('return ' + cleanTextStr)();

            const tweetElements = Array.from(
              document.querySelectorAll('article[data-testid="tweet"]'),
            );
            const details = [];
            await Promise.all(
              tweetElements.map(async tweetElement => {
                let commentId = null;
                let username = null;
                let postTime = null;

                const textElement = tweetElement.querySelector('div[lang]');
                let textContent = '';
                if (textElement && textElement.childNodes) {
                  textElement.childNodes.forEach(node => {
                    let content = '';

                    if (node.nodeName === 'IMG') {
                      content = node.alt || '';
                    } else {
                      content = node.innerText || node.textContent;
                    }

                    // Check if content is not null, undefined, or empty
                    if (content) {
                      textContent += content;
                    }
                  });
                }

                const timeElements = Array.from(
                  tweetElement.querySelectorAll('time[datetime]'),
                );
                if (timeElements.length > 0) {
                  timeElements.forEach(async timeElement => {
                    const anchorElement = timeElement.closest('a');
                    if (anchorElement) {
                      const urlMatch = anchorElement.href.match(
                        /^https?:\/\/[^\/]+\/([^\/]+)\/status\/(\d+)$/,
                      );
                      username = urlMatch ? urlMatch[1] : null;
                      commentId = urlMatch ? urlMatch[2] : null;
                      postTime = timeElement.getAttribute('datetime');
                    }
                  });
                }

                await new Promise(resolve => setTimeout(resolve, 10000));

                if (textContent) {
                  try {
                    const getComments = await cleanText(textContent);
                    details.push({
                      commentId,
                      getComments,
                      username,
                      postTime,
                      // views,
                    });
                  } catch (error) {
                    console.error('Error processing comment:', error);
                  }
                }
              }),
            );
            return details;
          },
          this.cleanText.toString(),
          trimCommentText,
        );

        // update the post time
        for (let item of commentDetails) {
          item.postTime = await this.convertToTimestamp(item.postTime);
        }

        // Check if the comment already exists
        foundItem = commentDetails.find(item =>
          item.getComments
            .toLowerCase()
            .includes(trimCommentText.toLowerCase()),
        );

        if (foundItem) {
          const found = !!foundItem;
          if (found) {
            console.log('AUDITS :::: Comment found. ');
            foundItem.getComments = comment;
          }
        } else {
          return { result: {}, bool: true };
        }
      }

      // get the object
      const data = {
        user_name: user_name,
        screen_name: screen_name,
        user_url: user_url,
        user_img: user_img,
        tweets_id: tweetId,
        tweets_content: tweets_content,
        time_post: time,
        views: views,
        commentDetails: foundItem,
      };

      return { result: data, bool: true };
    } catch (e) {
      console.log('Last round fetching list stop', e);
      return { result: {}, bool: false };
    }
  };

  verify = async (inputItem, round) => {
    console.log('----Input Item Below -----');
    console.log(inputItem);
    console.log('----Input Item Above -----');
    try {
      const options = {};
      const stats = await PCR(options);
      console.log(
        '*****************************************CALLED Audit VERIFIER*****************************************',
      );
      let auditBrowser = await puppeteer.launch({
        executablePath: stats.executablePath,
        // headless: false,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        args: [
          '--aggressive-cache-discard',
          '--disable-cache',
          '--disable-application-cache',
          '--disable-offline-load-stale-cache',
          '--disable-gpu-shader-disk-cache',
          '--no-sandbox',
          '--disable-gpu',
        ],
      });
      console.log('Step: Open new page');
      const verify_page = await auditBrowser.newPage();
      await verify_page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );
      await new Promise(resolve => setTimeout(resolve, 3000));
      await verify_page.setViewport({ width: 1024, height: 4000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      // go to the comment page
      const url = `https://x.com/${inputItem.commentDetails.username}/status/${inputItem.commentDetails.commentId}`;
      await verify_page.goto(url, { timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 4000));

      // check if the page gave 404
      let confirmed_no_tweet = false;
      await verify_page.evaluate(() => {
        if (document.querySelector('[data-testid="error-detail"]')) {
          console.log('Error detail found');
          confirmed_no_tweet = true;
        }
      });
      if (confirmed_no_tweet) {
        return false;
      }
      console.log('Retrieve item for', url);
      const commentRes = await this.retrieveItem(
        verify_page,
        inputItem.commentDetails.commentText,
        'commentPage',
      );

      console.log('commentRes', commentRes);
      // check if the comment is found or not
      if (commentRes.bool) {
        // check if time_post within 1hr
        const currentTime = await this.getCurrentTimestamp();
        const timeDiff = currentTime - commentRes.result.time_post;
        if (timeDiff > 43200) {
          console.log('Time difference is more than 12hr');
          auditBrowser.close();
          return false;
        } else {
          auditBrowser.close();
          return true;
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
        auditBrowser.close();
        return true;
      }
    } catch (e) {
      console.log('Error fetching single item', e);
      return true;
    }
  };

  getViews = async inputItem => {
    try {
      console.log('Checking views for ', inputItem.commentDetails.commentId);
      const options = {};
      const stats = await PCR(options);
      let checkViewsBrowser = await puppeteer.launch({
        // headless: true,
        executablePath: stats.executablePath,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        args: [
          '--aggressive-cache-discard',
          '--disable-cache',
          '--disable-application-cache',
          '--disable-offline-load-stale-cache',
          '--disable-gpu-shader-disk-cache',
          '--no-sandbox',
          '--disable-gpu',
        ],
      });
      const checkViewsPage = await checkViewsBrowser.newPage();
      await new Promise(resolve => setTimeout(resolve, 3000));
      // go to the comment page
      const url = `https://x.com/${inputItem.commentDetails.username}/status/${inputItem.commentDetails.commentId}`;

      await checkViewsPage.goto(url, { timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // check if the page gave 404
      let confirmed_no_tweet = false;
      await checkViewsPage.evaluate(() => {
        if (document.querySelector('[data-testid="error-detail"]')) {
          console.log('Error detail found');
          confirmed_no_tweet = true;
        }
      });
      if (confirmed_no_tweet) {
        return false;
      }
      console.log('Retrieve item for', url);
      const commentRes = await this.retrieveItem(
        checkViewsPage,
        inputItem.commentDetails.commentText,
        'commentPage',
      );
      let views;
      if (commentRes) {
        views = commentRes.result.views;
      } else {
        views = 1;
      }
      return views;
    } catch (e) {
      console.log('Error fetching single item', e);
      return 1;
    }
  };

  scrollPage = async page => {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Adjust the timeout as necessary
  };

  /**
   * processLinks
   * @param {string[]} links
   * @returns {Promise<void>}
   * @description Processes a list of links
   * @todo Implement this function
   * @todo Implement a way to queue links
   */
  processLinks = async links => {
    links.forEach(link => {});
  };

  randomDelay = async delayTime => {
    const delay =
      Math.floor(Math.random() * (delayTime - 1000 + 1)) + (delayTime - 1000);
    return delay;
  };

  /**
   * stop
   * @returns {Promise<boolean>}
   * @description Stops the searcher
   */
  stop = async () => {
    if (this.browser) {
      await this.browser.close();
      console.log('Old browser closed');
    }
    return (this.break = true);
  };
}

module.exports = Twitter;
