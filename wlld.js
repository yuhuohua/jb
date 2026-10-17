/**
【 OX 脚本配置】
[rewrite_local]
^http://netradar\.qx\.api url script-request-header https://raw.githubusercontent.com/yuhuohua/jb/refs/heads/main/wlld.js

[mitm]
hostname = netradar.qx.api
 */

const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;
const isQX = typeof $task !== "undefined";

const TIMEOUT = 3500;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

// --- 三端 API 适配器 ---
function adapter() {
  // 1. 获取本地网络信息
  const getNetwork = () => {
    let info = { internalIP: "未知", gatewayIP: "未知", wifiSsid: null };
    if (typeof $network !== "undefined") { // Surge & Loon
      if ($network.v4) {
        info.internalIP = $network.v4.primaryAddress || "未知";
        info.gatewayIP = $network.v4.primaryRouter || "未知";
      }
      if ($network.wifi) info.wifiSsid =$network.wifi.ssid;
    }
    // 注：QX 脚本内无法直接读取局域网 IP 和 SSID，将显示为“未知”或交由前端处理
    return info;
  };

  // 2. 发起网络请求
  const get = (opts) => {
    return new Promise((resolve, reject) => {
      if (isQX) {
        if (typeof opts === "string") opts = { url: opts };
        opts.method = "GET";
        opts.timeout = TIMEOUT; // QX 是毫秒
        $task.fetch(opts).then(
          (resp) => resolve({ status: resp.statusCode, body: resp.body }),
          (err) => reject(err.error)
        );
      } else {
        let reqOpts = typeof opts === "string" ? { url: opts } : opts;
        reqOpts.timeout = TIMEOUT / 1000; // Surge/Loon 是秒
        if (isLoon && reqOpts.policy) reqOpts.node = reqOpts.policy; // Loon 策略键名为 node
        $httpClient.get(reqOpts, (error, response, body) => {
          if (error) reject(error);
          else resolve({ status: response.status, body: body });
        });
      }
    });
  };

  // 3. 终结请求并返回 Mock 响应
  const done = (result) => {
    let resp = { status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
    if (isQX) resp.status = "HTTP/1.1 200 OK"; // QX 需完整的 HTTP 状态码头
    $done({ response: resp });
  };

  return { getNetwork, get, done };
}

const $ = adapter();

// --- 核心测试逻辑 ---
const httpGet = (url, policy) => {
  return new Promise((resolve) => {
    let opts = { url, headers: HEADERS };
    if (policy) opts.policy = policy; 
    let start = Date.now();
    
    $.get(opts).then((resp) => {
      let time = Date.now() - start;
      try {
        resolve({ 
          data: JSON.parse(resp.body), 
          ping: time, 
          code: (resp.status == 200 || resp.status == 204) ? 'OK' : 'ERR',
          ms: time,
          status: resp.status
        });
      } catch(e) {
        resolve({ data: resp.body, ping: time, code: 'OK', ms: time, status: resp.status });
      }
    }).catch((err) => {
      resolve({ data: {}, ping: 0, code: 'ERR', ms: 0, status: 0 });
    });
  });
};

const checkStatus = (url, expectedStatus = [200]) => {
  return new Promise((resolve) => {
    let start = Date.now();
    $.get({ url, headers: HEADERS }).then((resp) => {
      resolve({ code: expectedStatus.includes(resp.status) ? 'OK' : 'ERR', ms: Date.now() - start });
    }).catch((err) => {
      resolve({ code: 'ERR', ms: 0 });
    });
  });
};

(async () => {
  try {
    const netInfo = $.getNetwork();
    
    // 并发请求获取 IP 信息和流媒体/AI解锁状态
    const [
      localResp, nodeResp, pureResp, ipv6Resp,
      yt, nf, dp, sp, gpt, cl, gm, gk
    ] = await Promise.all([
      httpGet('https://myip.ipip.net/json', 'DIRECT'),
      httpGet(`http://ip-api.com/json/?lang=zh-CN&_t=${Date.now()}`),
      httpGet('https://my.ippure.com/v1/info'),
      httpGet('https://api64.ipify.org?format=json'),
      checkStatus('https://www.youtube.com/generate_204', [204]),
      checkStatus('https://www.netflix.com/generate_204', [204, 200]),
      checkStatus('https://www.disneyplus.com/', [200, 301, 302]),
      checkStatus('https://open.spotify.com/', [200]),
      checkStatus('https://chatgpt.com/', [200, 302, 401, 404]),
      checkStatus('https://api.anthropic.com/', [401, 404, 200]),
      checkStatus('https://generativelanguage.googleapis.com/v1beta/models', [200, 403]),
      checkStatus('https://grok.com/', [200])
    ]);

    const result = {
      device: {
        internalIP: netInfo.internalIP,
        gatewayIP: netInfo.gatewayIP,
        wifiSsid: netInfo.wifiSsid,
      },
      local: localResp,
      node: nodeResp,
      pure: pureResp.data,
      ipv6: ipv6Resp.data,
      unlocks: { yt, nf, dp, sp, gpt, cl, gm, gk }
    };

    $.done(result);

  } catch (err) {
    let resp = { status: 500, body: JSON.stringify({ error: err.message }) };
    if (isQX) resp.status = "HTTP/1.1 500 Internal Server Error";
    $done({ response: resp });
  }
})();
