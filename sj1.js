const $ = new Env("声荐参数调试");

// 1. 原始参数捕获
const rawArgument = (typeof $argument !== "undefined") ? $argument : "未定义(undefined)";
const typeOfArg = typeof rawArgument;

// 2. 解析逻辑探测
const ARGS = (() => {
    let args = { notify: "未解析成功" }; 
    if (typeof $argument !== "undefined" && $argument) {
        // 尝试不同的解析方式并记录
        let str = String($argument).trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, "");
        args.notify = str.split(",")[0] || "0";
    }
    return args;
})();

const currentHour = new Date().getHours();
const LAST_RUN_HOUR = 22; // 你的汇总时间
const isLastRun = currentHour === LAST_RUN_HOUR;

// 3. 日志打印 (这是核心)
console.log("============== 调试日志开始 ==============");
console.log(`[系统原始参数] 内容: ${JSON.stringify(rawArgument)}`);
console.log(`[系统原始参数] 类型: ${typeOfArg}`);
console.log(`[解析后的结果] notify值: "${ARGS.notify}" (类型: ${typeof ARGS.notify})`);
console.log(`[当前系统时间] ${currentHour}点`);
console.log(`[汇总时间判断] 是否为22点汇总时间: ${isLastRun}`);
console.log("------------------------------------------");

// 4. 模拟逻辑判定
console.log("[逻辑模拟测试]:");
if (ARGS.notify === "1") {
    console.log(">>> 判定结果: 匹配到模式 [1] -> 应该发送【单次通知】");
} else if (isLastRun) {
    console.log(">>> 判定结果: 匹配到模式 [0] 且时间符合 -> 应该发送【全天汇总】");
} else {
    console.log(">>> 判定结果: 匹配到模式 [0] 且时间不符合 -> 【静默，不发通知】");
}

if (ARGS.notify == 1 && ARGS.notify !== "1") {
    console.log(">>> 警告: 参数是数字1而不是字符串'1'，可能导致严格匹配失败");
}

console.log("============== 调试日志结束 ==============");

$.done();

// Env 简易实现
function Env(name) {
  this.name = name;
  this.done = (v = {}) => typeof $done !== "undefined" && $done(v);
}
