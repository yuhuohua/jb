/**
 * 声荐每日任务 - 通用版 (Surge/Loon/Quantumult X)
 * 包含：签到 + 领花 + 每日汇总
 * 
 * 变量说明：
 * - shengjian_auth_token: 抓取到的 Token
 * - shengjian_daily_stats: 每日统计记录
 */

const $ = new Env("声荐每日任务");
const tokenKey = "shengjian_auth_token";
const statsKey = "shengjian_daily_stats";

// --- 参数解析 (兼容 Surge/Loon) ---
const notifyEveryTime = (() => {
    if (typeof $argument !== "undefined" && $argument) {
        // 匹配 1, true, [true] 等开启标志
        if (/1|true|\[true\]/.test($argument)) return true;
    }
    return false;
})();

const rawToken = $.read(tokenKey);
const token = rawToken ? (rawToken.startsWith('Bearer ') ? rawToken : 'Bearer ' + rawToken) : null;

const commonHeaders = {
    'Authorization': token,
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.64 NetType/4G Language/zh_CN',
    'Referer': 'https://servicewechat.com/wxa25139b08fe6e2b6/23/page-frame.html'
};

// --- 主程序 ---
(async () => {
    console.log(`--- ${$.name} 开始 ---`);
    const now = new Date();
    const hour = now.getHours();
    const isReportTime = (hour === 22);

    if (!token) {
        $.notify("🛑 声荐认证失败", "未找到令牌", "请先打开小程序抓取 Token");
        return $.done();
    }

    // 执行任务
    const [signInRes, flowerRes] = await Promise.all([signIn(), claimFlower()]);

    // 更新统计
    let stats = getDailyStats();
    const logEntry = `[${hour}点] ${signInRes.message} | ${flowerRes.message}`;
    stats.logs.push(logEntry);
    saveDailyStats(stats);

    // 状态判断
    if (signInRes.status === 'token_error' || flowerRes.status === 'token_error') {
        $.notify("🚫 声荐 Token 过期", "请重新打开小程序更新令牌", "");
        return $.done();
    }

    // 通知逻辑
    if (notifyEveryTime) {
        // 开启了每次通知
        $.notify("声荐签到结果", "", `${signInRes.message}\n${flowerRes.message}`);
    } else if (isReportTime) {
        // 22点汇总通知
        const summary = stats.logs.join('\n');
        $.notify("📊 声荐每日汇总", `今日执行 ${stats.logs.length} 次`, summary);
    } else {
        console.log(`静默运行中 (${hour}点)，结果已记录到统计中`);
    }

    console.log(`--- ${$.name} 结束 ---`);
    $.done();
})().catch(e => {
    console.log(`❌ 运行出错: ${e}`);
    $.done();
});

// --- 接口函数 ---
function signIn() {
    return new Promise(resolve => {
        $.post({
            url: 'https://xcx.myinyun.com:4438/napi/gift',
            headers: commonHeaders,
            body: '{}'
        }, (err, resp, body) => {
            if (err) return resolve({ status: 'error', message: '📡 签到网络错误' });
            const code = resp ? (resp.statusCode || resp.status) : 0;
            if (code === 401) return resolve({ status: 'token_error', message: 'Token失效' });
            try {
                const res = JSON.parse(body);
                if (res.msg === 'ok') {
                    resolve({ status: 'success', message: `✅ ${res.data?.prizeName || '签到成功'}` });
                } else {
                    resolve({ status: 'done', message: `📋 ${res.msg || '重复签到'}` });
                }
            } catch (e) { resolve({ status: 'error', message: '🤯 签到解析失败' }); }
        });
    });
}

function claimFlower() {
    return new Promise(resolve => {
        $.post({
            url: 'https://xcx.myinyun.com:4438/napi/flower/get',
            headers: commonHeaders,
            body: '{}'
        }, (err, resp, body) => {
            if (err) return resolve({ status: 'error', message: '📡 领花网络错误' });
            if (body === 'true') return resolve({ status: 'success', message: '🌺 领花成功' });
            try {
                const res = JSON.parse(body);
                if (res.status === 401) return resolve({ status: 'token_error', message: 'Token失效' });
                const msg = res.message || '';
                if (msg.includes('未到')) return resolve({ status: 'done', message: '⏰ 时间未到' });
                resolve({ status: 'done', message: `🌸 ${msg || '已领过'}` });
            } catch (e) {
                if (body === 'false') resolve({ status: 'done', message: '👍 已领取过' });
                else resolve({ status: 'error', message: '🤔 领花响应异常' });
            }
        });
    });
}

// --- 辅助函数 ---
function getDailyStats() {
    const today = new Date().toISOString().slice(0, 10);
    let stats = {};
    try { stats = JSON.parse($.read(statsKey) || '{}'); } catch (e) { stats = {}; }
    if (stats.date !== today) stats = { 'date': today, 'logs': [] };
    return stats;
}

function saveDailyStats(data) {
    $.write(JSON.stringify(data), statsKey);
}

// --- 环境封装 (Surge/Loon/QX) ---
function Env(name) {
    this.name = name;
    this.read = (key) => {
        if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
        if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
        return null;
    };
    this.write = (val, key) => {
        if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key);
        if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, key);
        return false;
    };
    this.notify = (title, sub, msg) => {
        if (typeof $notification !== 'undefined') $notification.post(title, sub, msg);
        else if (typeof $notify !== 'undefined') $notify(title, sub, msg);
        console.log(`[通知] ${title}: ${sub}\n${msg}`);
    };
    this.post = (opts, cb) => {
        if (typeof $httpClient !== 'undefined') $httpClient.post(opts, cb);
    };
    this.done = (obj = {}) => {
        if (typeof $done !== 'undefined') $done(obj);
    };
}
