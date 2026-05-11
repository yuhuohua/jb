const url = "http://152.136.162.202/ScriptPanel/lzsh.php";
const $ = new Env("乐仔现金库存监控");

$.get({ url: url }, (error, response, data) => {
    if (error) {
        console.log("🚫 网络请求失败: " + error);
    } else {
        const lines = data.split('\n');
        let availableItems = [];

        lines.forEach(line => {
            if (line.includes("现金") && line.includes("✅")) {
                const nameMatch = line.match(/🎁\s*([^|]+)/);
                const stockMatch = line.match(/✅\s*(\d+)/);
                
                if (nameMatch && stockMatch) {
                    const name = nameMatch[1].trim();
                    const stock = stockMatch[1];
                    availableItems.push(`${name} (余 ${stock})`);
                }
            }
        });

        if (availableItems.length > 0) {
            const msg = `发现现金有货：\n${availableItems.join("\n")}`;
            $.notify("💰 乐仔补货啦！", "", msg);
            console.log(msg);
        } else {
            console.log("😴 巡检完成：目前所有现金类商品均无货。");
        }
    }
    $.done();
});

function Env(name) {
    const isQX = typeof $task !== "undefined";
    const isLoon = typeof $loon !== "undefined";
    const isSurge = typeof $httpClient !== "undefined" && !isLoon;
    this.name = name;
    this.notify = (title, subtitle, body) => {
        if (isQX) $notify(title, subtitle, body);
        else if (isSurge || isLoon) $notification.post(title, subtitle, body);
    };
    this.get = (options, callback) => {
        if (isQX) {
            options.method = "GET";
            $task.fetch(options).then(res => callback(null, res, res.body), err => callback(err));
        } else if (isSurge || isLoon) $httpClient.get(options, callback);
    };
    this.done = (value = {}) => {
        if (typeof $done !== "undefined") $done(value);
    };
}
