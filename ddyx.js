const TITLE = "铛铛一下";
const STORE_KEY = "dd1x_tokens";
const LOCK_KEY = "dd1x_grab_lock"; 

!(async () => {
    if (typeof $request !== "undefined") {
        let headers = $request.headers || {};
        let token = headers['token'] || headers['Token'] || "";

        if (token && token !== "null" && token.length > 10) {
            await sleep(Math.floor(Math.random() * 1000));

            let lastGrabTime = parseInt($persistentStore.read(LOCK_KEY) || "0");
            let nowTime = Date.now();
            
            if (nowTime - lastGrabTime < 5000) {
                console.log("拦截到并发请求，处于 5 秒冷却期内，静默跳过");
                return;
            }

            let oldData = $persistentStore.read(STORE_KEY);
            let tokenArr = oldData ? oldData.split('\n').filter(t => t) : [];

            if (!tokenArr.includes(token)) {
                tokenArr.push(token);
                $persistentStore.write(tokenArr.join('\n'), STORE_KEY);
                $persistentStore.write(Date.now().toString(), LOCK_KEY);
                
                $notification.post(TITLE, "🎉 成功抓取 Token", `已保存第 ${tokenArr.length} 个账号\n相同账号已拦截并发，不再重复弹窗。`);
                console.log(`✅ Token 新增成功: ${token.substring(0, 15)}...`);
            } else {
                console.log("✅ Token 已存在，静默跳过");
            }
        }
    } 
    else {
        console.log(`==== 开始执行 ${TITLE} 任务 ====`);
        let tokenData = $persistentStore.read(STORE_KEY);
        if (!tokenData) {
            $notification.post(TITLE, "❌ 执行失败", "未找到 Token，请先去微信小程序抓包提取！");
            return;
        }

        let tokenArr = tokenData.split('\n').filter(t => t);
        console.log(`共检测到 ${tokenArr.length} 个账号，开始执行任务...`);
        
        let allSummary = [];

        for (let i = 0; i < tokenArr.length; i++) {
            console.log(`\n--- 正在执行账号 [${i + 1}] ---`);
            let resultMsg = await runAccount(tokenArr[i], i + 1);
            allSummary.push(resultMsg);
            if (i < tokenArr.length - 1) await sleep(3000);
        }
        
        console.log(`\n==== ${TITLE} 全部任务执行结束 ====`);
        $notification.post(TITLE, `✅ 任务执行完毕 (共 ${tokenArr.length} 个账号)`, allSummary.join('\n\n'));
    }
})().catch(err => {
    console.log("❌ 脚本执行发生严重错误: " + err);
}).finally(() => {
    $done({});
});

async function runAccount(tokenStr, index) {
    let token = tokenStr.split('#')[0]; 
    let remark = tokenStr.split('#')[1] || `账号[${index}]`;
    
    const baseUrl = 'https://vues.dd1x.cn';
    const channelId = "154";
    const headers = {
        "token": token,
        "content-type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541923) XWEB/19823",
        "Referer": "https://servicewechat.com/wxe378d2d7636c180e/824/page-frame.html"
    };

    let summary = [];

    try {
        let signRes = await request("GET", `${baseUrl}/api/v2/sign_join`, headers);
        if (signRes && signRes.code === 0) {
            summary.push(`📝 签到: ${signRes.data?.name || "成功"}`);
            console.log(`[${remark}] ✅ 签到成功`);
        } else {
            summary.push(`📝 签到: ${signRes?.msg || signRes?.message || "失败或已签到"}`);
        }
        await sleep(1500);

        let lotteryInfo = await request("GET", `${baseUrl}/front/activity/get_lottery_info?id=13&channelId=${channelId}`, headers);
        let drawChances = parseInt(lotteryInfo?.data?.member_count || 0);
        
        let prizeList = [];
        for (let j = 0; j < drawChances; j++) {
            await sleep(2000 + Math.random() * 1000); 
            let drawRes = await request("GET", `${baseUrl}/front/activity/get_lottery_result?id=13`, headers);
            if (drawRes && drawRes.code === 0) {
                let prizeName = drawRes.data?.prizeName || drawRes.data?.goodName || "未知奖品";
                prizeList.push(prizeName);
            }
        }
        summary.push(`🎰 抽奖: ${prizeList.length > 0 ? prizeList.join("、") : "0次机会"}`);

        let accountRes = await request("GET", `${baseUrl}/api/h/get_account_detailed`, headers);
        let totalMoneyRaw = accountRes?.data?.total || 0;
        let totalMoney = parseFloat(totalMoneyRaw);
        summary.push(`💰 余额: ${totalMoney.toFixed(2)} 元`);

        if (totalMoney >= 0.3) {
            let tradeListRes = await request("GET", `${baseUrl}/api/h/get_withdrawal_trade_list`, headers);
            let tradeList = tradeListRes?.data || [];
            
            let availableTrades = [];
            if (Array.isArray(tradeList)) {
                availableTrades = tradeList.filter(item => item.disabled !== true && parseFloat(item.money || 0) > 0);
            } else if (tradeList.list && Array.isArray(tradeList.list)) {
                availableTrades = tradeList.list.filter(item => item.disabled !== true && parseFloat(item.money || 0) > 0);
            }

            if (availableTrades.length > 0) {
                let payload = JSON.stringify({
                    "totalMoney": totalMoney.toFixed(2),
                    "type": 1,
                    "withdrawalDetailPojoList": availableTrades
                });
                let withdrawRes = await request("POST", `${baseUrl}/api/h/withdrawal`, headers, payload);
                summary.push(`💸 提现: ${withdrawRes?.msg || withdrawRes?.message || "发起请求"}`);
            } else {
                summary.push(`💸 提现: 无可用单`);
            }
        } else {
            summary.push(`💸 提现: 未满0.3`);
        }

    } catch (e) {
        summary.push(`❌ 异常: ${e.message || e}`);
    }

    return `【${remark}】\n${summary.join('\n')}`;
}

function request(method, url, headers, body = null) {
    return new Promise((resolve) => {
        let options = { url: url, headers: headers };
        if (body) options.body = body;

        let callback = (error, response, data) => {
            if (error) resolve(null);
            else {
                try { resolve(data ? JSON.parse(data) : null); } 
                catch (e) { resolve(data); }
            }
        };

        if (method === "POST") $httpClient.post(options, callback);
        else $httpClient.get(options, callback);
    });
}

function sleep(ms) { 
    return new Promise(resolve => setTimeout(resolve, ms)); 
}
