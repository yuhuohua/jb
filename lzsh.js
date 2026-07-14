const url = "http://152.136.162.202/ScriptPanel/lzsh.php";
const $ = new Env("乐仔现金库存监控");

$.get({ url: url }, (error, response, data) => {
    if (error) {
        console.log("🚫 网络请求失败: " + error);
    } else {
        const lines = data.split('\n');
        let availableItems = [];
        let currentNamesArr = [];

        lines.forEach(line => {
            if (line.includes("现金") && line.includes("✅")) {
                const nameMatch = line.match(/🎁\s*([^|]+)/);
                const stockMatch = line.match(/✅\s*(\d+)/);
                
                if (nameMatch && stockMatch) {
                    const name = nameMatch[1].trim();
                    const stock = stockMatch[1];
                    availableItems.push(`${name} (余 ${stock})`);
                    currentNamesArr.push(name); 
                }
            }
        });

        const dateKey = "lz_stock_date";
        const countKey = "lz_stock_notify_count";
        const lastItemsKey = "lz_last_items"; 

        if (availableItems.length > 0) {
            const msg = `发现现金有货：\n${availableItems.join("\n")}`;
            
            const now = new Date();
            now.setHours(now.getHours() + (now.getTimezoneOffset() / 60) + 8); 
            const today = now.toISOString().split('T')[0];
            
            let savedDate = $.getdata(dateKey);
            let notifyCount = parseInt($.getdata(countKey) || "0");
            
            let lastItemsString = $.getdata(lastItemsKey) || "";
            let lastNamesArr = lastItemsString ? lastItemsString.split(",") : [];

            if (savedDate !== today) {
                savedDate = today;
                notifyCount = 0;
                lastNamesArr = []; 
                $.setdata(savedDate, dateKey);
            }
            let hasNewItem = currentNamesArr.some(name => !lastNamesArr.includes(name));

            if (hasNewItem) {
                console.log("👀 检测到有新的商品上架（或重新上架），重置弹窗次数！");
                notifyCount = 0; 
            }
            $.setdata(currentNamesArr.join(","), lastItemsKey);

            if (notifyCount < 1) {
                $.notify("💰 乐仔补货啦！", "", msg);
                notifyCount++;
                $.setdata(notifyCount.toString(), countKey);
                console.log(msg);
                console.log(`🔔 今日已弹窗通知 ${notifyCount} 次（当前商品状态）`);
            } else {
                console.log(`🤫 仍是这些商品有货，当前状态今日弹窗已达1次，停止打扰。`);
                console.log(msg); 
            }
            
        } else {
            console.log("😴 巡检完成：目前所有现金类商品均无货。");
            $.setdata("", "lz_last_items");
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
    
    this.getdata = (key) => {
        if (isSurge || isLoon) return $persistentStore.read(key);
        if (isQX) return $prefs.valueForKey(key);
    };
    
    this.setdata = (val, key) => {
        if (isSurge || isLoon) return $persistentStore.write(val, key);
        if (isQX) return $prefs.setValueForKey(val, key);
    };
    
    this.done = (value = {}) => {
        if (typeof $done !== "undefined") $done(value);
    };
}
