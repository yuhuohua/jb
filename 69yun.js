const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1";
// ✅ 修正关键：使用当前有效域名（根据你的日志确认为 69yun69.com）
const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";

let isSilent = false;
let accounts = [];

function parseParams() {
    let arg = (typeof $argument !== "undefined" && $argument) ? $argument : "";
    let argStr = "";

    if (typeof arg === "string") {
        argStr = arg;
    } else if (typeof arg === "object" && arg !== null) {
        argStr = JSON.stringify(arg);
        if (arg["silent"] === "#" || arg["静默"] === "#") isSilent = true;
    }

    if (argStr.includes("silent=#")) isSilent = true;

    if (typeof arg === "string") {
        const parts = arg.replace("&silent=#", "").split("#").filter(p => p.trim() !== "");
        parts.forEach(p => {
            const sep = p.includes(":") ? ":" : (p.includes(",") ? "," : null);
            if (sep) {
                const [email, password] = p.split(sep).map(s => s.trim());
                if (email && password) accounts.push({ email, password });
            }
        });
    } else if (typeof arg === "object" && !Array.isArray(arg)) {
        for (let key in arg) {
            let val = arg[key];
            if (typeof val === "string" && val.includes("@")) {
                const sep = val.includes(":") ? ":" : (val.includes(",") ? "," : null);
                if (sep) {
                    const [email, password] = val.split(sep).map(s => s.trim());
                    if (email && password) accounts.push({ email, password });
                }
            }
        }
    }
}

parseParams();

if (accounts.length === 0) {
    console.log("⚠️ 未检测到有效账号，脚本结束");
    $done();
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
            // ✅ 增强错误处理：明确区分网络错误和业务错误
            const errorMsg = err.message.includes("Socket closed") 
                ? "网络连接被中断（请检查TLS配置或节点）" 
                : err.message;
                
            console.log(`❌ [${maskEmail(acc.email)}] 失败: ${errorMsg}`);
            if (!isSilent) $notification.post("69云签到失败 ❌", maskEmail(acc.email), errorMsg);
        }
        
        if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log("\n✅ 所有任务处理完毕");
    $done();
}

// ✅ 关键修复：强制指定TLS版本 + 增强错误诊断
function performLogin(email, password) {
    const body = `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&code=`;
    return new Promise((resolve, reject) => {
        const opts = {
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
            body: body,
            // 🔥 Loon 专属修复：强制启用 TLS 1.2 和 1.3
            tls12: true,
            tls13: true,
            // 可选：如果仍失败，取消下行注释（仅测试用，存在安全风险）
            // rejectUnauthorized: false 
        };

        $httpClient.post(opts, (error, response, data) => {
            if (error) {
                // 详细诊断网络错误类型
                let errMsg = error;
                if (error.message.includes("LNGCDAsyncSocketErrorDomain Code=7")) {
                    errMsg = "Socket closed by remote peer (TLS版本不匹配)";
                } else if (error.message.includes("Request timeout")) {
                    errMsg = "网络请求超时（检查代理节点）";
                }
                return reject(new Error(errMsg));
            }
            
            if (!response || response.status !== 200) {
                return reject(new Error(`HTTP状态码异常: ${response?.status || '无响应'}`));
            }
            
            try {
                const res = JSON.parse(data);
                if (res.ret !== 1) return reject(new Error(res.msg || "登录失败"));
                
                // 从响应头安全提取Cookie
                const setCookie = response.headers['Set-Cookie'] || response.headers['set-cookie'] || '';
                const cookie = setCookie.split(';')[0] || ''; // 只取主Cookie
                if (!cookie) return reject(new Error("Cookie获取失败"));
                
                resolve({ cookie, data: res });
            } catch (e) {
                reject(new Error(`登录响应解析失败: ${e.message}`));
            }
        });
    });
}

// ✅ 关键修复：保持TLS配置一致性
function performCheckin(cookie) {
    return new Promise((resolve, reject) => {
        const opts = {
            url: checkinUrl,
            header: {
                "User-Agent": userAgent,
                "Origin": "https://69yun69.com",
                "Referer": "https://69yun69.com/user",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                "Content-Length": "0"
            },
            // 🔥 Loon 专属修复：必须与登录请求保持相同的TLS配置
            tls12: true,
            tls13: true
        };

        $httpClient.post(opts, (error, response, data) => {
            if (error) return reject(new Error(`签到请求失败: ${error.message}`));
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(new Error(`签到响应解析失败: ${e.message}`));
            }
        });
    });
}

function handleResult(result, email) {
    const masked = maskEmail(email);
    if (result.ret === 0 && result.msg.includes("已经签到过了")) {
        console.log(`ℹ️ [${masked}] 今日已签到`);
        if (!isSilent) $notification.post("🔁 69云今日已签到", masked, result.msg);
        return;
    }
    if (result.ret === 1) {
        console.log(`✅ [${masked}] 签到成功 | 流量: ${result.traffic || '已更新'}`);
        if (!isSilent) $notification.post("🎉 69云签到成功", masked, `流量: ${result.traffic}\n${result.msg}`);
        return;
    }
    throw new Error(result.msg || "未知业务错误");
}

function maskEmail(email) {
    if (!email || !email.includes("@")) return "未知账号";
    const [name, domain] = email.split("@");
    return name[0] + "***" + name.slice(-1) + "@" + domain;
}

main();
