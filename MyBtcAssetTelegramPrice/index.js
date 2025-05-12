const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const AMOUNT = parseFloat(process.env.AMOUNT); // 보유 수량
const PURCHASE_PRICE = parseFloat(process.env.PURCHASE_PRICE); // 매수 단가
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const CMC_API_KEY = process.env.CMC_API_KEY;

const sendMessage = async (text) => {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown"
  });
};

exports.handler = async () => {
  try {
    // 1. 업비트 시세 조회
    const upbitRes = await axios.get("https://api.upbit.com/v1/ticker", {
      params: { markets: "KRW-BTC" }
    });
    const upbitPrice = upbitRes.data[0].trade_price;

    // 2. 코인마켓캡 BTC 가격 (USD, KRW)
    const cmcUSD = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        Accept: 'application/json',
      },
      params: {
        start: '1',
        limit: '10',
        convert: 'USD',
      },
    });

    const cmcKRW = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        Accept: 'application/json',
      },
      params: {
        start: '1',
        limit: '10',
        convert: 'KRW',
      },
    });

    const btcUSD = cmcUSD.data.data.find(c => c.symbol === 'BTC');
    const btcKRW = cmcKRW.data.data.find(c => c.symbol === 'BTC');

    const usdPrice = btcUSD.quote.USD.price;
    const cmcPriceKRW = btcKRW.quote.KRW.price;

    // 3. 김치프리미엄 계산
    const kimchiPremium = ((upbitPrice - cmcPriceKRW) / cmcPriceKRW) * 100;
    const priceGap = upbitPrice - cmcPriceKRW;

    // 4. 수익률/손익 계산
    const profit = (upbitPrice - PURCHASE_PRICE) * AMOUNT;
    const profitRate = ((upbitPrice - PURCHASE_PRICE) / PURCHASE_PRICE) * 100;

    const isUp = (value) => value > 0 ? '+' : '-';

    const msg = `*BTC 시세 조회*

현재가 : ${upbitPrice.toLocaleString()} KRW / ${Math.round(usdPrice).toLocaleString('en-US')} USD
김프 : ${isUp(kimchiPremium)}${Math.abs(kimchiPremium).toFixed(2)}% (${Math.floor(Math.abs(priceGap)).toLocaleString()} KRW)

*${isUp(profit)}${Math.abs(Math.round(profit)).toLocaleString()} KRW (${isUp(profitRate)}${Math.abs(profitRate).toFixed(2)}%)*

`;

    await sendMessage(msg);
    return { statusCode: 200, body: "Sent" };
  } catch (err) {
    console.error("❌ 에러:", err.message);
    await sendMessage("❌ 시세 조회 실패");
    return { statusCode: 500, body: "Error" };
  }
};