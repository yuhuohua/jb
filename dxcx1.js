/**
 * 接口由贰月红大佬提供，感谢贰月红大佬
 */
let isSilent = false;
let accounts = [];


const arg = typeof $argument !== 'undefined' ? $argument : '';

if (arg) {
  let argStr = typeof arg === "string" ? arg : (arg !== null ? JSON.stringify(arg) : "");
  
  if (argStr.includes("silent=#") || argStr.toLowerCase().includes("true") || argStr.includes("silent=1")) {
    isSilent = true;
  }

  if (Array.isArray(arg)) {
    arg.forEach(item => {
      if (typeof item === 'string' && item.includes(':')) {
        const [phone, pwd] = item.split(':').map(s => s.trim());
        if (phone && pwd) accounts.push({ phone, pwd });
      }
    });
  } else if (typeof arg === 'object') {
    for (let key in arg) {
      let val = arg[key];
      if (typeof val === 'string' && val.includes(':')) {
        const [phone, pwd] = val.split(':').map(s => s.trim());
        if (phone && pwd) accounts.push({ phone, pwd });
      }
    }
  } else if (typeof arg === 'string') {
    const trimmedArg = arg.trim();
    if (trimmedArg.includes('#')) isSilent = true;

    const cleanArg = trimmedArg.replace(/&?silent=[^&]*/g, '').replace('#', '').trim();
    const parts = cleanArg.split(/[\s&,]+/);
    
    parts.forEach(p => {
      if (p.includes(':')) {
        let pair = p.includes('=') ? p.split('=')[1] : p;
        const [phone, pwd] = pair.split(':').map(s => s.trim());
        if (phone && pwd) accounts.push({ phone, pwd });
      }
    });
  }
}

if (accounts.length === 0) {
  if (!isSilent) $notification.post("电信营业厅", "❌ 配置错误", "未检测到任何有效的 手机号:服务密码 配置");
  $done({ title: "电信营业厅", content: "❌ 配置错误: 请检查插件参数", icon: "simcard.fill", "icon-color": "#FF3B30" });
}

(async () => {
  console.log(`🚀 电信查询开始 | 共检测到 ${accounts.length} 个账号`);
  console.log(`💡 当前运行模式: ${isSilent ? '🤫 静默模式' : '🔔 通知模式'}`);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    console.log(`\n🔹 [${i + 1}/${accounts.length}] 正在查询手机号: ${acc.phone}`);
    
    try {
      await checkTelecom(acc.phone, acc.pwd, isSilent);
    } catch (err) {
      console.log(`❌ 账号 [${acc.phone}] 查询失败: ${err.message}`);
      if (!isSilent) $notification.post("电信营业厅 ❌", `手机号: ${acc.phone}`, err.message);
    }

    if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n============== 电信所有账号处理完毕 ==============");
  $done();
})();

function checkTelecom(phone, pwd, isSilent) {
  const url = `https://api.iosxx.cn/dx.php?ChinaTelecom=${phone}*${pwd}`;
  
  return new Promise((resolve, reject) => {
    $httpClient.get(url, function(error, response, data) {
      if (error) return reject(new Error(`网络错误: ${error}`));
      
      try {
        let res = JSON.parse(data);
        if (res.status === "success" && res.results && res.results.length > 0) {
          let resultInfo = res.results[0];
          
          if (resultInfo.success && resultInfo.data) {
            let d = resultInfo.data;
            let maskPhone = d.masked_phonenum || phone;
            let suffix = maskPhone.length > 4 ? maskPhone.slice(-4) : maskPhone;
            
            let balance = d.balance ? `${d.balance.amount} ${d.balance.unit}` : "未知";
            let voice = d.voice ? `${d.voice.balance}/${d.voice.total} ${d.voice.unit}` : "未知";
            let totalFlow = d.total_flow ? `${d.total_flow.balance}/${d.total_flow.total} ${d.total_flow.unit}` : "未知";
            let commonFlow = d.common_flow ? `${d.common_flow.balance} ${d.common_flow.unit}` : "未知";
            
            let title = `电信营业厅 (尾号${suffix})`;
            let subtitle = `💰 话费余额: ${balance}`;
            let detail = `📶 总流量: 剩余 ${totalFlow}\n` +
                         `🌐 通用: 剩余 ${commonFlow} |\n` +
                         `📞 语音: 剩余 ${voice}`;
                         
            if (d.special_flow) {
                detail += `\n📺 定向: 剩余 ${d.special_flow.balance} ${d.special_flow.unit}`;
            }
            

            if (!isSilent) {
                $notification.post(title, subtitle, detail);
            }
            console.log(`✅ 账号 [${phone}] 数据解析成功！`);
            resolve();
          } else {
            reject(new Error(resultInfo.error || "接口未返回有效数据"));
          }
        } else {
          reject(new Error("接口状态非 success"));
        }
      } catch (e) {
        reject(new Error(`JSON解析失败: ${e.message}`));
      }
    });
  });
}
