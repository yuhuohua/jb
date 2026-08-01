/**
 * 接口由贰月红大佬提供
 */

let isSilent = false;
let accounts = [];

const arg = typeof $argument !== 'undefined' ? $argument : '';
const isPanelContext = (typeof $script !== 'undefined' && $script.type === 'panel') || (typeof $input !== 'undefined' && $input.purpose === 'panel');

if (arg) {
  const trimmedArg = arg.trim();

  if (/silent\s*=\s*(?:#|1|true)/i.test(trimmedArg)) {
    isSilent = true;
  }

  const cleanArg = trimmedArg.replace(/&?\s*silent\s*=\s*[^&]*/i, '').trim();
  const parts = cleanArg.split(/[\s#&,]+/);

  parts.forEach(p => {
    const part = p.trim();
    if (part.includes(':')) {
      if (!part.includes('{') && !part.includes('}')) {
        const cleanPart = part.replace(/(phone|account|pwd|password|token\s*)=\s*/gi, '');
        const [phone, pwd, token] = cleanPart.split(':').map(s => s ? s.trim() : '');
        if (phone && pwd && token && phone !== '#' && pwd !== '#' && token !== '#') {
          accounts.push({ phone, pwd, token });
        }
      }
    }
  });
}

if (accounts.length === 0) {
  if (isPanelContext) {
    $done({
      title: "电信营业厅",
      content: "📭 未配置任何有效账号\n请在编辑参数中填写“手机号:服务密码:Token”",
      icon: "simcard.fill",
      "icon-color": "#999999"
    });
  } else {
    $done();
  }
}

(async () => {
  if (isPanelContext) {
    console.log(`📊 面板刷新 | 共 ${accounts.length} 个有效账号`);

    const lines = [];
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      console.log(`  ↳ 查询尾号 ${acc.phone.slice(-4)} ...`);
      try {
        const info = await querySingleAccount(acc.phone, acc.pwd, acc.token, true); // 静默，不弹通知
        lines.push(`📱 尾号${info.suffix}: ${info.summary}`);
      } catch (err) {
        lines.push(`📱 尾号${acc.phone.slice(-4)}: ❌ ${err.message}`);
      }
      if (i < accounts.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    const content = lines.join('\n\n');
    $done({
      title: "电信营业厅",
      content: content || "无数据",
      icon: "simcard.fill",
      "icon-color": "#0066cc"
    });

  } else {
    console.log(`🚀 Cron 触发 | 共 ${accounts.length} 个账号`);

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      console.log(`\n🔹 [${i + 1}/${accounts.length}] 查询 ${acc.phone}`);
      try {
        const info = await querySingleAccount(acc.phone, acc.pwd, acc.token, isSilent);
      } catch (err) {
        console.log(`❌ 账号 ${acc.phone} 失败: ${err.message}`);
        if (!isSilent) {
          $notification.post(
            "电信营业厅 ❌", 
            `手机号: ${acc.phone}`, 
            err.message,
            { "icon": "simcard.fill", "icon-color": "#FF3B30" }
          );
        }
      }
      if (i < accounts.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    console.log("\n============== 电信所有账号处理完毕 ==============");
    $done();
  }
})();

function querySingleAccount(phone, pwd, token, silent) {
  const url = `https://api.iosxx.cn/dxcx.php?ChinaTelecom=${phone}*${pwd}*${token}`;

  return new Promise((resolve, reject) => {
    $httpClient.get(url, function (error, response, data) {
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

            let summary = `💰${balance} | 📶总${totalFlow} | 🌐通用${commonFlow} | 📞语音${voice}`;
            if (d.special_flow) {
              summary += ` | 📺定向${d.special_flow.balance}${d.special_flow.unit}`;
            }

            if (!silent) {
              let title = `电信营业厅 (尾号${suffix})`;
              let subtitle = `💰 话费余额: ${balance}`;
              let notifyDetail = `📶 总流量: 剩余 ${totalFlow}\n🌐 通用: 剩余 ${commonFlow}\n📞 语音: 剩余 ${voice}`;
              if (d.special_flow) {
                notifyDetail += `\n📺 定向: 剩余 ${d.special_flow.balance} ${d.special_flow.unit}`;
              }
              
              $notification.post(
                title, 
                subtitle, 
                notifyDetail,
                { "icon": "simcard.fill", "icon-color": "#0066cc" }
              );
            }

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
