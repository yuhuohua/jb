// 脚本说明：塔斯汀汉堡 获取 Token 脚本
// 兼容环境：Surge / Quantumult X / Loon

const isQuanX = typeof $task !== "undefined";
const isSurgeOrLoon = typeof $httpClient !== "undefined";

// ---------------- 兼容层封装 ----------------
function getStore(key) {
    if (isQuanX) return $prefs.valueForKey(key);
    if (isSurgeOrLoon) return $persistentStore.read(key);
    return null;
}

function setStore(val, key) {
    if (isQuanX) return $prefs.setValueForKey(val, key);
    if (isSurgeOrLoon) return $persistentStore.write(val, key);
}

function notify(title, subtitle, message) {
    if (isQuanX) $notify(title, subtitle, message);
    if (isSurgeOrLoon) $notification.post(title, subtitle, message);
    console.log(`${title}\n${subtitle}\n${message}`);
}

function apiGet(url, headers) {
    return new Promise((resolve) => {
        if (isQuanX) {
            $task.fetch({ url: url, method: "GET", headers: headers }).then(res => {
                resolve({ error: null, data: res.body });
            }, err => resolve({ error: err, data: null }));
        } else if (isSurgeOrLoon) {
            $httpClient.get({ url: url, headers: headers }, (err, resp, data) => {
                resolve({ error: err, data: data });
            });
        }
    });
}

// ---------------- 主逻辑 ----------------
!(async () => {
    if (typeof $request === "undefined") {
        $done({});
        return;
    }

    let req = $request;
    let headers = {};
    for (let key in req.headers) {
        headers[key.toLowerCase()] = req.headers[key];
    }

    let token = headers['user-token'];

    if (token) {
        let oldTokens = getStore("tastien_token") || "";
        let tokenArr = oldTokens ? oldTokens.split("@") : [];

        if (tokenArr.includes(token)) {
            $done({});
        } else {
            tokenArr.push(token);
            setStore(tokenArr.join("@"), "tastien_token");

            const version = headers['version'] || "3.89.0";
            const reqHeaders = {
                'user-token': token,
                'version': version,
                'channel': '1',
                'Content-Type': 'application/json'
            };

            let response = await apiGet("https://sss-web.tastientech.com/api/intelligence/member/getMemberDetail", reqHeaders);
            
            let phoneStr = "未知账号";
            if (!response.error && response.data) {
                try {
                    let res = JSON.parse(response.data);
                    if (res.code === 200 && res.result && res.result.phone) {
                        let p = res.result.phone;
                        phoneStr = p.length === 11 ? p.substring(0, 3) + "****" + p.substring(7) : p;
                    }
                } catch (e) {
                    console.log("解析手机号异常: " + e);
                }
            }
            
            notify(
                "🍔 塔斯汀汉堡", 
                `新增账号: ${phoneStr}`, 
                `获取 Token 成功！当前共保存了 ${tokenArr.length} 个账号，可正常执行签到。`
            );
            $done({});
        }
    } else {
        $done({});
    }
})().catch(e => {
    console.log("获取 Token 脚本执行异常: " + e);
    $done({});
});
