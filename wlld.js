const TIMEOUT = 3500;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

const httpGet = (url, policy) => {
  return new Promise((resolve) => {
    let opts = { url, headers: HEADERS, timeout: TIMEOUT / 1000 };
    if (policy) opts.policy = policy; 
    let start = Date.now();
    
    $httpClient.get(opts, (error, response, data) => {
      if (error) {
        resolve({ data: {}, ping: 0, code: 'ERR', ms: 0, status: 0 });
      } else {
        try {
          resolve({ 
            data: JSON.parse(data), 
            ping: Date.now() - start, 
            code: (response.status == 200 || response.status == 204) ? 'OK' : 'ERR',
            ms: Date.now() - start,
            status: response.status
          });
        } catch(e) {
          resolve({ data: data, ping: Date.now() - start, code: 'OK', ms: Date.now() - start, status: response.status });
        }
      }
    });
  });
};

const checkStatus = (url, expectedStatus = [200]) => {
  return new Promise((resolve) => {
    let start = Date.now();
    $httpClient.get({ url, headers: HEADERS, timeout: TIMEOUT / 1000 }, (err, resp) => {
      if (err) resolve({ code: 'ERR', ms: 0 });
      else resolve({ code: expectedStatus.includes(resp.status) ? 'OK' : 'ERR', ms: Date.now() - start });
    });
  });
};

(async () => {
  try {
    const v4 = $network.v4 || {};
    const wifi = $network.wifi || {};
    

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
        internalIP: v4.primaryAddress,
        gatewayIP: v4.primaryRouter,
        wifiSsid: wifi.ssid,
      },
      local: localResp,
      node: nodeResp,
      pure: pureResp.data,
      ipv6: ipv6Resp.data,
      unlocks: { yt, nf, dp, sp, gpt, cl, gm, gk }
    };

    $done({
      response: {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result)
      }
    });

  } catch (err) {
    $done({ response: { status: 500, body: JSON.stringify({ error: err.message }) } });
  }
})();
