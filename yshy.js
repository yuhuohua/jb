const scriptName = "仰韶会员";
let message = "";

if (typeof $request !== "undefined") {

    let headers = $request.headers;
    let token = headers['Authorization'] || headers['authorization'];
    
    if (token && token.indexOf('eyJ') !== -1) {
        let savedData = $persistentStore.read("yshy_data") || "";
        let tokens = savedData.split(/@|\n/).filter(Boolean);
        
        if (!tokens.includes(token)) {
            tokens.push(token);
            $persistentStore.write(tokens.join("@"), "yshy_data");
            $notification.post(
                `🍶 ${scriptName}`, 
                "✅ 获取 Token 成功", 
                `已成功保存数据，当前共 ${tokens.length} 个账号。\nToken: ${token.substring(0, 20)}...`
            );
        }
    }
    $done({});
} else {
    !(async () => {
        let savedData = $persistentStore.read("yshy_data") || "";
        let accounts = savedData.split(/@|\n/).filter(Boolean);

        if (accounts.length === 0) {
            console.log("未检测到仰韶账号数据，请先进入小程序获取。");
            $notification.post(`🍶 ${scriptName}`, "❌ 参数缺失", "请先打开仰韶会员俱乐部小程序获取凭证");
            return;
        }

        console.log(`\n========= 开始执行仰韶签到，共 ${accounts.length} 个账号 =========\n`);

        for (let i = 0; i < accounts.length; i++) {
            let token = accounts[i].trim();
            console.log(`\n--- 账号 [${i + 1}] 开始 ---`);
            await runTask(token, i + 1);
            await sleep(2000); 
        }

        if (message) {
            $notification.post(`🍶 ${scriptName} 每日任务`, "", message.trim());
        }
    })()
    .catch(e => console.log(e))
    .finally(() => $done());
}

async function runTask(token, index) {
    let accMsg = `账号${index}`;
    
    let d = new Date();
    let year = d.getFullYear();
    let month = (d.getMonth() + 1).toString().padStart(2, '0');
    let day = d.getDate().toString().padStart(2, '0');
    let signTime = `${year}-${month}-${day}`;

    const baseHeaders = {
        "Host": "hy.51pt.top",
        "Connection": "keep-alive",
        "Authorization": token,
        "Content-Type": "application/json",
        "Accept-Encoding": "gzip,compress,br,deflate",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.79(0x18004f2d) NetType/WIFI Language/zh_CN",
        "Referer": "https://servicewechat.com/wx5ed5e20c00e05ba9/209/page-frame.html"
    };

    let signOpt = {
        url: "https://hy.51pt.top/app/ys/signIn/save",
        headers: baseHeaders,
        body: JSON.stringify({ 
            "appId": "wx5ed5e20c00e05ba9",
            "signTime": signTime
        })
    };

    try {
        let signRes = await apiPost(signOpt);
        if (signRes && signRes.code == 200) {
            console.log(`✅ ${accMsg} 签到: ${signRes.data || '成功'}`);
            message += `🍶 ${accMsg}: ${signRes.data || '签到成功 🎉'}\n`;
        } else {
            let errInfo = "请求无返回数据";
            if (signRes) {
                errInfo = signRes.msg || signRes.message || signRes.data || JSON.stringify(signRes);
            }
            
            if (typeof errInfo === 'string' && (errInfo.includes("已签") || errInfo.includes("上限") || errInfo.includes("签到失败"))) {
                console.log(`✅ ${accMsg} 签到: 今日已签到`);
                message += `🍶 ${accMsg}: 今日已签到\n`;
            } else {
                console.log(`⚠️ ${accMsg} 签到异常: ${errInfo}`);
                message += `⚠️ ${accMsg}: 签到异常 (${errInfo})\n`;
            }
        }
    } catch (e) {
        console.log(`❌ 账号[${index}]签到请求异常: ${e}`);
    }

    await sleep(1500);

    let scoreOpt = {
        url: "https://hy.51pt.top/app/ys/convert/getMemberScore",
        headers: baseHeaders
    };

    try {
        let scoreRes = await apiGet(scoreOpt);
        if (scoreRes && scoreRes.code == 200) {
            console.log(`✅ ${accMsg} 积分: 当前积分 ${scoreRes.data}`);
            message += `💰 积分余额: ${scoreRes.data}\n\n`;
        } else {
            let errInfo = scoreRes ? (scoreRes.msg || JSON.stringify(scoreRes)) : "无返回数据";
            console.log(`❌ ${accMsg} 积分查询失败: ${errInfo}`);
            message += `❌ 积分查询失败 (${errInfo})\n\n`;
        }
    } catch (e) {
        console.log(`❌ 账号[${index}]积分查询异常: ${e}`);
    }
}

function apiPost(options) {
    return new Promise((resolve) => {
        $httpClient.post(options, (err, resp, data) => {
            if (err) resolve(null);
            else {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            }
        });
    });
}

function apiGet(options) {
    return new Promise((resolve) => {
        $httpClient.get(options, (err, resp, data) => {
            if (err) resolve(null);
            else {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            }
        });
    });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
