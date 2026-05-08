// Surge Loon 双端完美兼容 69云签到 修复版
const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1";
const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";

let isSilent = false;
let accounts = [];

function parseParams() {
    let arg = "";
    if (typeof $argument !== "undefined" && $argument) {
        arg = String($argument);
    }

    // 清除Loon自带[]符号、多余空格
    arg = arg.replace(/[\[\]]/g, "").trim();

    // 识别静默开关
    if (arg.includes("silent=#") || arg.endsWith("#")) {
        isSilent = true;
    }

    // 剔除静默参数，只保留账号部分
    let accStr = arg.replace(/&?silent=#/g, "").trim();
    if (!accStr) return;

    // 按 # 分割多账号，空账号自动过滤
    let list = accStr.split("#").filter(item => {
        item = item.trim();
        return item && item.includes(":") && item.includes("@");
    });

    list.forEach(item => {
        let [email, pwd] = item.split(":").map(s => s.trim());
        if (email && pwd) {
            accounts.push({email, password: pwd});
        }
    });
}

parseParams();

if (accounts.length === 0) {
    console.log("⚠️ 未检测到有效账号，脚本结束");
    $done?.();
    return;
}

async function main() {
    console.log(`🚀 开始执行 69云多账号签到 | 共 ${accounts.length} 个账号`);
    
    for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        const maskedEmail = maskEmail(acc.email);
        console.log(`\n🔹 [${i + 1}/${accounts.length}] 账号: ${maskedEmail}`);
        
        try {
            const loginRes = await performLogin(acc.email, acc.password);
            const checkinRes = await performCheckin(loginRes.cookie);
            handleResult(checkinRes, acc.email);
        } catch (err) {
            console.log(`❌ 失败: ${err.message}`);
            if (!isSilent) $notification?.post("69云签到失败 ❌", maskedEmail, err.message);
        }
        
        if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log("\n✅ 所有任务处理完毕");
    $done?.();
}

function performLogin(email, password) {
    const body = `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&code=`;
    return new Promise((resolve, reject) => {
        $httpClient.post({
            url: loginUrl,
            header: {
                "User-Agent": userAgent,
                "Origin": "https://69yun69.com",
                "Referer": loginUrl,
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9"
            },
            body: body
        }, (error, response, data) => {
            if (error) return reject(new Error(error));
            if (response.status !== 200) return reject(new Error(`状态码: ${response.status}`));
            try {
                const res = JSON.parse(data);
                if (res.ret !== 1) return reject(new Error(res.msg || "登录失败"));
                const cookie = response.headers['Set-Cookie'] || response.headers['set-cookie'] || '';
                resolve({ cookie, data: res });
            } catch (e) {
                reject(new Error("登录响应解析失败"));
            }
        });
    });
}

function performCheckin(cookie) {
    return new Promise((resolve, reject) => {
        $httpClient.post({
            url: checkinUrl,
            header: {
                "User-Agent": userAgent,
                "Origin": "https://69yun69.com",
                "Referer": "https://69yun69.com/user",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                "Content-Length": "0"
            }
        }, (error, response, data) => {
            if (error) return reject(new Error(error));
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(new Error("签到响应解析失败"));
            }
        });
    });
}

function handleResult(result, email) {
    const masked = maskEmail(email);
    if (result.ret === 0 && result.msg.includes("已经签到过了")) {
        console.log(`ℹ️ [${masked}] 今日已签到`);
        if (!isSilent) $notification?.post("🔁 69云今日已签到", masked, result.msg);
        return;
    }
    if (result.ret === 1) {
        console.log(`✅ [${masked}] 签到成功`);
        if (!isSilent) $notification?.post("🎉 69云签到成功", masked, `流量: ${result.traffic || '已更新'}\n${result.msg}`);
        return;
    }
    throw new Error(result.msg || "未知错误");
}

function maskEmail(email) {
    if (!email || !email.includes("@")) return "未知账号";
    const [name, domain] = email.split("@");
    return name[0] + "***" + name.slice(-1) + "@" + domain;
}

main();