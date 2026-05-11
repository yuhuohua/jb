/**
 * @name 综合脚本：通用获取Cookie/Token + PingMe自动化签到
 * @author fmz200 & 怎么肥事
 * @date 2026-04-17 15:00:00
 * * [rewrite_local]
 * # 抓取逻辑（脚本1的URL匹配 + PingMe匹配）
 * ^https:\/\/(web\.chery\.cn\/web\/user\/current\/details|user-api\.smzdm\.com\/users\/info|.*\.pinduoduo\.com\/proxy\/api\/api\/server\/_stm|api\.pingmeapp\.net\/app\/queryBalanceAndBonus|.*meituan\.com\/(user\/v1\/info\/auditting|mapi\/usercenter)|api\.weibo\.cn\/2\/users\/show|mcs-mimp\/share\/(weChat|app)\/share.*Redirect|.*\.xiaoxiaoyouxuan\.com\/my) url script-request-header https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/cookie/get_cookie.js
 * * [task_local]
 * # PingMe 签到任务（脚本2）
 * 30 8,20 * * * https://raw.githubusercontent.com/fmz200/wool_scripts/main/Scripts/PingMe/PingMeSignin.js, tag=PingMe签到, enabled=true
 * * [MITM]
 * hostname = web.chery.cn, user-api.smzdm.com, *.pinduoduo.com, api.pingmeapp.net, *.meituan.com, api.weibo.cn, mcs-mimp.sf-express.com, *.xiaoxiaoyouxuan.com
 */

const $ = new Env('综合脚本（获取Cookie+PingMe签到）');

// 配置常量
const ckKey = 'pingme_capture_v3';
const SECRET = '0fOiukQq7jXZV2GRi9LGlO';
const MAX_VIDEO = 5;
const VIDEO_DELAY = 8000;

// 主逻辑入口
(async () => {
    if (typeof $request !== 'undefined') {
        // --- 逻辑1：获取 Cookie/Token 流程 ---
        await getCookies();
    } else {
        // --- 逻辑2：PingMe 自动化签到流程 ---
        await startPingMeTask();
    }
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done());

/**
 * ---------------------------------------------------------
 * 获取 Cookie/Token 逻辑 (原脚本1)
 * ---------------------------------------------------------
 */
async function getCookies() {
    const req_url = $request.url;
    const req_headers = $request.headers;
    const req_body = $request.body;
    let rsp_body = "{}";
    
    if (typeof $response !== 'undefined' && $response !== null) {
        rsp_body = $response.body;
    }

    try {
        // 1. 奇瑞汽车
        if (req_url.includes("/web/user/current/details?")) {
            const regex = /access_token=([^&]*)/;
            let match = req_url.match(regex);
            const access_token = match ? match[1] : "";
            let rsp_data = JSON.parse(rsp_body);
            if (rsp_data.data?.accountId) {
                let { accountId, avatarUrl, displayName } = rsp_data.data;
                let cache = $.getdata("#fmz200_chery_account") || "[]";
                let json_data = JSON.parse(cache);
                updateOrAddObject(json_data, "accountId", accountId, "access_token", access_token, "displayName", displayName, "avatarUrl", avatarUrl);
                $.setdata(JSON.stringify(json_data, null, "\t"), '#fmz200_chery_account');
                $.msg('奇瑞汽车App 获取token成功✅', "", access_token);
            }
        }

        // 2. 什么值得买
        if (req_url.includes("/user-api.smzdm.com/users/info")) {
            const cookie = req_headers['Cookie'] || req_headers['cookie'];
            let match = cookie.match(/smzdm_id=(\d+)/);
            let smzdm_id = match ? match[1] : "";
            let cache = $.getdata("#fmz200_smzdm_cookie") || "[]";
            let json_data = JSON.parse(cache);
            updateOrAddObject(json_data, "smzdm_id", smzdm_id, "cookie", cookie);
            $.setdata(cookie, '#SMZDM_COOKIE');
            $.setdata(JSON.stringify(json_data, null, "\t"), '#fmz200_smzdm_cookie');
            $.msg('什么值得买 获取cookie成功✅', "", cookie);
        }

        // 3. 拼多多果园
        if (req_url.includes("/proxy/api/api/server/_stm")) {
            const cookieValue = req_headers["Cookie"] || req_headers["cookie"];
            const tokenMatch = cookieValue.match(/PDDAccessToken=.+?/);
            if (tokenMatch) {
                $.setdata(tokenMatch[0], '#ddgyck');
                $.setdata(tokenMatch[0], '#fmz200_pdd_token');
                $.msg('拼多多果园 token获取成功', "", tokenMatch[0]);
            }
        }

        // 4. 美团
        if (req_url.includes("/user/v1/info/auditting") || req_url.includes("/mapi/usercenter")) {
            const token = req_headers['token'] || req_headers['Token'];
            if (token) {
                $.setdata(token, '#meituanCookie');
                let data = JSON.parse(rsp_body);
                if (data.user) {
                    let { id: uid, username } = data.user;
                    let cache = $.getdata("#fmz200_meituan_cookie") || "[]";
                    let json_data = JSON.parse(cache);
                    updateOrAddObject(json_data, "meituan_id", uid, "username", username, "token", token);
                    $.setdata(JSON.stringify(json_data, null, "\t"), '#fmz200_meituan_cookie');
                    $.msg('美团获取token成功✅', "", token);
                }
            }
        }

        // 5. 微博
        if (req_url.includes("/users/show")) {
            let match = req_url.match(/uid=(\d+)/);
            if (match) {
                let uid = match[1];
                let cache = $.getdata("#fmz200_weibo_token") || "[]";
                let json_data = JSON.parse(cache);
                updateOrAddObject(json_data, "weibo_id", uid, "signin_url", req_url, "headers", req_headers);
                $.setdata(JSON.stringify(json_data, null, "\t"), '#fmz200_weibo_token');
                $.msg('微博获取cookie 成功✅', "", "UID: " + uid);
            }
        }

        // 6. 顺丰速运
        if (req_url.includes("/mcs-mimp/share/weChat/shareGiftReceiveRedirect") || req_url.includes("/mcs-mimp/share/app/shareRedirect")) {
            $.setdata(req_url, '#sfsyBee');
            $.setdata(req_url, '#fmz200_sf_bee');
            $.msg('顺丰速运 获取成功✅', "", req_url);
        }

        // 7. 滴滴果园
        if (req_url.includes("/api/game/plant/newWatering")) {
            let data = JSON.parse(req_body);
            let { uid, token: newToken } = data;
            let cache = $.getdata("#fmz200_didi_fruit") || "{}";
            let json_data = parseDataString(cache);
            updateToken(uid, newToken, json_data);
            let string_data = convertDataToString(json_data);
            $.setdata(string_data, '#ddgyToken');
            $.setdata(string_data, '#fmz200_didi_fruit');
            $.msg('滴滴果园token 获取成功✅', "", string_data);
        }

        // 8. 晓晓优选
        if (req_url.includes("xxyx-client-api.xiaoxiaoyouxuan.com/my")) {
            const token = req_headers['xx-token'];
            let res = JSON.parse(rsp_body);
            if (token && res.data) {
                let { mobile, nick: username, avatar } = res.data;
                let cache = $.getdata("#fmz200_xxyx_token") || "[]";
                let json_data = JSON.parse(cache);
                updateOrAddObject(json_data, "mobile", mobile, "username", username, "token", token, "avatar", avatar);
                $.setdata(JSON.stringify(json_data, null, "\t"), '#fmz200_xxyx_token');
                $.msg('晓晓优选token 获取成功✅');
            }
        }

        // 9. PingMe (同步原脚本2的抓取逻辑)
        if (req_url.includes("/app/queryBalanceAndBonus")) {
            const capture = {
                url: req_url,
                paramsRaw: parseRawQuery(req_url),
                headers: normalizeHeaderNameMap(req_headers || {})
            };
            $.setdata(JSON.stringify(capture), ckKey);
            $.msg('PingMe 获取参数成功✅', '现在你可以运行签到任务了', '');
        }

    } catch (e) {
        $.log(`获取Cookie脚本运行错误：${e}`);
    }
}

/**
 * ---------------------------------------------------------
 * PingMe 签到任务逻辑 (原脚本2)
 * ---------------------------------------------------------
 */
async function startPingMeTask() {
    $.log("开始运行 PingMe 签到任务");
    const raw = $.getdata(ckKey);
    if (!raw) {
        $.msg($.name, "❌ 请先获取PingMe签到参数", "先打开PingMe触发一次");
        return;
    }

    let capture;
    try {
        capture = JSON.parse(raw);
    } catch (e) {
        $.msg($.name, "❌ PingMe签到参数损坏", "请重新获取参数");
        return;
    }

    const headers = buildHeaders(capture);
    const msgs = [];

    const fetchApi = (path) => $.http.get({ url: buildUrl(path, capture), headers });

    // 查询余额
    try {
        let res = await fetchApi('queryBalanceAndBonus');
        let d = JSON.parse(res.body);
        if (d.retcode === 0) msgs.push(`💰 余额：${d.result.balance} Coins`);
        else msgs.push(`⚠️ 查询：${d.retmsg}`);
    } catch (e) { msgs.push('❌ 查询余额失败'); }

    // 执行签到
    try {
        let res = await fetchApi('checkIn');
        let d = JSON.parse(res.body);
        if (d.retcode === 0) msgs.push(`✅ 签到：${(d.result?.bonusHint || d.retmsg || '').replace(/\n/g, ' ')}`);
        else msgs.push(`⚠️ 签到：${d.retmsg}`);
    } catch (e) { msgs.push('❌ 签到执行失败'); }

    // 视频奖励循环
    for (let i = 1; i <= MAX_VIDEO; i++) {
        await $.wait(i === 1 ? 1500 : VIDEO_DELAY);
        try {
            let res = await fetchApi('videoBonus');
            let d = JSON.parse(res.body);
            if (d.retcode === 0) {
                msgs.push(`🎬 视频${i}：+${d.result?.bonus || '?'} Coins`);
            } else {
                msgs.push(`⏸ 视频${i}：${d.retmsg}`);
                break;
            }
        } catch (e) { msgs.push(`❌ 视频${i} 请求异常`); break; }
    }

    // 最终余额
    try {
        let res = await fetchApi('queryBalanceAndBonus');
        let d = JSON.parse(res.body);
        if (d.retcode === 0) msgs.push(`💰 最新余额：${d.result.balance} Coins`);
    } catch (e) {}

    $.msg($.name, "🎉 任务完成", msgs.join('\n'));
}

/**
 * ---------------------------------------------------------
 * 工具函数
 * ---------------------------------------------------------
 */
function updateOrAddObject(collection, ...args) {
    if (args.length % 2 !== 0) throw new Error('Arguments must be provided in pairs.');
    for (let i = 0; i < args.length; i += 2) {
        const id = args[i], key = args[i + 1];
        const index = collection.findIndex(obj => obj[id] === key);
        if (index !== -1) {
            for (let j = i + 2; j < args.length; j += 2) {
                collection[index][args[j]] = args[j + 1];
            }
        } else {
            const newObj = {};
            for (let j = i; j < args.length; j += 2) newObj[args[j]] = args[j + 1];
            collection.push(newObj);
            break;
        }
    }
}

function parseDataString(dataString) {
    let data = {};
    let parts = dataString.split(/[\n@]/);
    parts.forEach(part => {
        let [uid, token] = part.split("&");
        if (uid && token) data[uid] = token;
    });
    return data;
}

function updateToken(uidToUpdate, newToken, data) {
    data[uidToUpdate] = newToken;
}

function convertDataToString(data) {
    return Object.keys(data).map(uid => `${uid}&${data[uid]}`).join('@');
}

function parseRawQuery(url) {
    const query = (url.split('?')[1] || '').split('#')[0];
    const rawMap = {};
    query.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) rawMap[k] = v;
    });
    return rawMap;
}

function normalizeHeaderNameMap(headers) {
    const out = {};
    Object.keys(headers).forEach(k => out[k] = headers[k]);
    return out;
}

function buildUrl(path, capture) {
    const params = {};
    Object.keys(capture.paramsRaw || {}).forEach(k => {
        if (k !== 'sign' && k !== 'signDate') params[k] = capture.paramsRaw[k];
    });
    params.signDate = getUTCSignDate();
    const signBase = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    params.sign = MD5(signBase + SECRET);
    const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
    return `https://api.pingmeapp.net/app/${path}?${qs}`;
}

function buildHeaders(capture) {
    const headers = { ...capture.headers };
    ['Content-Length', 'content-length', ':authority', ':method', ':path', ':scheme'].forEach(k => delete headers[k]);
    headers['Host'] = 'api.pingmeapp.net';
    return headers;
}

function getUTCSignDate() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getUTCFullYear()}-${pad(now.getUTCMonth()+1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
}

function MD5(string) {
    function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
    function AddUnsigned(lX, lY) {
        const lX4 = lX & 0x40000000, lY4 = lY & 0x40000000, lX8 = lX & 0x80000000, lY8 = lY & 0x80000000;
        const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
        if (lX4 | lY4) return (lResult & 0x40000000) ? (lResult ^ 0xC0000000 ^ lX8 ^ lY8) : (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        return lResult ^ lX8 ^ lY8;
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return x ^ y ^ z; }
    function I(x, y, z) { return y ^ (x | (~z)); }
    function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function ConvertToWordArray(str) {
        const lMessageLength = str.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = Array(lNumberOfWords - 1).fill(0);
        let lBytePosition = 0, lByteCount = 0;
        while (lByteCount < lMessageLength) {
            const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] |= str.charCodeAt(lByteCount) << lBytePosition;
            lByteCount++;
        }
        const lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] |= 0x80 << lBytePosition;
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function WordToHex(lValue) {
        let WordToHexValue = '';
        for (let lCount = 0; lCount <= 3; lCount++) {
            const lByte = (lValue >>> (lCount * 8)) & 255;
            const WordToHexValue_temp = '0' + lByte.toString(16);
            WordToHexValue += WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
        }
        return WordToHexValue;
    }
    const x = ConvertToWordArray(string);
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20, S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    for (let k = 0; k < x.length; k += 16) {
        const AA = a, BB = b, CC = c, DD = d;
        a = FF(a,b,c,d,x[k+0],S11,0xD76AA478); d = FF(d,a,b,c,x[k+1],S12,0xE8C7B756); c = FF(c,d,a,b,x[k+2],S13,0x242070DB); b = FF(b,c,d,a,x[k+3],S14,0xC1BDCEEE);
        a = FF(a,b,c,d,x[k+4],S11,0xF57C0FAF); d = FF(d,a,b,c,x[k+5],S12,0x4787C62A); c = FF(c,d,a,b,x[k+6],S13,0xA8304613); b = FF(b,c,d,a,x[k+7],S14,0xFD469501);
        a = FF(a,b,c,d,x[k+8],S11,0x698098D8); d = FF(d,a,b,c,x[k+9],S12,0x8B44F7AF); c = FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1); b = FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
        a = FF(a,b,c,d,x[k+12],S11,0x6B901122); d = FF(d,a,b,c,x[k+13],S12,0xFD987193); c = FF(c,d,a,b,x[k+14],S13,0xA679438E); b = FF(b,c,d,a,x[k+15],S14,0x49B40821);
        a = GG(a,b,c,d,x[k+1],S21,0xF61E2562); d = GG(d,a,b,c,x[k+6],S22,0xC040B340); c = GG(c,d,a,b,x[k+11],S23,0x265E5A51); b = GG(b,c,d,a,x[k+0],S24,0xE9B6C7AA);
        a = GG(a,b,c,d,x[k+5],S21,0xD62F105D); d = GG(d,a,b,c,x[k+10],S22,0x02441453); c = GG(c,d,a,b,x[k+15],S23,0xD8A1E681); b = GG(b,c,d,a,x[k+4],S24,0xE7D3FBC8);
        a = GG(a,b,c,d,x[k+9],S21,0x21E1CDE6); d = GG(d,a,b,c,x[k+14],S22,0xC33707D6); c = GG(c,d,a,b,x[k+3],S23,0xF4D50D87); b = GG(b,c,d,a,x[k+8],S24,0x455A14ED);
        a = GG(a,b,c,d,x[k+13],S21,0xA9E3E905); d = GG(d,a,b,c,x[k+2],S22,0xFCEFA3F8); c = GG(c,d,a,b,x[k+7],S23,0x676F02D9); b = GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
        a = HH(a,b,c,d,x[k+5],S31,0xFFFA3942); d = HH(d,a,b,c,x[k+8],S32,0x8771F681); c = HH(c,d,a,b,x[k+11],S33,0x6D9D6122); b = HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
        a = HH(a,b,c,d,x[k+1],S31,0xA4BEEA44); d = HH(d,a,b,c,x[k+4],S32,0x4BDECFA9); c = HH(c,d,a,b,x[k+7],S33,0xF6BB4B60); b = HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
        a = HH(a,b,c,d,x[k+13],S31,0x289B7EC6); d = HH(d,a,b,c,x[k+0],S32,0xEAA127FA); c = HH(c,d,a,b,x[k+3],S33,0xD4EF3085); b = HH(b,c,d,a,x[k+6],S34,0x04881D05);
        a = HH(a,b,c,d,x[k+9],S31,0xD9D4D039); d = HH(d,a,b,c,x[k+12],S32,0xE6DB99E5); c = HH(c,d,a,b,x[k+15],S33,0x1FA27CF8); b = HH(b,c,d,a,x[k+2],S34,0xC4AC5665);
        a = II(a,b,c,d,x[k+0],S41,0xF4292244); d = II(d,a,b,c,x[k+7],S42,0x432AFF97); c = II(c,d,a,b,x[k+14],S43,0xAB9423A7); b = II(b,c,d,a,x[k+5],S44,0xFC93A039);
        a = II(a,b,c,d,x[k+12],S41,0x655B59C3); d = II(d,a,b,c,x[k+3],S42,0x8F0CCC92); c = II(c,d,a,b,x[k+10],S43,0xFFEFF47D); b = II(b,c,d,a,x[k+1],S44,0x85845DD1);
        a = II(a,b,c,d,x[k+8],S41,0x6FA87E4F); d = II(d,a,b,c,x[k+15],S42,0xFE2CE6E0); c = II(c,d,a,b,x[k+6],S43,0xA3014314); b = II(b,c,d,a,x[k+13],S44,0x4E0811A1);
        a = II(a,b,c,d,x[k+4],S41,0xF7537E82); d = II(d,a,b,c,x[k+11],S42,0xBD3AF235); c = II(c,d,a,b,x[k+2],S43,0x2AD7D2BB); b = II(b,c,d,a,x[k+9],S44,0xEB86D391);
        a = AddUnsigned(a,AA); b = AddUnsigned(b,BB); c = AddUnsigned(c,CC); d = AddUnsigned(d,DD);
    }
    return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase();
}

/**
 * ---------------------------------------------------------
 * 标准环境类 (Env)
 * ---------------------------------------------------------
 */
function Env(t, e) {
    class s {
        constructor(t) { this.env = t }
        send(t, e = "GET") {
            t = "string" == typeof t ? { url: t } : t;
            let s = this.get; "POST" === e && (s = this.post);
            return new Promise(((e, i) => { s.call(this, t, ((t, s, o) => { t ? i(t) : e(s) })) }))
        }
        get(t) { return this.send.call(this.env, t) }
        post(t) { return this.send.call(this.env, t, "POST") }
    }
    return new class {
        constructor(t, e) {
            this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.startTime = (new Date).getTime(), Object.assign(this, e), console.log(`🔔${this.name}, 开始!`)
        }
        getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "Node.js" }
        isNode() { return "Node.js" === this.getEnv() }
        getdata(t) {
            let e = "";
            if (this.isNode()) { this.data = this.loaddata(); e = this.data[t] }
            else {
                switch (this.getEnv()) {
                    case "Surge": case "Loon": e = $persistentStore.read(t); break;
                    case "Quantumult X": e = $prefs.valueForKey(t); break;
                }
            }
            return e
        }
        setdata(t, e) {
            let s = !1;
            if (this.isNode()) { this.data = this.loaddata(); this.data[e] = t; this.writedata(); s = !0 }
            else {
                switch (this.getEnv()) {
                    case "Surge": case "Loon": s = $persistentStore.write(t, e); break;
                    case "Quantumult X": s = $prefs.setValueForKey(t, e); break;
                }
            }
            return s
        }
        loaddata() { if (!this.isNode()) return {}; this.fs = this.fs ? this.fs : require("fs"); const t = require("path").resolve(this.dataFile); return this.fs.existsSync(t) ? JSON.parse(this.fs.readFileSync(t)) : {} }
        writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"); const t = require("path").resolve(this.dataFile); this.fs.writeFileSync(t, JSON.stringify(this.data)) } }
        msg(e = this.name, s = "", i = "", o = {}) {
            if (this.isNode()) console.log(`${e}\n${s}\n${i}`);
            else {
                switch (this.getEnv()) {
                    case "Surge": case "Loon": $notification.post(e, s, i, o); break;
                    case "Quantumult X": $notify(e, s, i, o); break;
                }
            }
        }
        log(...t) { console.log(t.join(" ")) }
        logErr(t) { console.log(`❗️${this.name} 错误: ${t.message || t}`) }
        wait(t) { return new Promise((e => setTimeout(e, t))) }
        done(t = {}) { const e = ((new Date).getTime() - this.startTime) / 1e3; console.log(`🔔${this.name}, 结束! 🕛 ${e} 秒`); if (!this.isNode()) $done(t) }
    }(t, e)
}
