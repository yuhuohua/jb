// ============ 调试增强版 ============
// 此版本增加了详细的日志输出，用于排查 Loon 的 Socket 断连问题

const userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1";
const loginUrl = "https://69yun69.com/auth/login";
const checkinUrl = "https://69yun69.com/user/checkin";

let isSilent = false;
let accounts = [];

// === 调试用的参数解析器 ===
function parseParams() {
    let arg = (typeof $argument !== "undefined" && $argument) ? $argument : "";
    console.log(`🔍 调试: 原始参数类型: ${typeof arg}`);
    console.log(`🔍 调试: 原始参数值: ${JSON.stringify(arg)}`);

    // 情况1: 如果是字符串 (Surge常见)
    if (typeof arg === "string") {
        // 检查是否包含静默标记
        if (arg.includes("silent=#")) isSilent = true;
        
        // 移除静默参数部分，只留下账号部分
        let accountStr = arg.split("&silent=")[0] || arg;
        
        // 按 # 分割账号
        const parts = accountStr.split("#").filter(p => p.trim() !== "" && p.includes("@"));
        parts.forEach(p => {
            // 支持 : 和 , 两种分隔符
            const sep = p.includes(":") ? ":" : (p.includes(",") ? "," : null);
            if (sep) {
                const [email, password] = p.split(sep).map(s => s.trim());
                if (email && password) accounts.push({ email, password });
            }
        });
    } 
    // 情况2: 如果是数组 (Loon常见)
    else if (Array.isArray(arg)) {
        arg.forEach(item => {
            if (typeof item === "string" && item.includes("@")) {
                const sep = item.includes(":") ? ":" : (item.includes(",") ? "," : null);
                if (sep) {
                    const [email, password] = item.split(sep).map(s => s.trim());
                    if (email && password) accounts.push({ email, password });
                }
            }
        });
        // Loon 的静默参数通常在数组最后一个，或者需要单独配置，这里简单处理
        // 如果你的Loon配置里静默是单独的参数，可能需要调整，但通常Loon不通知是默认行为
    }
    // 情况3: 如果是对象
    else if (typeof arg === "object" && arg !== null) {
        // 兼容 Surge 的对象传参
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
        if (arg["silent"] === "#" || arg["静默"] === "#") isSilent = true;
    }
}

parseParams();
console.log(`📝 调试: 解析到 ${accounts.length} 个账号:`, accounts.map(a => maskEmail(a.email)));

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
            console.log(`✅ 调试: 登录Cookie获取成功: ${loginRes.cookie.substring(0, 30)}...`);
            
            const checkinRes = await performCheckin(loginRes.cookie);
            handleResult(checkinRes, acc.email);
        } catch (err) {
            console.log(`❌ 失败: ${err.message}`);
            console.log(`❌ 错误详情:`, err); // 打印完整错误对象
            if (!isSilent) $notification.post("69云签到失败 ❌", maskedEmail, err.message);
        }
        
        if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log("\n✅ 所有任务处理完毕");
    $done();
}

function performLogin(email, password) {
    const body = `email=${encodeURIComponent(email)}&passwd=${encodeURIComponent(password)}&code=`;
    console.log(`🔍 调试: 发送登录请求 | Body: ${body}`); // 打印请求体

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
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                // --- 关键修复点 ---
                // Loon 可能需要明确指定不压缩，或者服务器不支持 br/gzip
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive"
            },
            body: body
        }, (error, response, data) => {
            if (error) {
                console.log(`🚨 调试: 登录请求网络错误:`, error);
                return reject(new Error(`网络错误: ${error}`));
            }
            
            console.log(`📨 调试: 登录响应状态码: ${response.status}`);
            console.log(`📨 调试: 登录响应头:`, response.headers); // 打印响应头
            
            if (response.status !== 200) {
                return reject(new Error(`状态码异常: ${response.status}`));
            }
            
            try {
                const res = JSON.parse(data);
                console.log(`📨 调试: 登录响应Body:`, res); // 打印服务器返回的具体内容
                if (res.ret !== 1) return reject(new Error(res.msg || "登录失败"));
                
                const cookie = response.headers['Set-Cookie'] || response.headers['set-cookie'] || '';
                resolve({ cookie, data: res });
            } catch (e) {
                console.log(`🚨 调试: 登录响应解析失败 | Raw Data: ${data}`);
                reject(new Error("登录响应解析失败"));
            }
        });
    });
}

function performCheckin(cookie) {
    console.log(`🔍 调试: 发送签到请求 | Cookie长度: ${cookie.length}`);
    
    return new Promise((resolve, reject) => {
        $httpClient.post({
            url: checkinUrl,
            header: {
                "User-Agent": userAgent,
                "Origin": "https://69yun69.com",
                "Referer": "https://69yun69.com/user",
                "X-Requested-With": "XMLHttpRequest",
                "Cookie": cookie,
                // --- 关键修复点 ---
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive"
                // 注意: 原脚本中有 "Content-Length": "0"，这在POST请求中有时会引起问题，HttpClient通常会自动计算，这里暂时移除看效果
            }
            // 注意：签到接口通常不需要 Body，或者 Body 为空
        }, (error, response, data) => {
            if (error) {
                console.log(`🚨 调试: 签到请求网络错误:`, error);
                return reject(new Error(`网络错误: ${error}`));
            }
            
            console.log(`📨 调试: 签到响应状态码: ${response.status}`);
            console.log(`📨 调试: 签到响应头:`, response.headers);
            
            try {
                console.log(`📨 调试: 签到原始响应: ${data}`);
                resolve(JSON.parse(data));
            } catch (e) {
                console.log(`🚨 调试: 签到响应解析失败 | Raw: ${data}`);
                reject(new Error("签到响应解析失败"));
            }
        });
    });
}

// ... (handleResult 和 maskEmail 函数保持不变，为了节省篇幅略去) ...
