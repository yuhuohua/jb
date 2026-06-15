const $ = new Env("🎵 酷狗金币数据");

(async () => {
  let accounts = [];
  let count = 5;      
  let showTotalPopup = true; 
  const arg = typeof $argument !== 'undefined' ? $argument : "";
  
  const isPanel = typeof $script !== 'undefined' && $script.type === 'generic';

  if (arg) {
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      if (arg.COUNT) count = parseInt(arg.COUNT) || 5;
      if (arg.TOTAL_SWITCH) showTotalPopup = arg.TOTAL_SWITCH === "true" || arg.TOTAL_SWITCH === true;
      for (let key in arg) {
        if (key.toUpperCase().startsWith("ACCOUNT") && arg[key]) {
          parseAccount(arg[key], accounts);
        }
      }
    } else {
      let strArg = String(arg).trim();
      if (strArg.startsWith('[') && strArg.endsWith(']')) {
        strArg = strArg.slice(1, -1);
      }
      
      let rawArr = strArg.includes('@') ? strArg.split('@') : strArg.split(',');
      rawArr = rawArr.map(v => v.trim()).filter(v => v && v !== "null" && v !== "undefined");
      
      if (rawArr.length > 0 && !isNaN(rawArr[0])) {
        count = parseInt(rawArr.shift()) || 5;
      }
      if (rawArr.length > 0 && (rawArr[0] === "" || rawArr[0] === "#")) {
        showTotalPopup = rawArr.shift() === "";
      }
      
      rawArr.forEach(entry => parseAccount(entry, accounts));
    }
  }

  if (accounts.length === 0) {
    if (isPanel) {
      $done({ title: "🎵 酷狗金币数据", content: "❌ 未配置账号参数" });
    } else {
      $.msg($.name, "❌ 配置错误", "请按格式填写账号，如：标签&ck#UID");
      $.done();
    }
    return;
  }

  console.log(`🎬 ${$.name} | 面板模式: ${isPanel} | 历史拉取数: ${count} | 汇总开关: ${showTotalPopup} | 账号数: ${accounts.length}`);
  
  let panelLines = [];
  let globalTotalWithdraw = 0;
  let todayTotalWithdraw = 0;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  for (let i = 0; i < accounts.length; i++) {
    try {
      await checkBalance(accounts[i], count, isPanel, panelLines, todayStr, (gw, tw) => {
        globalTotalWithdraw += gw;
        todayTotalWithdraw += tw;
      });
    } catch (e) {
      console.log(`❌ [账号：${accounts[i].label}] 异常: ${e.message || e}`);
    }
    if (i < accounts.length - 1) await $.wait(Math.floor(Math.random() * 2000) + 1000);
  }

  if (isPanel) {
    const panelContent = panelLines.join("\n") + 
                         `\n\n💰 今日提现总额：¥${todayTotalWithdraw.toFixed(2)}` +
                         `\n🏦 累计提现总额：¥${globalTotalWithdraw.toFixed(2)}`;
    
    $done({
      title: "🎵 酷狗金币数据",
      content: panelContent,
      icon: "music.note.list",
      "icon-color": "#108ee9"
    });
  } else {
    if (showTotalPopup && accounts.length > 0) {
      $.msg(`${$.name} 汇总`, "✅ 所有账号查询结束", `💰 全部账号已提现总额汇总：¥${globalTotalWithdraw.toFixed(2)}`);
    }
    $.done();
  }
})();

function parseAccount(entry, arr) {
  if (!entry || entry === "null" || entry === "undefined") return;
  const str = String(entry).trim();
  if (!str) return;
  const idx = str.indexOf('&');
  if (idx > 0) {
    const label = str.substring(0, idx).trim();
    const openid = str.substring(idx + 1).trim();
    if (openid) arr.push({ label: label || "未命名", openid });
  } else {
    arr.push({ label: "未命名", openid: str });
  }
}

function checkBalance(acc, count, isPanel, panelLines, todayStr, accumulator) {
  const { label, openid } = acc;
  return new Promise((resolve) => {
    let safeOpenid = openid.replace(/#/g, '%23');
    let queryStr = safeOpenid;
    if (queryStr.includes('count=')) {
      queryStr = queryStr.replace(/count=\d+/, `count=${count}`);
    } else {
      queryStr += `&count=${count}`;
    }
    
    const url = `http://152.136.162.202/kugou/kgcx.php?ck=${queryStr}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1"
    };

    $.get({ url, headers, timeout: 10000 }, (err, resp, data) => {
      if (err || !data) {
        console.log(`[账号：${label}] 请求失败: ${err || '无数据'}`);
        if (isPanel) {
            panelLines.push(`${label} ❌ 请求失败`);
        } else {
            $.msg($.name, `👤 账号: ${label}`, `❌ 请求失败，请检查网络或参数配置`);
        }
        return resolve();
      }

      console.log(`\n===== 🎵 [账号：${label}] 详细日志 =====`);
      console.log(data);
      console.log(`====================================\n`);

      let uid = "未知", curGold = "0", curMoney = "0.00", historyGold = "0", historyMoney = "0.00", cash = "0.00", totalWithdraw = "0.00", countWithdraw = "0";
      
      let mUid = data.match(/👤 账号:\s*(\d+)/); if(mUid) uid = mUid[1];
      let mCur = data.match(/💰 当前金币(?:余额)?:\s*([\d,]+)\s*金币\s*\(.*?([\d\.]+).*?\)/); if(mCur) { curGold = mCur[1]; curMoney = mCur[2]; }
      let mHis = data.match(/📈 历史获得总金币:\s*([\d,]+)\s*金币\s*\(.*?([\d\.]+).*?\)/); if(mHis) { historyGold = mHis[1]; historyMoney = mHis[2]; }
      let mCash = data.match(/💵 现金余额:\s*¥?(.*?)(?=\n|$)/); if(mCash) cash = mCash[1].trim();
      let mTw = data.match(/💸 已提现总额:\s*¥?(.*?)\s*\((.*?)笔\)/); if(mTw) { totalWithdraw = mTw[1].trim(); countWithdraw = mTw[2].trim(); }

      if (!isPanel) {
        let popupText = `💰 当前金币余额: ${curGold} 金币 (¥${curMoney})\n` +
                        `📈 历史获得总金币: ${historyGold} 金币 (¥${historyMoney})\n` +
                        `💵 现金余额: ¥${cash}\n` +
                        `💸 已提现总额: ¥${totalWithdraw} (${countWithdraw} 笔)`;
        $.msg($.name, `👤 ${label}`, popupText);
      }

      let accTotalWithdrawNum = parseFloat(totalWithdraw.replace(/,/g, '')) || 0;
      let accTodayWithdrawNum = 0;
      let todayRecordStr = "今日无提现记录";
      
      let splitStr = data.split(/💸 历史提现明细/);
      if (splitStr.length > 1) {
        let lines = splitStr[1].split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let todayLines = lines.filter(l => l.includes(todayStr));
        
        if (todayLines.length > 0) {
          let firstRecord = todayLines[0]; 
          let moneyMatch = firstRecord.match(/¥\s*([\d\.]+)/) || firstRecord.match(/提现([\d\.]+)元/);
          let recordMoneyStr = "¥0.00";
          
          if (moneyMatch) {
            let moneyNum = parseFloat(moneyMatch[1]) || 0;
            accTodayWithdrawNum = moneyNum; 
            recordMoneyStr = `¥${moneyNum.toFixed(2)}`;
          }
          
          let timeMatch = firstRecord.match(/\d{2}:\d{2}/);
          let timeStr = timeMatch ? timeMatch[0] : "";
          
          todayRecordStr = `${todayStr} ${timeStr}  ${recordMoneyStr}`.replace(/\s+/g, ' ');
        }
      }

if (isPanel) {
        panelLines.push(`👤 ${label} | ${todayRecordStr}`);
      }
      
      accumulator(accTotalWithdrawNum, accTodayWithdrawNum);
      resolve();
    });
  });
}

function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){console.log(e);if(s)console.log(s)}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
