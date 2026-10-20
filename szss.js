const kdtId = "41433171"; 
const appId = "wx12530dfd1c7709a6";
const checkinId = "9332"; 

let message = "";

!(async () => {
    let savedData = $persistentStore.read("szss_accounts");
    let accounts = [];
    if (savedData) {
        try { accounts = JSON.parse(savedData); } catch(e) {}
    }

    if (accounts.length === 0) {
        console.log("未检测到三只松鼠账号数据，请先进入小程序获取。");
        $notification.post("🐿️ 三只松鼠", "参数缺失", "请先打开小程序会员中心获取凭证");
        return;
    }

    console.log(`\n=========开始执行三只松鼠签到，共 ${accounts.length} 个账号=========\n`);

    for (let i = 0; i < accounts.length; i++) {
        console.log(`\n--- 账号 [${i + 1}] 开始 ---`);
        await runTask(accounts[i], i + 1);
        await sleep(2000); 
    }

    if (message) {
        $notification.post("🐿️ 三只松鼠签到", "", message.trim());
    }
})()
.catch(e => console.log(e))
.finally(() => $done());

async function runTask(account, index) {
    let phoneStr = `账号${index}`;
    try {
        let sid = JSON.parse(account.extraData).sid;
        if (sid) phoneStr = sid.substring(0, 5) + "****" + sid.substring(sid.length - 4);
    } catch (e) {}

    const headers = {
        'Host': 'h5.youzan.com',
        'content-type': 'application/json',
        'extra-data': account.extraData,
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.79(0x18004f2d) NetType/4G Language/zh_CN'
    };

    let signUrl = `https://h5.youzan.com/wscump/checkin/checkinV2.json?checkinId=${checkinId}&app_id=${appId}&kdt_id=${kdtId}`;
    if (account.accessToken) {
        signUrl += `&access_token=${account.accessToken}`;
    }

    try {
        let signRes = await apiGet(signUrl, headers);
        
        if (signRes && signRes.code === 0) {
            let rewardStr = "签到成功";
            if (signRes.data && signRes.data.list && signRes.data.list.length > 0) {
                rewardStr = `获得 ${signRes.data.list[0].infos.title}`; 
            } else if (signRes.data && signRes.data.desc) {
                rewardStr = signRes.data.desc;
            }
            console.log(`✅ ${phoneStr}: ${rewardStr}`);
            message += `🐿️ ${phoneStr}: ${rewardStr}\n`;
        } else {
            let msg = signRes ? signRes.msg : "请求失败无返回";
            if (msg.includes("已达最大参与次数") || msg.includes("已经签到")) {
                console.log(`✅ ${phoneStr}: 今日已签到`);
                message += `🐿️ ${phoneStr}: 今日已签到\n`;
            } else {
                console.log(`⚠️ ${phoneStr}: ${msg}`);
                message += `⚠️ ${phoneStr}: ${msg}\n`;
            }
        }
    } catch (e) {
        console.log(`❌ 账号[${index}]请求异常: ${e}`);
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function apiGet(url, headers) {
    return new Promise((resolve) => {
        $httpClient.get({ url, headers }, (err, resp, data) => {
            if (err) resolve(null);
            else {
                try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
            }
        });
    });
}
