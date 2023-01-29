const https = require('https');
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Keyv = require('keyv');
const moment = require('moment');
const sqlLock = require('sql-lock');
const getTweet = require('./utils/getTweet');
const getTwitterFollowersId = require('./utils/getTwitterFollowersId');
const isAddress = require('./utils/address');
const sendNetworkToken = require('./utils/sendNetworkToken');
require('dotenv').config();

const main = async () => {
  const keyv = new Keyv(process.env.database_uri);
  await sqlLock.initialize(process.env.database_uri, { locking_ttl: 30000 });

  const { user_rate_limit, rate_limit_duration } = process.env;
  const ethAddressRegex = /0x[a-fA-F0-9]{40}/;
  const mentionRegex = /(?<!^)@parastateio/;

  // Web page rate limit
  const web_page_limiter = rateLimit({
    windowMs: ((parseInt(rate_limit_duration) * 60) * 1000),
    max: parseInt(user_rate_limit),
    message: '<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="shortcut icon" href="favicon.ico"><meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"><meta name="theme-color" content="#000000"><title>Home | Rate Limit Exceeded</title><link rel="stylesheet" href="style.css"></head><body><div id="root"><div class="View WelcomeView"><h1 class="Banner">Rate Limit Exceeded</h1><br /><div class="Message center"><div class="Title"><h3>Sorry!</h3></div></div><div class="center"><img src="rate_limit.png"></img></div><div class="Message center"><p>Rate limit exceeded, Please try again later.</p></div></div></div></body></html>',
  });

  // API rate limit
  const api_limiter = rateLimit({
    windowMs: ((parseInt(rate_limit_duration) * 60) * 1000),
    max: parseInt(user_rate_limit),
    message: 'Rate limit exceeded',
  });

  const app = express();

  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'pug');
  app.use(express.static(path.join(__dirname, '/public/')));
  app.use(cors());
  // Rate limiting for simple spamming of page reloads
  app.use('/faucet/', web_page_limiter);
  // Rate limiting for repeated API calls
  app.use('/api/', api_limiter);

  app.get('/', (req, res) => {
    const direct = `Click to visit <a href="https://${process.env.server_name}:${process.env.server_port}/faucet" target="_blank"> :8001/faucet </a>`;
    res.send(direct);
  });

  app.get('/faucet', (req, res) => {
    res.render('index', {
      title: 'Home',
      erc20_address: process.env.erc20_address,
      blockchain_name: process.env.blockchain_name,
      erc20_token_amount_in_wei: process.env.erc20_token_amount_in_wei,
      rate_limit_duration: process.env.rate_limit_duration,
      twitter_handle: process.env.twitter_handle,
      user_rate_limit: process.env.user_rate_limit,
    });
  });

  app.post('/api/twitter/:tweet_id', async (req, res) => {
    const { tweet_id } = req.params;

    if (tweet_id.match(/incorrect/g)) {
      console.log('tweet id is broken');
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: 'Invalid Tweet URL, click here for more information!',
        duration: 15000,
        destination: 'https://help.twitter.com/en/using-twitter/tweet-and-moment-url',
        newWindow: true,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #330066, #9900CC)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    const result = await getTweet(tweet_id);

    if (JSON.stringify(result).toLowerCase().includes('error')) {
      console.log('tweet id is broken');
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: 'Invalid Tweet URL, click here for more information!',
        duration: 15000,
        destination: 'https://help.twitter.com/en/using-twitter/tweet-and-moment-url',
        newWindow: true,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #330066, #9900CC)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    console.log(`Full result: ${JSON.stringify(result)}`);
    const ethAddress = ethAddressRegex.exec(result.full_text);

    if (ethAddress === null) {
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: 'The recipient address in the Tweet is not valid',
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #FF0000, #800000)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    if (!isAddress(ethAddress[0])) {
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: 'The recipient address in the Tweet is not valid',
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #FF0000, #800000)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    if (mentionRegex.exec(result.full_text) === null) {
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: `You must mention ${process.env.twitter_handle} somewhere in your tweet (except at the start)`,
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #FF0000, #800000)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    if ((await keyv.get(`twitter-faucet-lasttx-${result.user.id}`)) === moment().format('YYYY-MM')) {
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: 'Rate limit! You already received State tokens for this month',
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #FF0000, #800000)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    if ((await keyv.get(`ethaddress-faucet-lasttx-${ethAddress[0]}`)) === moment().format('YYYY-MM')) {
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: `Sorry! the address of ${ethAddress[0]} has already been funded for this month.`,
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #FF0000, #800000)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    const followerIds = await getTwitterFollowersId();

    if (!followerIds.includes(result.user.id.toString())) {
      const toastObjectFail = {
        avatar: 'toast-avatar.jpg',
        text: `Click here and follow ${process.env.twitter_handle} first to receive tokens. NB. If you just followed, it may take 2 minutes to work.`,
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #FF0000, #800000)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectFail);
    }

    const receipt = await sendNetworkToken(ethAddress[0]);

    if (receipt.status === 'success') {
      await keyv.set(`twitter-faucet-lasttx-${result.user.id}`, moment().format('YYYY-MM'));

      const lockReleaser = await sqlLock.getLock(ethAddress[0], 3000);
      await keyv.set(`ethaddress-faucet-lasttx-${ethAddress[0]}`, moment().format('YYYY-MM'));
      lockReleaser();

      const toastObjectSuccess = {
        avatar: 'toast-avatar.jpg',
        text: 'State token sent, please check your account!',
        duration: 15000,
        close: true,
        gravity: 'top', // `top` or `bottom`
        position: 'right', // `left`, `center` or `right`
        backgroundColor: 'linear-gradient(to right, #008000, #3CBC3C)',
        stopOnFocus: false, // Prevents dismissing of toast on hover
        onClick() {}, // Callback after click
      };
      return res.send(toastObjectSuccess);
    }
  });

  /**
     * Server Activation
     */

  if (process.env.https === 'yes') {
    const ca = fs.readFileSync(`/etc/letsencrypt/live/${process.env.server_name}/fullchain.pem`, 'utf8');
    const certificate = fs.readFileSync(`/etc/letsencrypt/live/${process.env.server_name}/cert.pem`, 'utf8');
    const privateKey = fs.readFileSync(`/etc/letsencrypt/live/${process.env.server_name}/privkey.pem`, 'utf8');
    const credentials = {
      key: privateKey,
      cert: certificate,
      ca,
    };
    https.createServer(credentials, app).listen(process.env.server_port, process.env.host, () => {
      console.log('Welcome to faucet; using https');
      console.log(`Host:${process.env.host}\nPort: ${server_port}`);
    });
  } else if (process.env.https === 'no') {
    app.listen(process.env.server_port, '0.0.0.0', () => {
      console.log(`Listening to requests on http://localhost:${process.env.server_port}`);
    });
  } else {
    console.log('ERROR: Please set the https setting in the .env config file');
  }
};

main().catch((error) => {
  console.log(error);
});
