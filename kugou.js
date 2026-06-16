const $ = new Env("🎵 酷狗金币数据");

(async () => {
  let accounts = [];
  let count = 5;      
  let showTodayPopup = true; 
  let showTotalPopup = true; 
  let showAccountPopup = true; 
  const arg = typeof $argument !== 'undefined' ? $argument : "";
  const isPanel = typeof $script !== 'undefined' && $script.type === 'generic';

  if (arg) {
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      if (arg.COUNT) count = parseInt(arg.COUNT) || 5;
      if (arg.TODAY_SWITCH) showTodayPopup = arg.TODAY_SWITCH !== "#" && arg.TODAY_SWITCH !== "false";
      if (arg.TOTAL_SWITCH) showTotalPopup = arg.TOTAL_SWITCH !== "#" && arg.TOTAL_SWITCH !== "false";
      if (arg.ACCOUNT_SWITCH) showAccountPopup = arg.ACCOUNT_SWITCH !== "#" && arg.ACCOUNT_SWITCH !== "false";
      for (let key in arg) {
        if (key.toUpperCase().startsWith("ACCOUNT") && arg[key]) {
          parseAccount(arg[key], accounts);
        }
      }
    } else {
      let strArg = String(arg).trim();
      if (strArg.startsWith('[') && strArg.endsWith(']')) strArg = strArg.slice(1, -1);
      
      let rawArr = strArg.includes('@') ? strArg.split('@') : strArg.split(',');
      rawArr = rawArr.map(v => v.trim());
      
      let configParams = [];
      while (rawArr.length > 0 && (rawArr[0] === "" || rawArr[0] === "#" || (!isNaN(rawArr[0]) && rawArr[0] !== ""))) {
        configParams.push(rawArr.shift());
      }
      
      if (configParams.length > 0 && configParams[0] !== "") count = parseInt(configParams[0]) || 5;
      if (configParams.length > 1) showTodayPopup = configParams[1] !== "#";
      if (configParams.length > 2) showTotalPopup = configParams[2] !== "#";
      if (configParams.length > 3) showAccountPopup = configParams[3] !== "#";
      
      rawArr = rawArr.filter(v => v && v !== "null" && v !== "undefined");
      rawArr.forEach(entry => parseAccount(entry, accounts));
    }
  }

  if (accounts.length === 0) {
    if (isPanel) $done({ title: "🎵 酷狗金币数据", content: "❌ 未配置账号参数" });
    else { $.msg($.name, "❌ 配置错误", "请按格式填写账号"); $.done(); }
    return;
  }

  console.log(`🎬 ${$.name} | 面板模式: ${isPanel} | 明细数: ${count} | 账号开关: ${showAccountPopup} | 今日开关: ${showTodayPopup} | 累计开关: ${showTotalPopup} | 账号数: ${accounts.length}`);
  
  let panelLines = [];
  let globalTotalWithdraw = 0;
  let todayTotalWithdraw = 0;
  let todayWithdrawDetails = [];
  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < accounts.length; i++) {
    try {
      await checkBalance(accounts[i], i + 1, count, isPanel, showAccountPopup, panelLines, todayStr, (gw, tw) => {
        globalTotalWithdraw += gw;
        todayTotalWithdraw += tw;
        if (tw > 0) {
            todayWithdrawDetails.push({ idx: i + 1, amount: tw });
        }
      });
    } catch (e) {
      console.log(`❌ [账号：${accounts[i].label}] 异常: ${e.message || e}`);
    }
    if (i < accounts.length - 1) await $.wait(1500); 
  }

  if (isPanel) {
    const panelContent = panelLines.join("\n") + 
                         `\n\n💰 今日提现总额：¥${todayTotalWithdraw.toFixed(2)}` +
                         `\n🏦 累计提现总额：¥${globalTotalWithdraw.toFixed(2)}`;
    $done({ title: "🎵 酷狗金币数据", content: panelContent, icon: "music.note.list", "icon-color": "#108ee9" });
  } else {
    if (accounts.length > 0) {
      if (showTodayPopup) {
        await $.wait(500);
        let detailText = "";
        if (todayWithdrawDetails.length > 0) {
            detailText = "\n";
            for (let i = 0; i < todayWithdrawDetails.length; i += 3) {
                let row = todayWithdrawDetails.slice(i, i + 3).map(item => {
                    let str = `${item.idx}: ¥${item.amount}`;
                    return str.padEnd(10, ' ');
                }).join("   "); 
                detailText += row.trimEnd() + "\n";
            }
        }
        $.msg(`${$.name} 今日汇总`, "✅ 今日提现查询结束", `💰 全部账号今日提现总额：¥${todayTotalWithdraw.toFixed(2)}${detailText}`);
      }
      
      if (showTotalPopup) {
        await $.wait(500);
        $.msg(`${$.name} 累计汇总`, "✅ 历史查询结束", `🏦 全部账号已提现总额汇总：¥${globalTotalWithdraw.toFixed(2)}`);
      }
    }
    $.done();
  }
})();

function parseAccount(entry, arr) {
  if (!entry) return;
  const idx = entry.indexOf('&');
  if (idx > 0) arr.push({ label: entry.substring(0, idx).trim() || "未命名", openid: entry.substring(idx + 1).trim() });
  else arr.push({ label: "未命名", openid: entry.trim() });
}

function checkBalance(acc, index, count, isPanel, showAccountPopup, panelLines, todayStr, accumulator) {
  const { label, openid } = acc;
  return new Promise((resolve) => {
    let safeOpenid = openid.replace(/#/g, '%23');
    let queryStr = safeOpenid.includes('count=') ? safeOpenid.replace(/count=\d+/, `count=${count}`) : `${safeOpenid}&count=${count}`;
    
    const url = `http://152.136.162.202/kugou/kgcx.php?ck=${queryStr}`;
    const headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1" };

    $.get({ url, headers, timeout: 10000 }, (err, resp, data) => {
      if (err || !data || !data.includes("当前金币")) {
        if (isPanel) panelLines.push(`🔹 ${label} ❌ 失效/失败`);
        else if (showAccountPopup) $.msg($.name, `👤 账号${index}: ${label}`, `❌ Token已失效或请求失败，请检查账号ck配置！`);
        return resolve();
      }

      console.log(`\n===== 🎵 [账号${index}：${label}] 详细日志 =====\n${data}\n====================================\n`);

      let curGold = data.match(/💰 当前金币(?:余额)?:\s*([\d,]+)/)?.[1] || "0";
      let curMoney = data.match(/约(.*?)元/)?.[1] || "0.00";
      let historyGold = data.match(/📈 历史获得总金币:\s*([\d,]+)/)?.[1] || "0";
      let historyMoney = data.match(/历史获得.*?约(.*?)元/)?.[1] || "0.00";
      let cash = data.match(/💵 现金余额:\s*¥?(.*?)(?=\n|$)/)?.[1] || "0.00";
      let mTw = data.match(/💸 已提现总额:\s*¥?(.*?)\s*\((.*?)笔\)/);
      let totalWithdraw = mTw?.[1]?.trim() || "0.00";
      let countWithdraw = mTw?.[2]?.trim() || "0";

      let accTotalWithdrawNum = parseFloat(totalWithdraw.replace(/,/g, '')) || 0;
      let accTodayWithdrawNum = 0;
      let todayRecordStr = "今日无提现记录";
      
      let splitStr = data.split(/💸 历史提现明细/);
      if (splitStr.length > 1) {
        let todayLines = splitStr[1].split('\n').map(l => l.trim()).filter(l => l.includes(todayStr));
        if (todayLines.length > 0) {
          let moneyMatch = todayLines[0].match(/¥\s*([\d\.]+)/) || todayLines[0].match(/提现([\d\.]+)元/);
          if (moneyMatch) {
            accTodayWithdrawNum = parseFloat(moneyMatch[1]) || 0;
            todayRecordStr = `${todayLines[0].match(/\d{2}:\d{2}/)?.[0] || ""} ¥${accTodayWithdrawNum.toFixed(2)}`.trim();
          }
        }
      }

      if (!isPanel && showAccountPopup) {
        if (accTodayWithdrawNum > 0) {
          let popupText = `💰 今日提现金额: ¥${accTodayWithdrawNum.toFixed(2)}\n` +
                          `💰 当前金币余额: ${curGold} 金币 (¥${curMoney})\n` +
                          `📈 历史获得金币: ${historyGold} 金币 (¥${historyMoney})\n` +
                          `💵 平台现金余额: ¥${cash}\n` +
                          `💸 累计已提现额: ¥${totalWithdraw} (${countWithdraw} 笔)`;
          $.msg($.name, `👤 账号${index}: ${label}`, popupText);
        }
      }

      if (isPanel) panelLines.push(`👤 ${label} | ${todayRecordStr}`);
      
      accumulator(accTotalWithdrawNum, accTodayWithdrawNum);
      resolve();
    });
  });
}

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){console.log(e);if(s)console.log(s)}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
