const $ = new Env("声荐组合任务");

const ARGS = (() => {
    let mode = "0"; // 默认汇总模式
    if (typeof $argument !== "undefined" && $argument) {
        const argStr = typeof $argument === "string" ? $argument : JSON.stringify($argument);
        const match = argStr.match(/[01]/);
        if (match) mode = match[0];
    }
    return { notify: mode };
})();

const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";
const LAST_RUN_HOUR = 22; // 汇总通知时间

const currentHour = new Date().getHours();
const isLastRun = currentHour === LAST_RUN_HOUR;

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

(async () => {
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "请先打开小程序获取。");
    return $.done();
  }

  const [signRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);
  const currentResult = `${signRes.message} | ${flowerRes.message}`;
  const logWithTime = `[${currentHour}点] ${currentResult}`;
 
  console.log(logWithTime);

  let dailyStats = getDailyStats();
  dailyStats.logs.push(logWithTime);
  saveDailyStats(dailyStats);

  if (ARGS.notify === "1") {
      // 模式 1: 每次运行都弹窗（单次内容）
      $.notify("🔔 声荐单次通知", `当前时间: ${currentHour}点`, currentResult);
  } else if (isLastRun) {
      // 模式 0: 仅在 22 点进行全天汇总弹窗
      const summaryBody = `📅 日期: ${dailyStats.date}\n🔄 运行次数: ${dailyStats.logs.length}\n───────────\n${dailyStats.logs.join("\n")}`;
      $.notify("📊 声荐每日汇总", "", summaryBody);
  }

  $.done();
})().catch((e) => { console.log(e); $.done(); });

function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { stats = JSON.parse($.read(STATS_KEY) || "{}"); } catch (e) { stats = {}; }
    if (stats.date !== today || !Array.isArray(stats.logs)) {
        stats = { date: today, logs: [] };
    }
    return stats;
}

function saveDailyStats(stats) {
    $.write(JSON.stringify(stats), STATS_KEY);
}

function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      try {
        const r = JSON.parse(data);
        if (r.msg === "ok") resolve({ message: `✅ 签到: ${r.data?.prizeName || "成功"}` });
        else if (String(r.msg).includes("已经")) resolve({ message: '📋 签到: 已用完' });
        else resolve({ message: `🚫 签到: ${r.msg || "失败"}` });
      } catch { resolve({ message: '🤯 签到异常' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (data === "true") resolve({ message: '🌺 已领花' });
      else if (data === "false") resolve({ message: '👍 已领过' });
      else resolve({ message: '⏰ 未到时' });
    });
  });
}

function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : $prefs.valueForKey(k));
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : $prefs.setValueForKey(v, k));
  this.notify = (t, s, b) => {
    if (typeof $notification !== "undefined") $notification.post(t, s, b);
    else if (typeof $notify !== "undefined") $notify(t, s, b);
    else console.log(`${t}\n${s}\n${b}`);
  };
  this.put = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.put(r, c) : $http.put(r, c));
  this.post = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.post(r, c) : $http.post(r, c));
  this.done = (v = {}) => (typeof $done !== "undefined" ? $done(v) : null);
}
