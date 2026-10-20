let req = $request;
let url = req.url;
let headers = {};

for (let key in req.headers) {
    headers[key.toLowerCase()] = req.headers[key];
}

let extraData = headers['extra-data'];

if (extraData) {
    let tokenMatch = url.match(/access_token=([^&]+)/);
    let accessToken = tokenMatch ? tokenMatch[1] : "";

    try {
        let extraObj = JSON.parse(extraData);
        let sid = extraObj.sid;

        if (sid && accessToken) {
            let savedData = $persistentStore.read("szss_accounts");
            let accounts = savedData ? JSON.parse(savedData) : [];

            let existingIndex = accounts.findIndex(acc => {
                try {
                    return JSON.parse(acc.extraData).sid === sid;
                } catch(e) { return false; }
            });

            if (existingIndex !== -1) {
                accounts[existingIndex].extraData = extraData;
                accounts[existingIndex].accessToken = accessToken;
                $persistentStore.write(JSON.stringify(accounts), "szss_accounts");
            } else {
                accounts.push({ extraData: extraData, accessToken: accessToken });
                $persistentStore.write(JSON.stringify(accounts), "szss_accounts");
                
                let phoneStr = sid.substring(0, 5) + "****" + sid.substring(sid.length - 4);
                $notification.post(
                    "🐿️ 三只松鼠", 
                    "获取凭证成功", 
                    `新增账号: ${phoneStr}\n当前共保存了 ${accounts.length} 个账号凭证。`
                );
            }
        }
    } catch (e) {}
}

$done({});
