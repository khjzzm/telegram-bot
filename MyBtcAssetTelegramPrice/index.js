const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const AMOUNT = process.env.AMOUNT;
const PURCHASE_PRICE = process.env.PURCHASE_PRICE;
const COIN = process.env.COIN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const sendMessage = async (text) => {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "Markdown"
  });
};

exports.handler = async () => {
  try {
    const tickerRes = await axios.get("https://api.upbit.com/v1/ticker", {
      params: { markets: `KRW-${COIN}` }
    });
    const current = tickerRes.data[0].trade_price;
    const currentProfit = (current - PURCHASE_PRICE) * AMOUNT;
    const profitRate = ((current - PURCHASE_PRICE) / PURCHASE_PRICE) * 100;
    const msg = `📊 *${COIN} 수익률*

현재가: ${current.toLocaleString()} KRW
수익률: ${profitRate.toFixed(2)}%
손익: ${Math.round(currentProfit).toLocaleString()} KRW
`;

    await sendMessage(msg);
    return { statusCode: 200, body: "Sent" };
  } catch (err) {
    console.error("❌ 에러:", err.message);
    await sendMessage("❌ 시세 조회 실패");
    return { statusCode: 500, body: "Error" };
  }
};