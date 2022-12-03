// const sc=("/sc 1 01922091").split(" ")
// const re = /^[0-9]+$/
// if(!sc[1]||!sc[2]){
//     console.log("卡密：\n1️⃣500坨粑粑\n\n2️⃣1000坨卡密\n\n3️⃣31天会员卡\n\n4️⃣365天会员卡\n生成格式：\n/sc [卡密序号] [生成数量]\n👆不需要带中括号",'Markdown')
// }else if(!re.test(sc[1]) || !re.test(sc[2])){
//     console.log("卡密：\n1️⃣500坨粑粑\n\n2️⃣1000坨卡密\n\n3️⃣31天会员卡\n\n4️⃣365天会员卡\n生成格式：\n/sc [卡密序号] [生成数量]\n👆不需要带中括号",'Markdown')
// }else if(sc[2]*1<1){
//     console.log("生成失败❌，最小生成数量为1",'Markdown')
// }else{
//     console.log(sc[2]*5)
// }
const dur=((new Date(Date.now())*1-1662562783242)/1000).toFixed(0)
console.log(300-dur)