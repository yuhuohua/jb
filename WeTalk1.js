const $ = new Env('WeTalk');
const storeKey = 'wetalk_accounts_v1';
const logKey = 'wetalk_daily_log_v4';
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const API_HOST = 'api.wetalkapp.com';

const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;

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
    console.log('⚠️ No accounts found');
    $.done();
    return;
  }

  const results = [];
  for (let i = 0; i < ids.length; i++) {
    const res = await runAccount(store.accounts[ids[i]], i, ids.length);
    results.push(res);
    if (i < ids.length - 1) await $.wait(3000);
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

  const summaryBlock = results.map(r => `🕒 ${timeStr} ${r.summary}`).join('\n');
  logData.logs.unshift(summaryBlock);
  
  const currentHour = now.getHours();
  let notifyMode = (typeof $argument !== 'undefined' && $argument) ? String($argument) : '1';

  if (notifyMode === '0') {
    const detailMsg = results.map(r => r.detail).join('\n\n');
    $.notify(`🎉 WeTalk 运行报告`, "", detailMsg);
  } else {
    if (currentHour === 22 && !logData.notified) {
      $.notify(`📊 WeTalk 每日总汇 (${ids.length}个账号)`, "", logData.logs.join('\n'));
      logData.notified = true;
    } else {
      console.log(summaryBlock);
    }
  }
  
  $.setdata(JSON.stringify(logData), logKey);
  $.done();
}

async function runAccount(acc, index, total) {
  const tag = `[${acc.alias || '账号'+(index+1)}]`;
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
    let checkShort = d.retmsg.includes('已经签过') ? '已签' : d.retmsg.slice(0, 4);
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
      summary: `${tag} 💰${oldBalance}➔${newBalance} (${checkInMsg}+${videoInfo})`,
      detail: `${tag} 💰 余额: ${newBalance}\n${detailLines.join('\n')}`
    };
  } catch (err) {
    return { summary: `${tag} ❌ 失败`, detail: `${tag} ❌ 异常: ${err}` };
  }
}

function handleCapture() {
  const store = loadStore();
  const paramsRaw = {};
  const query = $request.url.split('?')[1] || '';
  query.split('&').forEach(p => { const s = p.split('='); if(s[0]) paramsRaw[s[0]] = s[1]; });
  
  const fp = MD5(Object.keys(paramsRaw).filter(k => !['sign','signDate','timestamp'].includes(k)).sort().map(k => `${k}=${paramsRaw[k]}`).join('&')).slice(0, 8);
  const existed = !!store.accounts[fp];
  
  store.accounts[fp] = {
    id: fp,
    alias: existed ? store.accounts[fp].alias : `账号${store.order.length + 1}`,
    uaSeed: existed ? store.accounts[fp].uaSeed : store.order.length,
    baseUA: $request.headers['User-Agent'] || $request.headers['user-agent'],
    capture: { url: $request.url, paramsRaw, headers: $request.headers }
  };
  if (!existed) store.order.push(fp);
  saveStore(store);
  $.notify(existed ? '🔄 WeTalk 参数更新' : '✅ WeTalk 账号入库', '', `ID: ${fp}`);
  $.done({});
}

function loadStore() {
  const raw = $.getdata(storeKey);
  if (!raw) return { accounts: {}, order: [] };
  return JSON.parse(raw);
}
function saveStore(s) { $.setdata(JSON.stringify(s), storeKey); }

function buildUA(base, seed) {
  if (base) return base;
  const ios = ['17.5.1', '18.0.1', '16.6'][seed % 3];
  return `WeTalk/30.6.0 (iPhone; iOS ${ios}) Alamofire/5.4.3`;
}

function buildUrl(path, capture) {
  const p = { ...capture.paramsRaw };
  delete p.sign; delete p.signDate;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  p.signDate = `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
  const base = Object.keys(p).sort().map(k => `${k}=${p[k]}`).join('&');
  p.sign = MD5(base + SECRET);
  const qs = Object.keys(p).map(k => `${k}=${encodeURIComponent(p[k])}`).join('&');
  return `https://${API_HOST}/app/${path}?${qs}`;
}

function buildHeaders(cap, ua) {
  const h = { ...cap.headers, 'Host': API_HOST, 'User-Agent': ua };
  ['Content-Length', 'content-length', ':authority', ':method', ':path', ':scheme'].forEach(k => delete h[k]);
  return h;
}

function MD5(string) {
  function l(a, b) { return (a << b) | (a >>> (32 - b)); }
  function m(a, b) {
    var c, d, e, f;
    e = a & 0x3FFFFFFF, f = b & 0x3FFFFFFF, c = (a & 0x40000000) + (b & 0x40000000) + (e + f), d = (a & 0x80000000) ^ (b & 0x80000000) ^ (c & 0x80000000), (c & 0x7FFFFFFF) | d;
    return d;
  }
  function m(a, b) {
    var c = (a & 0xffff) + (b & 0xffff), d = (a >> 16) + (b >> 16) + (c >> 16);
    return (d << 16) | (c & 0xffff);
  }
  function g(a, b, c, d, x, s, t) { return m(l(m(m(a, b ^ c ^ d), m(x, t)), s), b); }
  function n(a, b, c, d, x, s, t) { return m(l(m(m(a, (b & c) | (~b & d)), m(x, t)), s), b); }
  function o(a, b, c, d, x, s, t) { return m(l(m(m(a, (b & d) | (c & ~d)), m(x, t)), s), b); }
  function p(a, b, c, d, x, s, t) { return m(l(m(m(a, c ^ (b | ~d)), m(x, t)), s), b); }
  var x = [], a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476, i, j, s = "";
  for (i = 0; i < string.length; i++) x[i >> 2] |= string.charCodeAt(i) << ((i % 4) * 8);
  x[string.length >> 2] |= 0x80 << ((string.length % 4) * 8);
  x[(((string.length + 8) >> 6) << 4) + 14] = string.length * 8;
  for (i = 0; i < x.length; i += 16) {
    var aa = a, bb = b, cc = c, dd = d;
    a = n(a, b, c, d, x[i + 0], 7, 0xD76AA478); d = n(d, a, b, c, x[i + 1], 12, 0xE8C7B756); c = n(c, d, a, b, x[i + 2], 17, 0x242070DB); b = n(b, c, d, a, x[i + 3], 22, 0xC1BDCEEE);
    a = n(a, b, c, d, x[i + 4], 7, 0xF57C0FAF); d = n(d, a, b, c, x[i + 5], 12, 0x4787C62A); c = n(c, d, a, b, x[i + 6], 17, 0xA8304613); b = n(b, c, d, a, x[i + 7], 22, 0xFD469501);
    a = o(a, b, c, d, x[i + 1], 5, 0xF61E2562); d = o(d, a, b, c, x[i + 6], 9, 0xC040B340); c = o(c, d, a, b, x[i + 11], 14, 0x265E5A51); b = o(b, c, d, a, x[i + 0], 20, 0xE9B6C7AA);
    a = o(a, b, c, d, x[i + 5], 5, 0xD62F105D); d = o(d, a, b, c, x[i + 10], 9, 0x02441453); c = o(c, d, a, b, x[i + 15], 14, 0xD8A1E681); b = o(b, c, d, a, x[i + 4], 20, 0xE7D3FBC8);
    a = g(a, b, c, d, x[i + 5], 4, 0xFFFA3942); d = g(d, a, b, c, x[i + 8], 11, 0x8771F681); c = g(c, d, a, b, x[i + 11], 16, 0x6D9D6122); b = g(b, c, d, a, x[i + 14], 23, 0xFDE5380C);
    a = g(a, b, c, d, x[i + 1], 4, 0xA4BEEA44); d = g(d, a, b, c, x[i + 4], 11, 0x4BDECFA9); c = g(c, d, a, b, x[i + 7], 16, 0xF6BB4B60); b = g(b, c, d, a, x[i + 10], 23, 0xBEBFBC70);
    a = p(a, b, c, d, x[i + 0], 6, 0xF4292244); d = p(d, a, b, c, x[i + 7], 10, 0x432AFF97); c = p(c, d, a, b, x[i + 14], 15, 0xAB9423A7); b = p(b, c, d, a, x[i + 5], 21, 0xFC93A039);
    a = p(a, b, c, d, x[i + 12], 6, 0x655B59C3); d = p(d, a, b, c, x[i + 3], 10, 0x8F0CCC92); c = p(c, d, a, b, x[i + 10], 15, 0xFFEFF47D); b = p(b, c, d, a, x[i + 1], 21, 0x85845DD1);
    a = m(a, aa); b = m(b, bb); c = m(c, cc); d = m(d, dd);
  }
  var h = "0123456789abcdef";
  for (i = 0; i < 4; i++) {
    var v = [a, b, c, d][i];
    for (j = 0; j < 4; j++) s += h.charAt((v >> (j * 8 + 4)) & 0x0F) + h.charAt((v >> (j * 8)) & 0x0F);
  }
  return s;
}

function Env(n) {
  this.getdata = k => (typeof $prefs !== 'undefined' ? $prefs.valueForKey(k) : $persistentStore.read(k));
  this.setdata = (v, k) => (typeof $prefs !== 'undefined' ? $prefs.setValueForKey(v, k) : $persistentStore.write(v, k));
  this.notify = (t, s, m) => (typeof $notify !== 'undefined' ? $notify(t, s, m) : $notification.post(t, s, m));
  this.get = o => (typeof $task !== 'undefined' ? $task.fetch(o) : new Promise(r => $httpClient.get(o, (e, res, b) => r({ ...res, body: b }))));
  this.wait = ms => new Promise(r => setTimeout(r, ms));
  this.done = o => (typeof $done !== 'undefined' ? $done(o) : null);
}

main();
