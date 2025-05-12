const axios = require('axios');

exports.handler = async (event) => {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
  const sendMessage = async (chatId, text) => {
    return axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "Markdown"
    });
  };

  let body = {};
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const chatId = body.message?.chat?.id || body.callback_query?.message?.chat?.id;
  const text = body.message?.text?.trim()?.toUpperCase();
  const callbackData = body.callback_query?.data;

  if (!chatId) return { statusCode: 200, body: "No message" };

  if (text === "/START") {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "🤖 아래 버튼을 선택해보세요!",
      reply_markup: {
        keyboard: [
          [{ text: "상승률" }, { text: "하락률" }, { text: "거래대금" }],
          [{ text: "저점대비 반등률" }, { text: "급등종목" }],
          [{ text: "변동성" }, { text: "신고가근접" }, { text: "신저가반등" }],
          [{ text: "티커 확인" }]
        ],
        resize_keyboard: true
      }
    });
    return { statusCode: 200, body: "Menu sent" };
  }

  let marketRes, tickerRes;
  try {
    marketRes = await axios.get("https://api.upbit.com/v1/market/all");
  } catch {
    return await sendMessage(chatId, "❌ 마켓 정보를 가져오지 못했습니다.");
  }

  const krwMarkets = marketRes.data.filter(m => m.market.startsWith("KRW-"));
  const marketCodes = krwMarkets.map(m => m.market);

  try {
    tickerRes = await axios.get("https://api.upbit.com/v1/ticker", {
      params: { markets: marketCodes.join(",") }
    });
  } catch {
    return await sendMessage(chatId, "❌ 시세 정보를 가져오지 못했습니다.");
  }

  const sorted = tickerRes.data.map((coin) => ({
    code: coin.market.replace("KRW-", ""),
    changeRate: coin.signed_change_rate * 100,
    volume: coin.acc_trade_price_24h,
    trade_price: coin.trade_price,
    low_price: coin.low_price,
    high_price: coin.high_price,
    highest_52_week_price: coin.highest_52_week_price,
    lowest_52_week_price: coin.lowest_52_week_price,
    bounceRate: coin.low_price > 0 ? (coin.trade_price - coin.low_price) / coin.low_price * 100 : 0,
    volatility: coin.low_price > 0 ? (coin.high_price - coin.low_price) / coin.low_price * 100 : 0,
    highApproach: coin.highest_52_week_price > 0 ? coin.trade_price / coin.highest_52_week_price * 100 : 0,
    lowBounce: coin.lowest_52_week_price > 0 ? (coin.trade_price - coin.lowest_52_week_price) / coin.lowest_52_week_price * 100 : 0
  }));

  let reply = "";

  if (callbackData?.startsWith("/price_")) {
    const coinCode = callbackData.replace("/price_", "");
    const coin = sorted.find(c => c.code === coinCode);
    if (coin) {
      reply =
        `💰 *${coinCode} 시세 정보*\n` +
        `현재가: ${coin.trade_price.toLocaleString()} KRW\n` +
        `상승률: ${coin.changeRate.toFixed(2)}%\n` +
        `거래대금: ${Math.round(coin.volume / 1_0000_0000)}억 KRW\n` +
        `저점 대비 반등률: ${coin.bounceRate.toFixed(2)}%\n` +
        `52주 신고가 근접률: ${coin.highApproach.toFixed(2)}%\n` +
        `52주 신저가 반등률: ${coin.lowBounce.toFixed(2)}%\n` +
        `변동성: ${coin.volatility.toFixed(2)}%`;
    } else {
      reply = `❌ ${coinCode} 정보가 없습니다.`;
    }

    await sendMessage(chatId, reply);
    return { statusCode: 200, body: "callback handled" };
  }

  if (text === "티커 확인") {
    const PAGE_SIZE = 10;
    const pageTickers = krwMarkets.slice(0, PAGE_SIZE);
    const keyboard = pageTickers.map(t => [{
      text: `${t.market.replace("KRW-", "")} (${t.korean_name})`,
      callback_data: `/price_${t.market.replace("KRW-", "")}`
    }]);
    keyboard.push([{ text: "▶️ 다음", callback_data: "/ticker_page_2" }]);
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: "조회할 코인을 선택하세요:",
      reply_markup: { inline_keyboard: keyboard }
    });
    return { statusCode: 200, body: "티커 선택 전송됨" };
  }

  if (callbackData?.startsWith("/ticker_page_")) {
    const PAGE_SIZE = 10;
    const page = Number(callbackData.split("_")[2]) || 1;
    const start = (page - 1) * PAGE_SIZE;
    const end = page * PAGE_SIZE;
    const pageTickers = krwMarkets.slice(start, end);
    const keyboard = pageTickers.map(t => [{
      text: `${t.market.replace("KRW-", "")} (${t.korean_name})`,
      callback_data: `/price_${t.market.replace("KRW-", "")}`
    }]);
    if (krwMarkets.length > end) keyboard.push([{ text: "▶️ 다음", callback_data: `/ticker_page_${page + 1}` }]);
    if (page > 1) keyboard.push([{ text: "◀️ 이전", callback_data: `/ticker_page_${page - 1}` }]);
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `페이지 ${page} / ${Math.ceil(krwMarkets.length / PAGE_SIZE)}`,
      reply_markup: { inline_keyboard: keyboard }
    });
    return { statusCode: 200, body: `page ${page} sent` };
  }

  switch (text) {
    case "상승률":
      reply = "📈 *상승률 TOP 10*\n";
      sorted.sort((a, b) => b.changeRate - a.changeRate).slice(0, 10).forEach((c, i) => {
        reply += `${i + 1}. ${c.code} +${c.changeRate.toFixed(2)}%\n`;
      });
      break;
    case "하락률":
    reply = "📉 *하락률 TOP 10*\n";
    sorted.sort((a, b) => a.changeRate - b.changeRate).slice(0, 10).forEach((c, i) => {
      reply += `${i + 1}. ${c.code} ${c.changeRate.toFixed(2)}%\n`;
     });
    break;
    case "거래대금":
      reply = "🔥 *거래대금 TOP 5*\n";
      sorted.sort((a, b) => b.volume - a.volume).slice(0, 5).forEach((c, i) => {
        reply += `${i + 1}. ${c.code} ${Math.round(c.volume / 1_0000_0000)}억 KRW\n`;
      });
      break;
    case "저점대비 반등률":
      reply = "💡 *저점 대비 반등률 TOP 5*\n";
      sorted.sort((a, b) => b.bounceRate - a.bounceRate).slice(0, 5).forEach((c, i) => {
        reply += `${i + 1}. ${c.code} +${c.bounceRate.toFixed(2)}%\n`;
      });
      break;
    case "급등종목":
      const spikes = sorted.filter(c => c.changeRate >= 15);
      reply = "🚨 *급등 종목 (15%↑)*\n";
      reply += spikes.length ? spikes.map((c, i) => `${i + 1}. ${c.code} +${c.changeRate.toFixed(2)}%`).join("\n") : "없음";
      break;
    case "변동성":
      reply = "📊 *변동성 TOP 5*\n";
      sorted.sort((a, b) => b.volatility - a.volatility).slice(0, 5).forEach((c, i) => {
        reply += `${i + 1}. ${c.code} ${c.volatility.toFixed(2)}%\n`;
      });
      break;
    case "신고가근접":
      reply = "📈 *52주 신고가 근접률 TOP 5*\n";
      sorted.sort((a, b) => b.highApproach - a.highApproach).slice(0, 5).forEach((c, i) => {
        reply += `${i + 1}. ${c.code} ${c.highApproach.toFixed(2)}%\n`;
      });
      break;
    case "신저가반등":
      reply = "📉 *52주 신저가 반등률 TOP 5*\n";
      sorted.sort((a, b) => b.lowBounce - a.lowBounce).slice(0, 5).forEach((c, i) => {
        reply += `${i + 1}. ${c.code} ${c.lowBounce.toFixed(2)}%\n`;
      });
      break;
    default:
      if (text?.startsWith("/")) {
        const coinCode = text.replace("/", "");
        const coin = sorted.find(c => c.code === coinCode);
        reply = coin
          ? `💰 *${coinCode} 시세*\n${coin.trade_price.toLocaleString()} KRW`
          : `❌ ${coinCode}는 지원하지 않거나 잘못된 티커입니다.`;
      } else {
        reply = "🤖 명령어를 인식하지 못했어요.\n/start를 입력하여 버튼을 확인하세요.";
      }
  }

  try {
    await sendMessage(chatId, reply);
    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error("❌ 텔레그램 전송 실패:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Telegram sendMessage 실패" }) };
  }
};