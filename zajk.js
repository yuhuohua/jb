const $ = new Env("🏥 众安健康");

(async () => {
  let tokens = [];
  let threshold = 5;
  const arg = typeof $argument !== 'undefined' ? $argument : "";
  const isPanel = typeof $script !== 'undefined' && $script.type === 'generic';

  if (isPanel) {
    let cachedData = $.getdata("ZhongAn_Panel_Data");
    if (cachedData) {
      $done({ title: "🏥 众安任务", content: cachedData, icon: "cross.case.fill", "icon-color": "#FF69B4" });
    } else {
      $done({ title: "🏥 众安任务", content: "⏳ 暂无数据，请等待后台定时任务运行完毕", icon: "cross.case.fill", "icon-color": "#FF69B4" });
    }
    return;
  }

  if (arg) {
    let rawArr = [];
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      if (arg.THRESHOLD) threshold = parseFloat(arg.THRESHOLD);
      for (let key in arg) {
        if (key.toUpperCase().includes("TOKEN") && arg[key]) rawArr.push(arg[key]);
      }
    } else {
      rawArr = (typeof arg === 'string' ? arg.replace(/[\[\]]/g, "").split(/[#,]/) : arg)
        .map(v => String(v).trim())
        .filter(v => v !== "" && v !== "null" && v !== "undefined");
      
      if (rawArr.length > 0 && !isNaN(rawArr[0])) {
        threshold = parseFloat(rawArr.shift());
      }
    }
    tokens = rawArr.filter(t => t !== "" && t !== "null");
  }

  if (tokens.length === 0) {
    $.msg($.name, "❌ 配置错误", "请先在配置中填入 Token");
    $.done();
    return;
  }

  console.log(`🏥 ${$.name} | 门槛: ${threshold}元 | 账号数: ${tokens.length}`);
  
  let panelLines = []; 

  for (let i = 0; i < tokens.length; i++) {
    const accountIdx = i + 1;
    try {
      await runTask(tokens[i], accountIdx, threshold, panelLines);
    } catch (e) {
      console.log(`❌ [账号 ${accountIdx}] 异常: ${e.message || e}`);
      panelLines.push(`👤 账号 ${accountIdx}\n❌ 状态：执行异常\n`);
    }
    if (i < tokens.length - 1) await $.wait(Math.floor(Math.random() * 3000) + 5000);
  }

  if (panelLines.length > 0) {
    let finalPanelContent = panelLines.join('\n').trim();
    $.setdata(finalPanelContent, "ZhongAn_Panel_Data");
    console.log("✅ 最新面板数据已储存至持久化缓存");
  }

  $.done();
})();

function runTask(token, idx, threshold, panelLines) {
  return new Promise((resolve) => {
    const url = `https://api.iosxx.cn/zajkcx.php?token=${token}`;
    const headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" };

    $.get({ url, headers, timeout: 10000 }, (err, resp, data) => {
      let notifyMsg = "";
      let amount = 0;
      let totalAmountStr = "0.00";
      let cashAmountStr = "0.00";
      let phoneStr = "未知";

      if (err || !data) {
        notifyMsg = `📡 网络请求失败`;
        panelLines.push(`👤 账号 ${idx}\n⚠️ 状态：请求超时或失败\n`);
      } else {
        const phoneMatch = data.match(/1\d{2}\**\d{4}/) || data.match(/1\d{10}/);
        if (phoneMatch) phoneStr = phoneMatch[0];

        const totalMatch = data.match(/累计(?:奖励金|活动奖金)[:：]\s*([\d.]+)/) || data.match(/累计.*?([\d.]+)/);
        totalAmountStr = totalMatch ? totalMatch[1] : "0.00";

        const cashMatch = data.match(/可提现(?:金额)?[:：]\s*([\d.]+)/) || data.match(/可提现.*?([\d.]+)/);
        cashAmountStr = cashMatch ? cashMatch[1] : "0.00";
        
        amount = parseFloat(cashAmountStr) || 0;

        notifyMsg = data.length > 200 ? data.substring(0, 200) + "..." : data;

        panelLines.push(`👤 账号：${phoneStr}`);
        panelLines.push(`💰 累计奖励金：${totalAmountStr}元`);
        panelLines.push(`💸 可提现金额：${cashAmountStr}元`);
        panelLines.push(``); 
      }

      console.log(`\n===== 🏥 [账号 ${idx}] 运行结果 =====\n${data}\n==================================\n`);

      if (amount >= threshold) {
        $.msg(`${$.name} [账号 ${idx}]`, `💎 可提现金额: ${amount} 元`, `✨ 达标啦！\n${notifyMsg}`);
      }
      resolve();
    });
  });
}



function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){console.log(e);if(s)console.log(s)}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
