// [rule: raw]
const TITLE = "中国移动多账号签到";
const BASE_URL = "https://wx.10086.cn";
const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/wkwebview leadeon/12.5.5/CMCCIT";

const PROVINCE_CODE = "200";
const CITY_CODE = "0754";
const CARRIER_OPERATOR = "002";
const APP_VERSION_CODE = "12.5.5";
const SIGN_ACT_ID = "1021122301";
const SIGN_CHANNEL = "P00000109876";
const SIGN_ACT_URL = `${BASE_URL}/qwhdhub/qwhdmark/${SIGN_ACT_ID}?channelId=${SIGN_CHANNEL}`;
const WED_ACT_URL = `${BASE_URL}/hlwyxhdhub/act-wedrecharge/1024101716?pageId=1849008675699650560&channelId=P00000093619`;

// 拼图档位兑换映射 (r6=95折, r5=9折, r4=8折)
const PUZZLE_RECEIVE = { "1": "r6", "2": "r5", "3": "r4" };
const RECEIVE_LABELS = { "r6": "95折话费券", "r5": "9折话费券", "r4": "8折话费券" };

!(async () => {
    console.log(`==== 开始执行 ${TITLE} 任务 ====`);
    
    let accounts = [];

    try {
        let multiAuthStr = $persistentStore.read("cm_multi_auth");
        if (multiAuthStr) {
            let multiAuth = JSON.parse(multiAuthStr);
            for (let p in multiAuth) {
                if (multiAuth[p] && multiAuth[p].cookie) {
                    accounts.push({ phone: p, token: multiAuth[p].cookie });
                }
            }
        }
    } catch (e) {}

    if (accounts.length === 0) {
        let singleToken = $persistentStore.read("cm_cookie") || "";
        let singlePhone = $persistentStore.read("cm_primary_phone") || "";
        if (typeof $argument !== "undefined" && $argument !== "") {
            let argPhone = $argument.split("=")[0].trim();
            if (argPhone) singlePhone = argPhone;
        }
        if (singleToken && singlePhone) {
            accounts.push({ phone: singlePhone, token: singleToken });
        }
    }

    if (accounts.length === 0) {
        $notification.post(TITLE, "❌ 配置缺失", "未找到有效手机号或 Cookie。请先打开移动APP让面板获取数据！");
        return $done({});
    }

    console.log(`✅ 共检测到 ${accounts.length} 个账号，准备开始循环执行...`);
    let finalSummary = [];

    for (let i = 0; i < accounts.length; i++) {
        let phone = accounts[i].phone;
        let appToken = accounts[i].token;
        let phoneMask = phone.length === 11 ? `${phone.substring(0,3)}****${phone.substring(7)}` : phone;
        let accSummary = [];

        console.log(`\n=========================================`);
        console.log(`>>> 正在处理第 ${i + 1} 个账号: ${phoneMask} <<<`);
        console.log(`=========================================`);

        try {
            // ================= 1. 每日签到 =================
            console.log(`[签到] 开始获取主活动会话...`);
            let signCookie = await exchangeSession(SIGN_ACT_URL, phone, appToken, "qwhdhub");
            if (!signCookie) throw new Error("获取Session失败");

            let signHeaders = getHeaders(SIGN_ACT_URL, signCookie);
            let statusResp = await request("POST", `${BASE_URL}/qwhdhub/api/mark/mark31/markstatus`, signHeaders, {});
            
            if (statusResp && statusResp.code === "SUCCESS" && statusResp.data) {
                let uInfo = statusResp.data.userinfo || {};
                let accDays = uInfo.accumulateTimes || "?";
                let todayStr = getTodayStr();
                let markList = statusResp.data.markstatus || [];
                let isSigned = markList.some(d => d.date === todayStr && d.status === "1");
                
                if (isSigned) {
                    accSummary.push(`✅签到: 已签(累${accDays}天)`);
                    console.log(`[签到] 今日已签过，累计 ${accDays} 天`);
                } else {
                    let doResp = await request("POST", `${BASE_URL}/qwhdhub/api/mark/mark31/domark`, signHeaders, JSON.stringify({date: todayStr}));
                    if (doResp && (doResp.code === "SUCCESS" || doResp.status === "HAVE_MARKED")) {
                        accSummary.push(`✅签到: 成功(累${parseInt(accDays)+1}天)`);
                        console.log(`[签到] 签到成功！累计 ${parseInt(accDays)+1} 天`);
                    } else {
                        accSummary.push(`❌签到: 失败(${doResp ? doResp.msg : '未知'})`);
                        console.log(`[签到] 失败: ${doResp ? doResp.msg : '未知'}`);
                    }
                }

                let taskChances = statusResp.data.taskAwardChance || [];
                let awardList = [];
                for (let task of taskChances) {
                    if (task.id) {
                        await sleep(1000);
                        let awardResp = await request("POST", `${BASE_URL}/qwhdhub/api/mark/mark31/taskAward/${task.id}`, signHeaders, {});
                        if (awardResp && awardResp.data && awardResp.data.prizeName) {
                            awardList.push(awardResp.data.prizeName);
                            console.log(`[领奖] 成功领取奖励: ${awardResp.data.prizeName}`);
                        }
                    }
                }
                if (awardList.length > 0) accSummary.push(`🎁领奖: ${awardList.join(',')}`);

            } else {
                accSummary.push(`❌签到查询失败`);
                console.log(`[签到] 状态查询失败: ${JSON.stringify(statusResp)}`);
            }

            // ================= 2. 周三充值日任务与抽奖 =================
            let todayDay = new Date().getDay();
            if (todayDay === 3) {
                console.log(`[周三] 开始处理充值日拼图任务...`);
                let wedCookie = await exchangeSession(WED_ACT_URL, phone, appToken, "hlwyxhdhub");
                if (wedCookie) {
                    let wedHeaders = getHeaders(WED_ACT_URL, wedCookie);
                    
                    await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/queryActivityInfo`, wedHeaders, {});
                    let actInfo = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/queryPictureActInfo`, wedHeaders, {});
                    let activeIdx = actInfo?.data?.activeIndex || "1";
                    
                    let tasksResp = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/taskList`, wedHeaders, {});
                    let tasks = tasksResp?.data || [];
                    let skipIds = ["yqyh", "czhf", "llym", "dlhd"]; 
                    
                    let doneCount = 0;
                    for (let t of tasks) {
                        if (t.status !== 2 && !skipIds.includes(t.taskId)) {
                            await sleep(1000);
                            let fResp = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/finishTask`, wedHeaders, JSON.stringify({taskId: t.taskId}));
                            if (fResp && fResp.code === "0") doneCount++;
                        }
                    }
                    
                    actInfo = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/queryPictureActInfo`, wedHeaders, {});
                    let drawTimes = parseInt(actInfo?.data?.drawTimes || "0");
                    
                    let drawCount = 0;
                    while (drawTimes > 0 && drawCount < 20) { 
                        await sleep(1000);
                        let dResp = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/drawPicture`, wedHeaders, JSON.stringify({round: `dp${activeIdx}`}));
                        if (dResp && dResp.code === "0") {
                            drawTimes--;
                            drawCount++;
                        } else {
                            break;
                        }
                    }
                    
                    // ================= 3. 周三拼图兑换立减金 =================
                    let finalActInfo = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/queryPictureActInfo`, wedHeaders, {});
                    let pics = finalActInfo?.data?.pictureList || {};
                    let claimList = [];
                    
                    for (let idx in pics) {
                        let pieces = pics[idx];
                        let isComplete = true;
                        
                        // 检查碎片是否为空
                        if (!pieces || Object.keys(pieces).length === 0) {
                            isComplete = false;
                        } else {
                            // 检查该档位所有碎片的数量是否 >= 1
                            for (let pKey in pieces) {
                                if (parseInt(pieces[pKey]) < 1) {
                                    isComplete = false;
                                    break;
                                }
                            }
                        }
                        
                        if (isComplete && PUZZLE_RECEIVE[idx]) {
                            let rnd = PUZZLE_RECEIVE[idx];
                            let label = RECEIVE_LABELS[rnd] || "话费券";
                            console.log(`[周三兑换] 检测到拼图 ${idx} 已集齐，正在发起自动兑换...`);
                            await sleep(1000);
                            
                            let rResp = await request("POST", `${BASE_URL}/hlwyxhdhub/api/wedrecharge/receiveNew`, wedHeaders, JSON.stringify({round: rnd}));
                            if (rResp && rResp.code === "0") {
                                let prizes = (rResp.data && rResp.data.actPrizes) || [];
                                let pName = prizes.map(p => p.prizeName).join('、') || label;
                                console.log(`[周三兑换] ✅ 成功领到: ${pName}`);
                                claimList.push(pName);
                            } else if (rResp && rResp.msg && rResp.msg.includes("已领取")) {
                                console.log(`[周三兑换] ${label} 之前已经兑换过了。`);
                            } else {
                                console.log(`[周三兑换] ❌ 领取失败: ${rResp ? rResp.msg : '未知错误'}`);
                            }
                        }
                    }
                    
                    let wedStr = `🧩周三: ${doneCount}任务,抽${drawCount}次`;
                    if (claimList.length > 0) wedStr += ` | 🎫得:${claimList.join(',')}`;
                    accSummary.push(wedStr);

                } else {
                    accSummary.push(`⚠️周三: 会话失败`);
                    console.log(`[周三] 会话获取失败，跳过`);
                }
            }
        } catch (e) {
            accSummary.push(`❌脚本异常`);
            console.log(`[错误] 账号 ${phoneMask} 运行抛出异常: ${e.message || e}`);
        }

        finalSummary.push(`【号${i + 1} | ${phoneMask}】\n${accSummary.join(' | ')}`);
        
        if (i < accounts.length - 1) {
            console.log(`[休眠] 等待几秒后处理下一个账号...`);
            await sleep(2000 + Math.random() * 2000);
        }
    }

    console.log(`\n==== ${TITLE} 全部任务执行结束 ====`);
    $notification.post(TITLE, `✅ 任务执行完毕 (共 ${accounts.length} 个账号)`, finalSummary.join('\n\n'));
    $done({});
})();


// ================= 核心认证逻辑 =================
async function exchangeSession(actUrl, phoneNum, appTokenStr, hubName) {
    let jwtKey = `cmcc_jwt_${phoneNum.substring(7)}`;
    let cachedJwt = $persistentStore.read(jwtKey);
    if (!cachedJwt || cachedJwt.trim() === "") cachedJwt = null;
    
    let ssoUrl = `${BASE_URL}/qwhdsso/login?dlwmh=true&actUrl=${encodeURIComponent(actUrl)}`;
    
    let ssoRes = await requestRaw("GET", ssoUrl, {
        "user-agent": USER_AGENT,
        "accept-language": "zh-CN,zh-Hans;q=0.9",
        "Cookie": "" 
    });
    
    let loginPathMatch = ssoRes.body.match(/loginPath\s*=\s*'([^']+)'/);
    if (!loginPathMatch) {
        console.log(`[鉴权] 获取 sid 失败，无法进行下一步登录`);
        return null;
    }
    let loginApiUrl = BASE_URL + "/qwhdsso" + loginPathMatch[1];
    
    let userCheckId = parseInt(phoneNum).toString(16);
    let loginBody = {
        provinceCode: PROVINCE_CODE,
        cityCode: CITY_CODE,
        userCheckId: userCheckId,
        carrierOperator: CARRIER_OPERATOR,
        appVersionCode: APP_VERSION_CODE,
        took: Math.floor(Math.random() * 800) + 120,
        jwtToken: cachedJwt,
        token: ""
    };

    let headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "User-Agent": USER_AGENT,
        "accept-language": "zh-CN,zh-Hans;q=0.9",
        "Cookie": ""
    };

    let loginResp = null;
    if (cachedJwt) {
        loginResp = await request("POST", loginApiUrl, headers, JSON.stringify(loginBody));
        if (loginResp && loginResp.code === "SUCCESS") {
            console.log(`[鉴权] 使用本地长效 JWT 续期成功！`);
        }
    }
    
    if (!loginResp || loginResp.code !== "SUCCESS") {
        console.log(`[鉴权] JWT 失效或为空，使用面板抓取的 Token 重新引导...`);
        loginBody.jwtToken = null;  
        loginBody.token = appTokenStr;
        loginResp = await request("POST", loginApiUrl, headers, JSON.stringify(loginBody));
    }

    if (!loginResp || loginResp.code !== "SUCCESS" || !loginResp.data) {
        console.log(`[鉴权] Token 登录失败，请打开移动APP让面板脚本刷新数据！`);
        return null;
    }

    if (loginResp.data.jwt) {
        $persistentStore.write(loginResp.data.jwt, jwtKey);
        console.log(`[鉴权] 成功保存/更新最新长效 JWT 凭证`);
    }

    let finalUrl = loginResp.data.url;
    let actReq = await requestRaw("GET", finalUrl, {
        "User-Agent": USER_AGENT,
        "Cookie": "" 
    });
    
    let sessionToken = "";
    let targetCookieName = hubName === "qwhdhub" ? "QWHD_SESSION_TOKEN" : "HLWHD_SESSION_TOKEN";
    
    if (actReq.headers) {
        let headerStr = JSON.stringify(actReq.headers);
        let regex = new RegExp(`${targetCookieName}=([^;"]+)`);
        let match = headerStr.match(regex);
        if (match) {
            sessionToken = `${targetCookieName}=${match[1]}`;
            console.log(`[鉴权] 成功截获短期会话: ${sessionToken.substring(0, 25)}...`);
        }
    }
    
    return sessionToken;
}

// ================= 网络工具 =================
function getHeaders(referer, cookieStr) {
    return {
        "accept": "*/*",
        "content-type": "application/json;charset=UTF-8",
        "origin": BASE_URL,
        "referer": referer,
        "login-check": "1",
        "x-requested-with": "XMLHttpRequest",
        "user-agent": USER_AGENT,
        "cookie": cookieStr 
    };
}

function requestRaw(method, url, headers, body = null) {
    return new Promise((resolve) => {
        let options = { 
            url: url, 
            headers: headers,
            redirection: false,     
            'auto-redirect': false  
        };
        if (body) options.body = body;
        let callback = (error, response, data) => {
            resolve({ error, response, headers: response ? response.headers : null, body: data });
        };
        if (method === "POST") $httpClient.post(options, callback);
        else $httpClient.get(options, callback);
    });
}

function request(method, url, headers, body = null) {
    return new Promise((resolve) => {
        let options = { url: url, headers: headers };
        if (body) options.body = body;
        let callback = (error, response, data) => {
            if (error) resolve(null);
            else {
                try { resolve(data ? JSON.parse(data) : null); } 
                catch (e) { resolve(null); }
            }
        };
        if (method === "POST") $httpClient.post(options, callback);
        else $httpClient.get(options, callback);
    });
}

function getTodayStr() {
    let d = new Date();
    let y = d.getFullYear();
    let m = String(d.getMonth() + 1).padStart(2, '0');
    let day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
