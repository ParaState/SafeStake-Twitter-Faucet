const needle = require('needle');
const BigNumber = require('bignumber.js');
const getTwitterToken = require('./getTwitterToken');

const getFollowersId = async (params, options) => {
  try {
    const resp = await needle('get', 'https://api.twitter.com/1.1/followers/ids.json', params, options);

    if (resp.statusCode !== 200) {
      console.log(`${resp.statusCode} ${resp.statusMessage}:\n${resp.body}`);
      return;
    }
    return resp.body;
  } catch (err) {
    console.log('Unable to access Twitter at this stage in time ... rate limit issue at Twitter');
  }
};

module.exports = async () => {
  const ids = [];
  const params = {
    max_results: 5000,
    user_id: process.env.twitter_id,
    cursor: -1,
  };

  const options = {
    headers: {
      authorization: `Bearer ${await getTwitterToken()}`,
    },
  };
  try {
    let hasNextPage = true;
    console.log('Retrieving followers...');
    while (hasNextPage) {
      const resp = await getFollowersId(params, options);
      // console.log("*** Response body: " + JSON.stringify(resp));
      if (resp.next_cursor > 0) {
        for (let iter = 0; iter < resp.ids.length; iter++) {
          const temp = new BigNumber(resp.ids[iter]);
          ids.push(temp.toString());
        }
        params.cursor = resp.next_cursor;
      } else {
        for (let iter = 0; iter < resp.ids.length; iter++) {
          const temp = new BigNumber(resp.ids[iter]);
          ids.push(temp.toString());
        }
        hasNextPage = false;
      }
    }
    console.log(`Number of followers is: ${ids.length}`);
    return ids;
  } catch {
    console.log('Unable to access Twitter API inside the getFollowers function of index.js');
    return ids;
  }
};
