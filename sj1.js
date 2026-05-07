const $ = new Env("声荐组合任务");

// ================= 参数解析 (增强版) =================
const ARGS = (() => {
    let val = "0"; // 默认汇总模式
    if (typeof $argument !== "undefined" && $argument) {
        // 去掉引号和括号
        let input = String($argument).trim().replace(/[\"\{\}\[\]]/g, "");
        
        if (input === "1") {
            val = "1";
        } else if (input === "0") {
            val = "0";
        } else {
            // 如果解析出来还是占位符，说明 Loon 配置没生效
            console.log(`⚠️ 警告：Loon未正确替换变量，收到原始值为: ${$argument}`);
            val = "0"; 
        }
    }
    return { notify: val };
})();

const tokenKey = "shengjian_auth_token";
const STATS_KEY = "shengjian_daily_stats";
const LAST_RUN_HOUR = 22; 

const currentHour = new Date().getHours();
const isLastRun = (currentHour === LAST_RUN_HOUR);

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith("Bearer ") ? rawToken : `Bearer ${rawToken}`) : null;

const commonHeaders = {
  "Authorization": token,
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN",
  "Referer": "https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html"
};

// ================= 数据持久化 =================
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

// ================= 模拟业务请求 (保持原样) =================
function signIn() {
  return new Promise((resolve) => {
    $.put({ url: "https://xcx.myinyun.com:4438/napi/gift", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      try {
        const result = JSON.parse(data);
        if (result.msg === "ok") resolve({ message: `✅ 签到: ${result.data?.prizeName || "成功"}` });
        else resolve({ message: `🚫 签到: ${result.msg || "失败"}` });
      } catch { resolve({ message: '🤯 签到异常' }); }
    });
  });
}

function claimFlower() {
  return new Promise((resolve) => {
    $.post({ url: "https://xcx.myinyun.com:4438/napi/flower/get", headers: commonHeaders, body: "{}" }, (err, res, data) => {
      if (data === "true") resolve({ message: '🌺 已领花' });
      else resolve({ message: '👍 已领过/未到时' });
    });
  });
}

// ================= 主逻辑 =================
(async () => {
  console.log(`[调试] 当前模式参数: ${ARGS.notify} (1为单次, 0为汇总)`);
  
  if (!token) {
    $.notify("❌ 声荐任务失败", "未找到令牌", "");
    return $.done();
  }

  const [signRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);
  const currentResult = `${signRes.message} | ${flowerRes.message}`;
  const logWithTime = `[${currentHour}点] ${currentResult}`;
  
  // 1. 永远记录日志
  let dailyStats = getDailyStats();
  dailyStats.logs.push(logWithTime);
  saveDailyStats(dailyStats);

  // 2. 核心通知逻辑判定
  if (ARGS.notify === "1") {
      // 只要设为1，不管是不是22点，都只发单次通知
      console.log(">>> 执行：单次通知");
      $.notify("🔔 声荐单次任务", `时间: ${currentHour}点`, currentResult);
  } 
  else {
      // 设为0（或解析失败时），仅在22点发汇总
      if (isLastRun) {
          console.log(">>> 执行：全天汇总通知");
          const summaryBody = `📅 日期: ${dailyStats.date}\n🔄 次数: ${dailyStats.logs.length}\n───────────\n${dailyStats.logs.join("\n")}`;
          $.notify("📊 声荐每日汇总", "", summaryBody);
      } else {
          console.log(">>> 执行：静默模式，仅记录");
      }
  }

  $.done();
})().catch(e => { console.log(e); $.done(); });

function Env(name) {
  this.name = name;
  this.read = (k) => (typeof $persistentStore !== "undefined" ? $persistentStore.read(k) : $prefs.valueForKey(k));
  this.write = (v, k) => (typeof $persistentStore !== "undefined" ? $persistentStore.write(v, k) : $prefs.setValueForKey(v, k));
  this.notify = (t, s, b) => (typeof $notification !== "undefined" ? $notification.post(t, s, b) : console.log(`${t}\n${s}\n${b}`));
  this.put = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.put(r, c) : $http.put(r, c));
  this.post = (r, c) => (typeof $httpClient !== "undefined" ? $httpClient.post(r, c) : $http.post(r, c));
  this.done = (v = {}) => typeof $done !== "undefined" && $done(v);
}
