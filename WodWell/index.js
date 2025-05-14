const https = require('https');

exports.handler = async (event) => {
  const { movement = '', equipment = '', sort = 'relevant', paged = '1' } = event.queryStringParameters || {};

  const query = new URLSearchParams({
    movement,
    equipment,
    sort,
    paged,
    ref: 'headernav',
  }).toString();

  const url = `https://wodwell.com/wp-json/wodwell/v2/pages/filters/?${query}`;

  try {
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to fetch WOD data', detail: err.message }),
    };
  }
};