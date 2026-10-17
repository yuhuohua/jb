/**
【 OX 脚本配置】
[rewrite_local]
^http://netradar\.qx\.api url script-request-header https://raw.githubusercontent.com/yuhuohua/jb/refs/heads/main/wlld.js

[mitm]
hostname = netradar.qx.api
 * NetRadar 后端数据提供端 (调试打印版)
 * 加入了详细的日志输出，方便在 Loon/Surge/QX 中排查网络请求失败原因
 */

const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;
const isQX = typeof $task !== "undefined";

console.log("========== NetRadar 后端脚本开始执行 ==========");
console.log(`[环境信息] 客户端: ${isLoon ? "Loon" : isSurge ? "Surge" : isQX ? "Quantumult X" : "Unknown"}`);

// --- 三端 API 适配器 ---
function adapter() {
  const getNetwork = () => {
    let info = { internalIP: "未知", gatewayIP: "未知", wifiSsid: null };
    if (typeof $network !== "undefined" && $network.v4) { 
      info.internalIP = $network.v4.primaryAddress || "未知";
      info.gatewayIP = $network.v4.primaryRouter || "未知";
      if ($network.wifi) info.wifiSsid =$network.wifi.ssid;
    }
    console.log(`[网络环境] IP: ${info.internalIP}, Gateway: ${info.gatewayIP}, SSID: ${info.wifiSsid}`);
    return info;
  };

  const get = (opts) => {
    return new Promise((resolve) => {
      let reqOpts = {
        url: opts.url,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        timeout: isQX ? 5000 : 5 // QX 毫秒，Loon/Surge 秒
      };
      
      console.log(`[发起请求] -> URL: ${opts.url} | 策略: ${opts.policy || "默认"}`);

      if (isQX) {
        reqOpts.method = "GET";
        $task.fetch(reqOpts).then(
          (resp) => {
            console.log(`[请求成功] <- URL: ${opts.url} | 状态码: ${resp.statusCode}`);
            resolve({ status: resp.statusCode, body: resp.body });
          },
          (err) => {
            console.log(`[请求失败] <- URL: ${opts.url} | 错误信息: ${JSON.stringify(err.error)}`);
            resolve({ status: 0, error: err.error });
          }
        );
      } else {
        if (opts.policy) {
          if (isLoon) reqOpts.node = opts.policy; 
          else reqOpts.policy = opts.policy;      
        }
        $httpClient.get(reqOpts, (error, response, body) => {
          if (error) {
            console.log(`[请求报错] <- URL: ${opts.url} | 错误信息: ${error}`);
            resolve({ status: 0, error: error });
          } else {
            console.log(`[请求成功] <- URL: ${opts.url} | 状态码: ${response.status}`);
            resolve({ status: response.status, body: body });
          }
        });
      }
    });
  };

  const done = (result) => {
    console.log("========== NetRadar 后端脚本执行完毕 ==========");
    let resp = { status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(result) };
    if (isQX) resp.status = "HTTP/1.1 200 OK"; 
    $done({ response: resp });
  };

  return { getNetwork, get, done };
}

const $ = adapter();

// --- 核心测试逻辑 ---
const httpGet = async (url, policy) => {
  let start = Date.now();
  let resp = await $.get({ url, policy });
  let ms = Date.now() - start;
  
  if (resp.error || !resp.status) {
    return { data: {}, ping: 0, code: 'ERR', ms: 0, status: 0 };
  }
  
  let code = (resp.status == 200 || resp.status == 204) ? 'OK' : 'ERR';
  try {
    return { data: JSON.parse(resp.body), ping: ms, code, ms, status: resp.status };
  } catch(e) {
    return { data: resp.body, ping: ms, code: 'OK', ms, status: resp.status };
  }
};

const checkStatus = async (url, expectedStatus = [200]) => {
  let start = Date.now();
  let resp = await $.get({ url });
  let ms = Date.now() - start;
  
  if (resp.error || !resp.status) {
    return { code: 'ERR', ms: 0 };
  }
  return { code: expectedStatus.includes(resp.status) ? 'OK' : 'ERR', ms };
};

(async () => {
  try {
    const netInfo = $.getNetwork();
    
    // 并发请求
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
      pure: pureResp?.data || {},
      ipv6: ipv6Resp?.data || {},
      unlocks: { yt, nf, dp, sp, gpt, cl, gm, gk }
    };

    $.done(result);

  } catch (err) {
    console.log(`[致命错误] 脚本崩溃: ${err.message || String(err)}`);
    let resp = { status: 500, body: JSON.stringify({ error: err.message || String(err) }) };
    if (isQX) resp.status = "HTTP/1.1 500 Internal Server Error";
    $done({ response: resp });
  }
})();
