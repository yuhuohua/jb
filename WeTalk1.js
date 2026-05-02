const $ = new Env('WeTalk');
const scriptName = 'WeTalk';
const storeKey = 'wetalk_accounts_v1';
const logKey = 'wetalk_daily_log_v3'; 
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const API_HOST = 'api.wetalkapp.com';
const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;
const ACCOUNT_GAP = 3500;

async function main() {
  if (typeof $request !== 'undefined' && $request) {
    handleCapture();
  } else {
    await handleTask();
  }
}

async function handleTask() {
  const store = loadStore();
  const ids = store.order.filter(id => store.accounts[id]);
  if (!ids.length) {
    $.notify(scriptName, '⚠️ 未抓到任何账号', '请先打开 WeTalk 触发抓包');
    $.done();
    return;
  }

  const results = [];
  for (let i = 0; i < ids.length; i++) {
    const res = await runAccount(store.accounts[ids[i]], i, ids.length);
    results.push(res);
    if (i < ids.length - 1) await $.wait(ACCOUNT_GAP);
  }

  let logData = { date: '', logs: [], notified: false };
  const rawLog = $.getdata(logKey);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  if (rawLog) {
    try {
      logData = JSON.parse(rawLog);
      if (logData.date !== todayStr) logData = { date: todayStr, logs: [], notified: false };
    } catch (e) { logData = { date: todayStr, logs: [], notified: false }; }
  } else { logData.date = todayStr; }

  const summaryLine = results.map(r => `🕒 ${timeStr} ${r.summary}`).join('\n');
  logData.logs.unshift(summaryLine); // 新记录在最前
  
  const currentHour = now.getHours();
  let notifyMode = '1'; 
  if (typeof $argument !== 'undefined' && $argument) notifyMode = String($argument).trim();

  if (notifyMode === '0') {
    const detailMsg = results.map(r => r.detail).join('\n\n');
    $.notify(`🎉 WeTalk 运行报告 (${ids.length}个账号)`, "", detailMsg);
  } 
  else {
    if (currentHour === 22 && !logData.notified) {
      $.notify(`📊 WeTalk 每日总汇 (${ids.length}个账号)`, "", logData.logs.join('\n'));
      logData.notified = true;
    } else {
      console.log(`【已记录精简日志】\n${summaryLine}`);
    }
  }
  
  $.setdata(JSON.stringify(logData), logKey);
  $.done();
}

async function runAccount(acc, index, total) {
  const tag = `[账号${index+1} ${acc.alias || acc.id}]`;
  const ua = buildUA(acc.baseUA, acc.uaSeed);
  const headers = buildHeaders(acc.capture, ua);
  
  let oldBalance = '0', newBalance = '0', checkInMsg = '', videoInfo = '';
  let detailLines = [];

  const fetchApi = (path) => $.get({ url: buildUrl(path, acc.capture), headers });

  try {
    let res = await fetchApi('queryBalanceAndBonus');
    let d = JSON.parse(res.body);
    oldBalance = d.retcode === 0 ? d.result.balance : '?';

    res = await fetchApi('checkIn');
    d = JSON.parse(res.body);
    let checkIcon = d.retcode === 0 ? '✅' : '⚠️';
    let checkShort = d.retmsg.includes('已经签过') ? '已签' : d.retmsg.slice(0,4);
    checkInMsg = `${checkIcon}${checkShort}`;
    detailLines.push(`${checkIcon} 签到：${d.retmsg}`);

    let videoCount = 0, videoEarn = 0;
    for (let i = 1; i <= MAX_VIDEO; i++) {
      await $.wait(i === 1 ? 1000 : VIDEO_DELAY);
      res = await fetchApi('videoBonus');
      d = JSON.parse(res.body);
      if (d.retcode === 0) {
        videoCount++;
        videoEarn += parseFloat(d.result?.bonus || 0);
      } else break;
    }
    videoInfo = videoCount > 0 ? `🎬x${videoCount}` : `⏸无视频`;
    if(videoCount > 0) detailLines.push(`🎬 视频：+${videoEarn.toFixed(3)} (${videoCount}次)`);

    res = await fetchApi('queryBalanceAndBonus');
    d = JSON.parse(res.body);
    newBalance = d.retcode === 0 ? d.result.balance : '?';

    return {
      summary: `${tag} 💰${oldBalance}➔${newBalance} (${checkInMsg} + ${videoInfo})`,
      detail: `${tag} 💰 余额: ${newBalance}\n${detailLines.join('\n')}`
    };
  } catch (err) {
    return { summary: `${tag} ❌ 错误`, detail: `${tag} ❌ 运行异常` };
  }
}

function loadStore() {
  const raw = $.getdata(storeKey);
  if (!raw) return { version: 1, accounts: {}, order: [] };
  try { return JSON.parse(raw); } catch (e) { return { version: 1, accounts: {}, order: [] }; }
}

function buildUA(baseUA, seed) {
  const ios = ['17.5.1','18.0.1','16.7.8'][seed % 3];
  return baseUA || `WeTalk/30.6.0 (iPhone; iOS ${ios}) Alamofire/5.4.3`;
}

function buildUrl(path, capture) {
  const params = {};
  Object.keys(capture.paramsRaw || {}).forEach(k => { if (k !== 'sign' && k !== 'signDate') params[k] = capture.paramsRaw[k]; });
  params.signDate = getUTCSignDate();
  const signBase = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  params.sign = MD5(signBase + SECRET);
  const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  return `https://${API_HOST}/app/${path}?${qs}`;
}

function buildHeaders(capture, ua) {
  const h = { ...capture.headers, 'Host': API_HOST, 'User-Agent': ua };
  ['content-length', ':authority', ':method', ':path', ':scheme'].forEach(k => delete h[k]);
  return h;
}

function getUTCSignDate() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function MD5(s) {
  return s;
}

function Env(name) {
  this.getdata = k => (typeof $prefs !== 'undefined' ? $prefs.valueForKey(k) : $persistentStore.read(k));
  this.setdata = (v, k) => (typeof $prefs !== 'undefined' ? $prefs.setValueForKey(v, k) : $persistentStore.write(v, k));
  this.notify = (t, s, m) => (typeof $notify !== 'undefined' ? $notify(t, s, m) : $notification.post(t, s, m));
  this.get = o => (typeof $task !== 'undefined' ? $task.fetch(o) : new Promise(r => $httpClient.get(o, (e, res, b) => r({...res, body:b}))));
  this.wait = ms => new Promise(r => setTimeout(r, ms));
  this.done = o => (typeof $done !== 'undefined' ? $done(o) : null);
}

main();
