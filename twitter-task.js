const Twitter = require('./adapters/twitter/twitter.js');
const Data = require('./model/data');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk');
const dotenv = require('dotenv');
const { CID } = require('multiformats/cid');
const path = require('path');
const fs = require('fs');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const { default: axios } = require('axios');
const { error } = require('console');
const context = require('./adapters/context/context');
async function isValidCID(cid) {
  try {
    CID.parse(cid);
    return true;
  } catch (error) {
    return false;
  }
}

dotenv.config();

/**
 * TwitterTask is a class that handles the Twitter crawler and validator
 *
 * @description TwitterTask is a class that handles the Twitter crawler and validator
 *              In this task, the crawler asynchronously populates a database, which is later
 *              read by the validator. The validator then uses the database to prepare a submission CID
 *              for the current round, and submits that for rewards.
 *
 *              Four main functions control this process:
 *              @crawl crawls Twitter and populates the database
 *              @validate verifies the submissions of other nodes
 *              @getRoundCID returns the submission for a given round
 *              @stop stops the crawler
 *
 * @param {function} getRound - a function that returns the current round
 * @param {number} round - the current round
 * @param {string} searchTerm - the search term to use for the crawler
 * @param {string} adapter - the adapter to use for the crawler
 * @param {string} db - the database to use for the crawler
 *
 * @returns {TwitterTask} - a TwitterTask object
 *
 */

class TwitterTask {
  constructor(round) {
    this.round = round;
    this.lastRoundCheck = Date.now();
    this.isRunning = false;
    this.searchTerm = [];
    this.adapter = null;
    this.comment = '';
    this.username = '';
    this.db = new Data('db', []);
    this.db.initializeData();
    this.context = context;
    this.initialize();

    this.setAdapter = async () => {
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      const verification = process.env.TWITTER_VERIFICATION;

      if (!username || !password) {
        throw new Error(
          'Environment variables TWITTER_USERNAME and/or TWITTER_PASSWORD are not set',
        );
      }

      let credentials = {
        username: username,
        password: password,
        verification: verification,
      };

      this.username = username;
      this.adapter = new Twitter(credentials, this.db, 3);
      await this.adapter.negotiateSession();
    };

    this.start();
  }

  async initialize() {
    try {
      console.log('initializing twitter task');
      await this.context.initializeContext();
      const { comment, search } = await this.fetchSearchTerms();
      this.comment = comment;
      this.searchTerm = search;

      //Store this round searchTerm
      // console.log(
      //   'creating crawler for user:',
      //   this.searchTerm,
      //   this.round,
      //   this.comment,
      // );
      this.db.createSearchTerm(this.searchTerm, this.round, this.comment);
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * fetchSearchTerms
   * @description return the search terms to use for the crawler
   * @returns {array} - an array of search terms
   */
  async fetchSearchTerms() {
    let keyword;
    let search;
    try {
      console.log('fetching keywords');
      // console.log('Keywords from middle server', response.data);
      let keywordList = await this.context.getEnemySubscribers();
      if (keywordList) {
        search = keywordList[Math.floor(Math.random() * keywordList.length)];
        return { comment: keyword, search: search };
      } else {
        let searchList = [
          '"mendozabills"',
          '"Samuelodumtwit"',
          '"AndreiDamian0"',
          '"gialong4446"',
          '"AlexVillargordo"',
          '"rafalgolarz"',
          '"thomas22xx"',
          '"Mr_Shaisob91275"',
          '"abdusemedk51"',
          '"usmannitel45"',
          '"m_shizan67041"',
          '"BiniyamShi92265"',
          '"westham2435"',
          '"M_Shakib553039"',
          '"mst_israt53729"',
          '"Mr_Humayun_"',
          '"golden_cry"',
          '"Silvanachu014"',
          '"SergeiKudinov1"',
          '"BogaleChekole"',
          '"hahai87431558"',
          '"Anggi_Frimadani"',
          '"Bintuu14"',
          '"kalagi_sur1062"',
          '"Modzodzo1"',
          '"pngjn4119879521"',
          '"_habib_ullah"',
          '"0xpreston_"',
          '"B_Bbristry"',
          '"JMarco28006338"',
        ]; // User name
        search = searchList[Math.floor(Math.random() * searchList.length)];
        return { comment: keyword, search: search };
      }
    } catch (error) {
      console.log('Error fetching keywords:', error, 'use random keyword');
      // pick random search term
      let searchList = [
        '"mendozabills"',
        '"Samuelodumtwit"',
        '"AndreiDamian0"',
        '"gialong4446"',
        '"AlexVillargordo"',
        '"rafalgolarz"',
        '"thomas22xx"',
        '"Mr_Shaisob91275"',
        '"abdusemedk51"',
        '"usmannitel45"',
        '"m_shizan67041"',
        '"BiniyamShi92265"',
        '"westham2435"',
        '"M_Shakib553039"',
        '"mst_israt53729"',
        '"Mr_Humayun_"',
        '"golden_cry"',
        '"Silvanachu014"',
        '"SergeiKudinov1"',
        '"BogaleChekole"',
        '"hahai87431558"',
        '"Anggi_Frimadani"',
        '"Bintuu14"',
        '"kalagi_sur1062"',
        '"Modzodzo1"',
        '"pngjn4119879521"',
        '"_habib_ullah"',
        '"0xpreston_"',
        '"B_Bbristry"',
        '"JMarco28006338"',
      ]; // User name
      search = searchList[Math.floor(Math.random() * searchList.length)];
    }

    return { comment: keyword, search: search };
  }

  /**
   * strat
   * @description starts the crawler
   *
   * @returns {void}
   *
   */
  async start() {
    await this.setAdapter();

    this.isRunning = true;

    // random emojis
    const emojis = ['🛋️', '🛋️', '🛋️'];
    for (let i = emojis.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
    }
    const numEmojis = Math.floor(Math.random() * 3) + 1;
    const getRandomEmojis = emojis.slice(0, numEmojis).join('');

    // random selected hashtags
    const hashtags = ['#releaseDrats', '#couchLover'];
    for (let i = hashtags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hashtags[i], hashtags[j]] = [hashtags[j], hashtags[i]];
    }
    const numHashtags = Math.floor(Math.random() * hashtags.length) + 1;
    const selectedHashtags = hashtags.slice(0, numHashtags).join(' ');

    let query = {
      limit: 100,
      searchTerm: this.searchTerm,
      query: `https://x.com/search?q=${this.searchTerm}&src=typed_query&f=live`,
      comment: `${this.comment} ${getRandomEmojis}  ${selectedHashtags}`,
      depth: 3,
      round: this.round,
      recursive: true,
      username: this.username,
    };

    this.adapter.search(query); // let it ride
  }

  /**
   * stop
   * @description stops the crawler
   *
   * @returns {void}
   */
  async stop() {
    this.isRunning = false;
    this.adapter.stop();
  }

  /**
   * getRoundCID
   * @param {*} roundID
   * @returns
   */
  async getRoundCID(roundID) {
    console.log('starting submission prep for ');
    let result = await this.adapter.getSubmissionCID(roundID);
    console.log('returning round CID', result, 'for round', roundID);
    return result;
  }

  /**
   * getJSONofCID
   * @description gets the JSON of a CID
   * @param {*} cid
   * @returns
   */
  async getJSONofCID(cid) {
    return await getJSONFromCID(cid, 'dataList.json');
  }

  /**
   * validate
   * @description validates a round of results from another node against the Twitter API
   * @param {*} proofCid
   * @returns
   */
  async validate(proofCid, round) {
    // in order to validate, we need to take the proofCid
    // and go get the results from IPFS
    try {
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second delay
      let data = await getJSONFromCID(proofCid, 'dataList.json');

      let proofThreshold = 1;

      if (data && data !== null && data.length > 0) {
        for (let i = 0; i < proofThreshold; i++) {
          let randomIndex = Math.floor(Math.random() * data.length);
          let item = data[randomIndex];

          if (item.id) {
            const result = await this.adapter.verify(item.data, round);
            console.log('Result from verify', result);
            return result;
          } else {
            console.log('Invalid Item ID: ', item.id);
            continue;
          }
        }
      } else {
        console.log('no data from proof CID');
        return false;
      }
      // if none of the random checks fail, return true
      return true;
    } catch (e) {
      console.log('error in validate', e);
      return true;
    }
  }
}

module.exports = TwitterTask;

/**
 * getJSONFromCID
 * @description gets the JSON from a CID
 * @param {*} cid
 * @returns promise<JSON>
 */
const getJSONFromCID = async (cid, fileName, retries = 3) => {
  const validateCID = await isValidCID(cid);
  if (!validateCID) {
    console.log(`Invalid CID: ${cid}`);
    return null;
  }

  const client = new KoiiStorageClient(undefined, undefined, false);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const blob = await client.getFile(cid, fileName);
      const text = await blob.text(); // Convert Blob to text
      const data = JSON.parse(text); // Parse text to JSON
      return data;
    } catch (error) {
      console.log(
        `Attempt ${attempt}: Error fetching file from Koii IPFS: ${error.message}`,
      );
      if (attempt === retries) {
        throw new Error(`Failed to fetch file after ${retries} attempts`);
      }
      // Optionally, you can add a delay between retries
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
    }
  }

  return null;
};
