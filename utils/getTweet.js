const needle = require('needle');
const getTwitterToken = require('./getTwitterToken');

module.exports = async (tweetId) => {
  const params = {
    id: tweetId,
    trim_user: 'true',
    tweet_mode: 'extended',
  };
  const res = await needle('get', 'https://api.twitter.com/1.1/statuses/show.json', params, {
    headers: {
      authorization: `Bearer ${await getTwitterToken()}`,
    },
  });
  if (res.body) {
    return res.body;
  }
  throw new Error('Unsuccessful request');
};
