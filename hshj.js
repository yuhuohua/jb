let url = $request.url;
let body = $request.body;
let headers = $request.headers;

let capturedData = {
    openid: null,
    ticket: null,
    user_id: null
};

let regexParams = /[?&](openid|ticket|userId|user_id|uid|memberid|accountid)=([^&]+)/gi;
let match;
while ((match = regexParams.exec(url)) !== null) {
    let key = match[1].toLowerCase();
    let val = decodeURIComponent(match[2]);
    if (key === "openid") capturedData.openid = val;
    if (key === "ticket") capturedData.ticket = val;
    if (key.includes("user") || key === "uid" || key === "memberid" || key === "accountid") {
        capturedData.user_id = val;
    }
}

if (body) {
    try {
        let jsonObj = JSON.parse(body);
        if (jsonObj.openid) capturedData.openid = jsonObj.openid;
        if (jsonObj.ticket) capturedData.ticket = jsonObj.ticket;
        if (jsonObj.user_id) capturedData.user_id = jsonObj.user_id;
        if (jsonObj.userId) capturedData.user_id = jsonObj.userId;
    } catch (e) {
        let bodyMatch = body.match(/"?(openid|ticket|user_id|userId|uid)"?\s*[:=]\s*["']?([^"',\s}]+)["']?/i);
        if (bodyMatch) {
            let k = bodyMatch[1].toLowerCase();
            let val = bodyMatch[2];
            if (k === "openid") capturedData.openid = val;
            if (k === "ticket") capturedData.ticket = val;
            if (k.includes("user") || k === "uid") capturedData.user_id = val;
        }
    }
}

for (let h in headers) {
    let lowerH = h.toLowerCase();
    let val = headers[h];
    
    if (lowerH === "openid" || (lowerH.includes("openid") && !capturedData.openid)) {
        capturedData.openid = val;
    }
    if (lowerH === "ticket" || (lowerH.includes("ticket") && !capturedData.ticket)) {
        capturedData.ticket = val;
    }
    if (lowerH === "user_id" || lowerH === "userid" || lowerH === "user-id") {
        capturedData.user_id = val;
    }
}

if (capturedData.openid && capturedData.ticket && capturedData.user_id) {
    let currentSignature = `${capturedData.openid}_${capturedData.ticket}_${capturedData.user_id}`;
    
    let savedSignature = $persistentStore.read("AMC_CAPTURED_SIGNATURE");
    
    if (savedSignature !== currentSignature) {
        $persistentStore.write(currentSignature, "AMC_CAPTURED_SIGNATURE");
        
        let output = `[红色火箭🚀完整捕获]`;
        output += `\nOpenID: ${capturedData.openid}`;
        output += `\nTicket: ${capturedData.ticket}`;
        output += `\nUser_ID: ${capturedData.user_id}`;
        
        console.log(output);
        $notification.post("✅红色火箭🚀完整捕获", "🎉成功捕获新账号三件套", output);
    }
}

$done({});
