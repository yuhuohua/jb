const $ = new Env("奈雪点单");
const OPEN_ID = "QL6ZOftGzbziPlZwfiXM";
const SIGN_SECRET = "sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA";

if (typeof $request !== "undefined") {
    let auth = null;
    let headers = $request.headers || {};
    for (let key in headers) {
        if (key.toLowerCase() === 'authorization') {
            auth = headers[key];
            break;
        }
    }

    if (auth && auth.includes('Bearer ')) {
        let token = auth.replace('Bearer ', '').trim();
        if (token) {
            let oldToken = $.getdata('nxdd_token');
            if (oldToken !== token) {
                $.setdata(token, 'nxdd_token');
                $.msg($.name, "获取 Token 成功 🎉", `Token已保存/更新，可关闭抓包。`);
            } else {
                console.log("Token未变化，跳过弹窗");
            }
        }
    }
    $.done({});
} else {
    // 定时任务
    let token = $.getdata('nxdd_token');
    if (!token) {
        $.msg($.name, "签到失败 ❌", "未找到 token，请先打开奈雪点单小程序抓包获取。");
        $.done();
    } else {
        main(token).finally(() => $.done());
    }
}

async function main(token) {
    try {
        let userinfo = await callApi("https://tm-api.pin-dao.cn/user/base-userinfo", token, {});
        if (userinfo.code !== 0) throw new Error(`登录失败: ${userinfo.message || 'Token可能已过期'}`);

        let phone = userinfo.data?.phone || "未知";
        let maskedPhone = phone.length >= 11 ? `${phone.substring(0, 3)}****${phone.substring(7)}` : phone;

        let now = new Date(new Date().getTime() + 8 * 3600000);
        let y = now.getUTCFullYear();
        let m = String(now.getUTCMonth() + 1).padStart(2, '0');
        let d = String(now.getUTCDate()).padStart(2, '0');
        let signDate = `${y}-${m}-01`;
        let today = `${y}-${m}-${d}`;

        let signRecords = await callApi("https://tm-web.pin-dao.cn/user/sign/records", token, { signDate, startDate: today });
        let status = false;
        let count = "-";
        
        if (signRecords.code === 0) {
            status = !!signRecords.data?.status;
            count = signRecords.data?.signCount || "-";
        }

        let signMsg = "";
        if (!status) {
            let signSave = await callApi("https://tm-api.pin-dao.cn/user/sign/save", token, { signDate: today });
            if (signSave.code === 0 && signSave.data?.flag) {
                signMsg = "签到成功 ✅";
                count = (parseInt(count) || 0) + 1;
            } else {
                signMsg = `签到失败: ${signSave.message || '未知异常'} ❌`;
            }
        } else {
            signMsg = "今日已签到 ⚠️";
        }

        let account = await callApi("https://tm-web.pin-dao.cn/user/account/user-account", token, {});
        let coins = account.code === 0 ? account.data?.coin || "-" : "获取失败";

        $.msg($.name, `账号: ${maskedPhone}`, `${signMsg}\n当月已签到: ${count} 天\n当前奈雪币: ${coins}`);
    } catch (e) {
        $.msg($.name, "执行异常 ❌", e.message);
    }
}

function buildRequestData(extraParams) {
    let nonce = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000).toString();
    let timestamp = Math.floor(Date.now() / 1000);
    let urlPath = `nonce=${nonce}&openId=${OPEN_ID}&timestamp=${timestamp}`;
    let signature = b64_hmac_sha1(SIGN_SECRET, urlPath) + "=";

    let common = {
        platform: "wxapp", version: "6.0.86", imei: "", osn: "iPhone 14 Pro Max<iPhone15,3>",
        sv: "iOS 16.2", lang: "zh_CN", currency: "CNY", timeZone: "",
        nonce: parseInt(nonce), openId: OPEN_ID, timestamp: timestamp, signature: signature
    };
    let params = Object.assign({
        businessType: 1, brand: 26000252, tenantId: 1, channel: 2, stallType: null, storeId: "", storeType: "", cityId: "", districtId: "", appId: "wxab7430e6e8b9a4ab"
    }, extraParams);

    return { common, params };
}

function callApi(url, token, body) {
    return new Promise(resolve => {
        let req = {
            url: url,
            headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.79(0x18004f2e) NetType/4G Language/zh_CN",
                "Authorization": `Bearer ${token}`,
                "Referer": "https://servicewechat.com/wxab7430e6e8b9a4ab/871/page-frame.html",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(buildRequestData(body))
        };
        $.post(req, (err, resp, data) => {
            try { resolve(JSON.parse(data)); } 
            catch (e) { resolve({ code: -1, message: "响应解析失败" }); }
        });
    });
}

function Env(t){this.name=t,this.getdata=t=>typeof $persistentStore<"u"?$persistentStore.read(t):typeof $prefs<"u"?$prefs.valueForKey(t):void 0,this.setdata=(t,e)=>typeof $persistentStore<"u"?$persistentStore.write(t,e):typeof $prefs<"u"?$prefs.setValueForKey(t,e):void 0,this.msg=(t,e,s)=>{typeof $notification<"u"?$notification.post(t,e,s):console.log(`${t}\n${e}\n${s}`)},this.post=(t,e)=>{typeof $httpClient<"u"?$httpClient.post(t,(s,i,o)=>e(s,i,o)):typeof $task<"u"?$task.fetch(t).then(t=>e(null,t,t.body),t=>e(t.error,null,null)):e(null,null,null)},this.done=t=>{typeof $done<"u"&&$done(t)}}

// HMAC-SHA1 + Base64
function b64_hmac_sha1(k,d){var m=str2binb(k);if(m.length>16)m=core_sha1(m,k.length*8);var p=Array(16),o=Array(16);for(var i=0;i<16;i++){p[i]=m[i]^0x36363636;o[i]=m[i]^0x5C5C5C5C}var h=core_sha1(p.concat(str2binb(d)),512+d.length*8);return binb2b64(core_sha1(o.concat(h),512+160))}function core_sha1(x,len){x[len>>5]|=0x80<<(24-len%32);x[((len+64>>9)<<4)+15]=len;var w=Array(80),a=1732584193,b=-271733879,c=-1732584194,d=271733878,e=-1009589776;for(var i=0;i<x.length;i+=16){var olda=a,oldb=b,oldc=c,oldd=d,olde=e;for(var j=0;j<80;j++){if(j<16)w[j]=x[i+j];else w[j]=rol(w[j-3]^w[j-8]^w[j-14]^w[j-16],1);var t=safe_add(safe_add(rol(a,5),sha1_ft(j,b,c,d)),safe_add(safe_add(e,w[j]),sha1_kt(j)));e=d;d=c;c=rol(b,30);b=a;a=t}a=safe_add(a,olda);b=safe_add(b,oldb);c=safe_add(c,oldc);d=safe_add(d,oldd);e=safe_add(e,olde)}return Array(a,b,c,d,e)}function sha1_ft(t,b,c,d){if(t<20)return(b&c)|((~b)&d);if(t<40)return b^c^d;if(t<60)return(b&c)|(b&d)|(c&d);return b^c^d}function sha1_kt(t){return(t<20)?1518500249:(t<40)?1859775393:(t<60)?-1894007588:-899497514}function safe_add(x,y){var l=(x&0xFFFF)+(y&0xFFFF),m=(x>>16)+(y>>16)+(l>>16);return(m<<16)|(l&0xFFFF)}function rol(num,cnt){return(num<<cnt)|(num>>>(32-cnt))}function str2binb(str){var bin=Array();var mask=(1<<8)-1;for(var i=0;i<str.length*8;i+=8)bin[i>>5]|=(str.charCodeAt(i/8)&mask)<<(24-i%32);return bin}function binb2b64(binarray){var tab="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";var str="";for(var i=0;i<binarray.length*4;i+=3){var triplet=(((binarray[i>>2]>>8*(3-i%4))&0xFF)<<16)|(((binarray[i+1>>2]>>8*(3-(i+1)%4))&0xFF)<<8)|((binarray[i+2>>2]>>8*(3-(i+2)%4))&0xFF);for(var j=0;j<4;j++){if(i*8+j*6>binarray.length*32)str+=tab.charAt(64);else str+=tab.charAt((triplet>>6*(3-j))&0x3F)}}return str.replace(/=+$/, "")}
