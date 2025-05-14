const https = require('https');

exports.handler = async (event) => {
  const {
    movement = '',
    equipment = '',
    sort = 'relevant',
    paged = '1',
    'movement-ex': movementEx,
    score_type = '',
    category = '',
  } = event.queryStringParameters || {};

  const queryObj = {
    sort,
    paged,
    ref: 'headernav',
  };

  if (movement) queryObj.movement = movement;
  if (equipment) queryObj.equipment = equipment;
  if (movementEx) queryObj['movement-ex'] = movementEx;
  if (score_type) queryObj.score_type = score_type;
  if (category) queryObj.category = category;

  const query = new URLSearchParams(queryObj).toString();
  const url = `https://wodwell.com/wp-json/wodwell/v2/pages/filters/?${query}`;

  try {
    const raw = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });

    // ⚠️ JSON parse + BOM 제거 (첫 문자가 BOM일 경우)
    const cleaned = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
    const parsed = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wods: parsed.wods }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to fetch WOD data',
        detail: err.message,
      }),
    };
  }
};