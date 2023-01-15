const needle = require('needle');

module.exports = async () => {
  const res = await needle('get', 'https://abs.twimg.com/responsive-web/client-web/main.a8574df5.js');
  if (res.body) {
    return res.body.toString().match(/a="[A-Za-z0-9%]{104}"/)[0].slice(3, -1);
  }
  throw new Error('Unsuccessful request');
};
