/*
 *
 *
[rewrite_local]

^https:\/\/api\.cdwjyyh\.com\/app\/integral\/ url script-request-header https://raw.githubusercontent.com/yuhuohua/jb/refs/heads/main/fhwl.js

[mitm]
hostname = api.cdwjyyh.com
*
*
*/
const headers = $request.headers;
const appToken = headers['AppToken'] || headers['apptoken'] || headers['appToken'];

const isSurgeLoon = typeof $persistentStore !== 'undefined';
const isQX = typeof $prefs !== 'undefined';

function readCache(key) {
    if (isSurgeLoon) return $persistentStore.read(key);
    if (isQX) return $prefs.valueForKey(key);
    return null;
}

function writeCache(value, key) {
    if (isSurgeLoon) $persistentStore.write(value, key);
    if (isQX) $prefs.setValueForKey(value, key);
}

if (appToken) {
    const cacheKey = "saved_appToken_cdwj";
    const savedToken = readCache(cacheKey);

    if (appToken !== savedToken) {
        console.log("🎉 抓到新的 AppToken: " + appToken);
        
        writeCache(appToken, cacheKey);

        const title = "AppToken 捕获";
        const subtitle = "🎉 捕获成功 (新Token)";
        const body = appToken;

        if (typeof $notification !== 'undefined') {
            $notification.post(title, subtitle, body);
        } else if (typeof $notify !== 'undefined') {
            $notify(title, subtitle, body);
        }
    } else {
        console.log("⚠️ AppToken 未发生变化，跳过弹窗");
    }
}

$done({});
