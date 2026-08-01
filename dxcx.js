/**
 * 接口由贰月红大佬提供，感谢贰月红大佬。
 */

let isSilent = false;
let accounts = [];

const arg = typeof $argument !== 'undefined' ? $argument : '';
const isPanelContext = (typeof $script !== 'undefined' && $script.type === 'panel') || (typeof $input !== 'undefined' && $input.purpose === 'panel');

if (arg) {
  let argStr = typeof arg === "string" ? arg : (arg !== null ? JSON.stringify(arg) : "");
  
  if (argStr.includes("silent=#") || argStr.toLowerCase().includes("silent=true") || argStr.includes("silent=1")) {
    isSilent = true;
  }

  const extractAccount = (val) => {
    if (typeof val === 'string' && val.includes(':')) {
      let cleanVal = val;
      if (cleanVal.includes('=')) cleanVal = cleanVal.split('=')[1];
      
      const [phone, pwd, token] = cleanVal.split(':').map(s => s ? s.trim() : '');
      if (phone && pwd && token && phone !== '#' && pwd !== '#' && token !== '#') {
        accounts.push({ phone, pwd, token });
      }
    }
  };

  if (Array.isArray(arg)) {
    arg.forEach(extractAccount);
  } else if (typeof arg === 'object') {
    for (let key in arg) extractAccount(arg[key]);
  } else if (typeof arg === 'string') {
    const trimmedArg = arg.trim();

    const cleanArg = trimmedArg.replace(/&?\s*silent\s*=\s*[^&]*/gi, '').trim();
    const parts = cleanArg.split(/[\s#&,]+/);
    parts.forEach(extractAccount);
  }
}

if (accounts.length === 0) {
  if (isPanelContext) {
    $done({
      title: "电信营业厅",
      content: "❌ 未检测到有效的 手机号:服务密码:Token 配置",
      icon: "simcard.fill",
      "icon-color": "#FF3B30"
    });
  } else {
    if (!isSilent) $notification.post("电信营业厅", "❌ 配置错误", "未检测到任何有效的 手机号:服务密码:Token 配置");
    $done();
  }
}

(async () => {
  if (isPanelContext) {
    console.log(`📊 面板模式 | 共检测到 ${accounts.length} 个账号`);
    const lines = [];
    
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      try {
        const info = await checkTelecom(acc.phone, acc.pwd, acc.token, true); 
        lines.push(`📱 尾号${info.suffix}: ${info.summary}`);
      } catch (err) {
        lines.push(`📱 尾号${acc.phone.slice(-4)}: ❌ ${err.message}`);
      }
      if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }
    
    $done({
      title: "电信营业厅",
      content: lines.join('\n\n') || "无数据",
      icon: "simcard.fill",
      "icon-color": "#0066cc"
    });

  } else {
    console.log(`🚀 定时模式 | 共 ${accounts.length} 个账号`);
    console.log(`💡 当前运行模式: ${isSilent ? '🤫 静默模式' : '🔔 通知模式'}`);

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      console.log(`\n🔹 [${i + 1}/${accounts.length}] 正在查询手机号: ${acc.phone}`);
      
      try {
        await checkTelecom(acc.phone, acc.pwd, acc.token, isSilent);
      } catch (err) {
        console.log(`❌ 账号 [${acc.phone}] 查询失败: ${err.message}`);
        if (!isSilent) {
            $notification.post("电信营业厅 ❌", `手机号: ${acc.phone}`, err.message);
        }
      }

      if (i < accounts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n============== 电信所有账号处理完毕 ==============");
    $done();
  }
})();

function checkTelecom(phone, pwd, token, isSilentFlag) {
  const url = `https://api.iosxx.cn/dxcx.php?ChinaTelecom=${phone}*${pwd}*${token}`;
  
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
            let voice = d.voice ? `${d.voice.balance}/${d.voice.total}${d.voice.unit}` : "未知";
            let totalFlow = d.total_flow ? `${d.total_flow.balance}/${d.total_flow.total}${d.total_flow.unit}` : "未知";
            let commonFlow = d.common_flow ? `${d.common_flow.balance}${d.common_flow.unit}` : "未知";
            
            let detail = `📶总:${totalFlow} | 🌐通用:${commonFlow} | 📞语音:${voice}`;
            if (d.special_flow) {
                detail += ` | 📺定向:${d.special_flow.balance}${d.special_flow.unit}`;
            }
            
            let summary = `💰${balance} | ${detail}`;
            let title = `电信营业厅 (尾号${suffix})`;
            let subtitle = `💰 话费余额: ${balance}`;

            if (!isSilentFlag) {
                $notification.post(title, subtitle, detail);
            }
            
            console.log(`✅ 账号 [${phone}] 数据解析成功！`);
            resolve({ suffix, summary });
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
