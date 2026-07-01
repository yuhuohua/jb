const $ = new Env("🎫 乐仔生活 Token 检测");

(async () => {
  let accounts = [];
  const arg = typeof $argument !== 'undefined' ? $argument : "";

  if (arg) {
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      for (let key in arg) {
        if (key.toUpperCase().startsWith("ACCOUNT") && arg[key]) {
          parseAccount(arg[key], accounts);
        }
      }
    } else {
      const rawArr = String(arg).split('#').map(v => v.trim()).filter(v => v && v !== "null" && v !== "undefined");
      rawArr.forEach(entry => parseAccount(entry, accounts));
    }
  }

  if (accounts.length === 0) {
    console.log("❌ 未配置任何账号，请检查参数设置。");
    $.done();
    return;
  }

  console.log(`🎫 ${$.name} | 账号数: ${accounts.length}`);
  for (const acc of accounts) {
    console.log(`   ➤ 加载账号: ${acc.label}`);
  }

  let failedAccounts = []; 

  for (let i = 0; i < accounts.length; i++) {
    try {
      await checkToken(accounts[i], failedAccounts);
    } catch (e) {
      console.log(`❌ [账号：${accounts[i].label}] 异常: ${e.message || e}`);
      failedAccounts.push(`👤 ${accounts[i].label}：执行异常`);
    }
    if (i < accounts.length - 1) await $.wait(Math.floor(Math.random() * 1000) + 1000);
  }

  if (failedAccounts.length > 0) {
    console.log("\n⚠️ 检测到失效账号，准备发送通知...");
    $.msg(
      $.name, 
      "⚠️ 发现失效 Token，请及时更新", 
      failedAccounts.join('\n\n')
    );
  } else {
    console.log("\n✅ 所有 Token 均有效，静默运行，不弹窗。");
  }

  $.done();
})();

function parseAccount(entry, arr) {
  if (!entry || entry === "null" || entry === "undefined") return;
  const str = String(entry).trim();
  if (!str) return;
  const idx = str.indexOf('&');
  if (idx > 0) {
    const label = str.substring(0, idx).trim();
    const token = str.substring(idx + 1).trim();
    if (token) arr.push({ label: label || "未命名", token });
  } else {
    arr.push({ label: "账号" + (arr.length + 1), token: str });
  }
}

function checkToken(acc, failedAccounts) {
  const { label, token } = acc;
  return new Promise((resolve) => {
    const url = `http://152.136.162.202/ScriptPanel/lzshcheck.php?xiaoletoken=${token}`;
    const headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    };

    $.get({ url, headers, timeout: 10000 }, (err, resp, data) => {
      if (err || !data) {
        console.log(`[账号：${label}] 请求失败: ${err || '网络超时或无数据'}`);
        failedAccounts.push(`👤 ${label}：请求超时或失败`);
        return resolve();
      }

      const expireMatch = data.match(/过期时间：([\d-]+\s[\d:]+)/);
      const expireTime = expireMatch ? expireMatch[1] : "未知";

      console.log(`\n===== 🎫 [账号：${label}] 校验结果 =====`);
      if (data.includes('✅ Token 有效')) {
        console.log(`状态: ✅ Token 正常有效`);
        console.log(`过期时间: ${expireTime}`);
      } else if (data.includes('❌ 失效')) {
        console.log(`状态: ❌ Token 已失效`);
        failedAccounts.push(`👤 ${label}：Token 已失效 ❌`);
      } else {
        console.log(`状态: ⚠️ 无法判断状态，可能接口格式有变`);
        failedAccounts.push(`👤 ${label}：接口返回未知状态 ⚠️`);
      }
      console.log(`======================================\n`);
      
      resolve();
    });
  });
}


function Env(t,e){"undefined"!=typeof process&&JSON.stringify(process.env).indexOf("GITHUB")>-1&&process.exit(0);class s{constructor(t){this.env=t}write(t,e){return this.env.setdata(t,e)}read(t,e){return this.env.getdata(t,e)}fetch(t){return new Promise((e,s)=>{this.env.get(t,(t,r,i)=>{e({error:t,response:r,body:i})})})}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}toObj(t,e=null){try{return JSON.parse(t)}catch{return e||t}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e||t}}getjson(t,e){let s=e;const r=this.getdata(t);if(r)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,r)=>e(r))})}runScript(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null,this.getScript(t).then(t=>{this.setdata(t,"__chavy_tmp"),this.runScriptContent(t,e).then(t=>s(t))})})}runScriptContent(t,e){return new Promise(s=>{let r=this.getdata("@chavy_boxjs_userCfgs.httpapi");r=r?r.replace(/\n/g,"").trim():r;let i=this.isSurge()?Object.keys($httpClient).length:0;r=this.isQuanX()||this.isLoon()&&i?r:null;try{$=this,eval(t),s("")}catch(t){this.logErr(t),s("")}})}write(t,e){return this.setdata(t,e)}read(t,e){return this.getdata(t,e)}setdata(t,e){let s=!1;if(this.isSurge()||this.isLoon()){if($persistentStore.write(t,e))s=!0}else this.isNode()&&(this.data=this.loaddata(),this.data[e]=t,this.writedata(),s=!0);if(this.isQuanX()){if($prefs.setValueForKey(t,e))s=!0}return s}getdata(t){let e=null;if(this.isSurge()||this.isLoon())e=$persistentStore.read(t);else if(this.isQuanX())e=$prefs.valueForKey(t);else if(this.isNode()){this.data=this.loaddata(),e=this.data[t]}return e}loaddata(){return new Promise(t=>{let e={};if(this.isNode()){const s=require("fs"),r=require("path"),i=r.resolve(this.dataFile),o=r.resolve(process.cwd(),this.dataFile),n=s.existsSync(i),a=!n&&s.existsSync(o);if(!n&&!a)return;const h=n?i:o;try{e=JSON.parse(s.readFileSync(h))}catch{}}t(e)})}writedata(){if(this.isNode()){const t=require("fs"),e=require("path"),s=e.resolve(this.dataFile),r=e.resolve(process.cwd(),this.dataFile),i=t.existsSync(s),o=!i&&t.existsSync(r),n=i?s:r;t.writeFileSync(n,JSON.stringify(this.data))}}msg(t,e,s,r){if(this.isSurge()||this.isLoon())$notification.post(t,e,s,r);else if(this.isQuanX())$notify(t,e,s,r);else if(this.isNode()){console.log(e);if(s)console.log(s)}this.logs.push("",t,e,s)}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}get(t,e){this.send(t,"GET",e)}post(t,e){this.send(t,"POST",e)}send(t,e,s){if(this.isSurge()||this.isLoon()){const r=$httpClient;r[e.toLowerCase()](t,(t,e,r)=>{!t&&e&&(e.body=r,e.statusCode=e.status),s(t,e,r)})}else this.isQuanX()&&(t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:e,statusCode:r,headers:i,body:o}=t;s(null,{status:e,statusCode:r,headers:i,body:o},o)},t=>s(t)))}}(t,e)}
