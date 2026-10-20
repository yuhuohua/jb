let req = $request;
let headers = {};
for (let key in req.headers) {
    headers[key.toLowerCase()] = req.headers[key];
}

let token = headers['user-token'];

if (token) {
    let oldTokens = $persistentStore.read("tastien_token") || "";
    let tokenArr = oldTokens ? oldTokens.split("@") : [];

    if (tokenArr.includes(token)) {
        $done({});
    } else {
        tokenArr.push(token);
        $persistentStore.write(tokenArr.join("@"), "tastien_token");

        const version = headers['version'] || "3.89.0";
        const reqHeaders = {
            'user-token': token,
            'version': version,
            'channel': '1',
            'Content-Type': 'application/json'
        };

        $httpClient.get({
            url: "https://sss-web.tastientech.com/api/intelligence/member/getMemberDetail",
            headers: reqHeaders
        }, function(error, response, data) {
            let phoneStr = "未知账号";
            if (!error && data) {
                try {
                    let res = JSON.parse(data);
                    if (res.code === 200 && res.result && res.result.phone) {
                        let p = res.result.phone;
                        phoneStr = p.length === 11 ? p.substring(0, 3) + "****" + p.substring(7) : p;
                    }
                } catch (e) {}
            }
            
            $notification.post(
                "🍔 塔斯汀汉堡", 
                `新增账号: ${phoneStr}`, 
                `获取 Token 成功！当前共保存了 ${tokenArr.length} 个账号，可正常执行签到。`
            );
            $done({});
        });
    }
} else {
    $done({});
}
