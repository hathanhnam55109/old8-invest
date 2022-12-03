const express = require('express');
const request=require("request");
const app = express();
require("events").EventEmitter.defaultMaxListeners=0;
const CONFIG={
  NAME:process.env.NAME,
  TOKEN:process.env.TOKEN,
  TRC:process.env.TRC,
  DB:process.env.DB,
  URL:process.env.URL,
  PAY:process.env.PAY,
  CONTACT:process.env.CONTACT
}
const {MongoClient}=require("mongodb");
const md5 = require('md5-node');
const client=new MongoClient(CONFIG.DB)
const old8=client.db("old8")
const db={
  keycode:old8.collection("keycode"),
  agent:old8.collection("agent"),
  order:old8.collection("order")
}
app.use(express.json())
app.all("*",(req,res,next)=>{
  res.header("Access-Control-Allow-Origin","*")
  res.header("Access-Control-Allow-Methods","GET")
  res.header("Access-Control-Allow-Credentials","true")
  res.header("Access-Control-Allow-Headers", "Origin,No-Cache, X-Requested-With, If-Modified-Since, Pragma, Last-Modified, Cache-Control, Expires, Content-Type, X-E4M-With, userId, token")
  next()
})
let ACTIONS={}
app.get("/",(res,req)=>{
  req.send(CONFIG.NAME+" 搭建成功")
})
app.post("/callback",async(res,req)=>{
  console.log("CALLBACK",res.body)
  await db.agent.updateOne({id:res.body.id*1},{"$inc":{credit:res.body.quant}})
  request({
    url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
    method:"POST",
    headers:{
        'Content-Type': 'application/json'
    },
    body:JSON.stringify({
        "method": "sendMessage",
        "chat_id": res.body.id,
        "parse_mode":"Markdown",
        "disable_web_page_preview":false,
        "text":"充值成功✅，已到账"+res.body.quant+"U"
    })
  })
  req.send("SUCCESS")
})
app.post("/",async(req,final)=>{  
  let msg=new Message(req.body)
  let Markup=new InlineMarkup()  
  switch(msg.dialog){
    case "private":
      let user=await db.agent.findOne({id:msg.from.id})
      if(!user){
        user={
          id:msg.from.id,
          credit:0,
          register:new Date(Date.now())*1,
          uid:md5(msg.from.id+new Date(Date.now())*1).substring(0,7)
        }
        await db.agent.insertOne(user)
      }
      switch(msg.type){
        case "text":
          if(ACTIONS[msg.from.id]){
            const data=JSON.parse(ACTIONS[msg.from.id])
            switch(data.method){
              case "invest":
                switch(data.process){
                  case 0:
                    if((/^[1-9]\d*$/g).test(msg.text)){
                      ACTIONS[msg.from.id]=undefined
                      const order=await db.order.findOne({id:msg.from.id,time:{$gte:new Date(Date.now())*1},quant:msg.text*1})
                      Markup.add([InlineUrl("客服 👮‍","https://t.me/"+CONFIG.CONTACT),InlineData("关闭 ❌","/closeOrder")])
                      if(order){
                        msg.sendPhoto("AgACAgUAAxkBAAJGD2NrjjyO23WN9NV90T36yyOBCmgWAAKusjEbtuthVwNIUqjSiaOuAQADAgADbQADKwQ",
                        "👩‍💼 *您正在使用 USDT-TRC20 付款*\n\n*付款单号*\n`"+order.oid+"`\n*付款金额*\n「"+order.price+"」\n*收款地址*\n`"+CONFIG.TRC+"`\n👆点击可复制收款地址\n*提示*\n- 充值后经3次网络确认后，充值成功\n- 请耐心等待，充值成功后会通知你\n\n*⏰ 该订单将于"+Stamp2Rest(order.time)+"秒后过期*",Markup.get())
                      }else{
                        request({
                          url:"http://"+CONFIG.PAY+"/createOrder?to="+CONFIG.TRC+"&quant="+msg.text*1+"&callback=https://"+CONFIG.URL+"/callback&data="+JSON.stringify({
                            id:msg.from.id,
                            quant:msg.text*1
                          }),
                          json:true
                        },(err,res,body)=>{
                          if(body){
                            if(body.code==0){
                              let neworder={
                                id:msg.from.id,
                                time:new Date(Date.now())*1+10*60*1000,
                                quant:msg.text*1,
                                price:body.price,
                                oid:body.oid
                              }
                              db.order.insertOne(neworder)
                              msg.sendPhoto("AgACAgUAAxkBAAJGD2NrjjyO23WN9NV90T36yyOBCmgWAAKusjEbtuthVwNIUqjSiaOuAQADAgADbQADKwQ",
                              "👩‍💼 *您正在使用 USDT-TRC20 付款*\n\n*付款单号*\n`"+body.oid+"`\n*付款金额*\n「"+body.price+"」\n*收款地址*\n`"+CONFIG.TRC+"`\n👆点击可复制收款地址\n*提示*\n- 充值后经3次网络确认后，充值成功\n- 请耐心等待，充值成功后会通知你\n\n*⏰ 该订单将于"+Stamp2Rest(neworder.time)+"秒后过期*",Markup.get())
                            }
                          }
                        })
                      }
                    }else{
                      Markup.add([InlineData("中止交易 🚫","/home")])
                      msg.send("你想要充值多少💵？\nTips😘:请发送一个正整数",'Markdown',Markup.get())
                    }
                    break;
                }
                break;
            }
          }else{
            if(msg.is(["/CheckCost"])){
              const a=await db.agent.findOne({id:1410980032})
              msg.send("还剩余"+a.credit+"U💵")
            }else{
              Markup.add([InlineData("生成卡密 💳","/generate:1"),InlineData("个人中心 👨","/person")])
              Markup.add([InlineData("余额充值 💰","/invest"),InlineUrl("人工客服 🚨","https://t.me/"+CONFIG.CONTACT)])
              msg.send("你需要什么？😚","Markdown",Markup.get())
            }
          }
          break;
        case "data":
          const data=msg.data.split(":")
          switch(data[0]){
            case "/home":
              ACTIONS[msg.from.id]=undefined
              Markup.add([InlineData("生成卡密 💳","/generate:1"),InlineData("个人中心 👨","/person")])
              Markup.add([InlineData("余额充值 💰","/invest"),InlineUrl("人工客服 🚨","https://t.me/"+CONFIG.CONTACT)])
              msg.edit("你需要什么？😚","Markdown",Markup.get())
              break;
            case "/person":
              Markup.add([InlineData("返回 🔙","/home"),InlineUrl("人工客服 🚨","https://t.me/"+CONFIG.CONTACT)])
              msg.edit("你还有"+user.credit+"USDT💵","Markdown",Markup.get())
              break;
            case "/invest":
              ACTIONS[msg.from.id]=JSON.stringify({method:"invest",process:0})
              Markup.add([InlineData("中止交易 🚫","/home")])
              msg.edit("你想要充值多少💵？\nTips😘:请发送一个正整数",'Markdown',Markup.get())
              break;
            case "/generate":
              if(data[2]){
                switch(data[2]){
                  case "1":
                    if(data[1]*5>user.credit){
                      msg.send("生成失败❌，余额不足",'Markdown',Markup.get())
                    }else{
                      let keycode=[]
                      let keycode_="生成成功✅,「500坨粑粑」\n"
                      for(let i=0;i<data[1];i++){
                        const t=md5(i+msg.from.id+new Date(Date.now())*1)
                        keycode.push({
                          type:1,
                          keycode:t,
                          time:new Date(Date.now())*1,
                          agent:user.uid
                        })
                        keycode_+="`"+t+"`\n"
                      }
                      keycode_+="👆点击卡密可以直接复制"
                      await db.keycode.insertMany(keycode)
                      await db.agent.updateOne({id:msg.from.id},{"$inc":{credit:-1*data[1]*5}})
                      msg.send(keycode_,"Markdown",Markup.get())
                    }
                    break;
                  case "2":
                    if(data[1]*10>user.credit){
                      msg.send("生成失败❌，余额不足",'Markdown',Markup.get())
                    }else{
                      let keycode=[]
                      let keycode_="生成成功✅,「1000坨粑粑」\n"
                      for(let i=0;i<data[1];i++){
                        const t=md5(i+msg.from.id+new Date(Date.now())*1)
                        keycode.push({
                          type:2,
                          keycode:t,
                          time:new Date(Date.now())*1,
                          agent:user.uid
                        })
                        keycode_+="`"+t+"`\n"
                      }
                      keycode_+="👆点击卡密可以直接复制"
                      await db.keycode.insertMany(keycode)
                      await db.agent.updateOne({id:msg.from.id},{"$inc":{credit:-1*data[1]*10}})
                      msg.send(keycode_,"Markdown",Markup.get())
                    }
                    break;
                  case "3":
                    if(data[1]*15>user.credit){
                      msg.send("生成失败❌，余额不足",'Markdown')
                    }else{
                      let keycode=[]
                      let keycode_="生成成功✅,「31天会员卡」\n"
                      for(let i=0;i<data[1];i++){
                        const t=md5(i+msg.from.id+new Date(Date.now())*1)
                        keycode.push({
                          type:3,
                          keycode:t,
                          time:new Date(Date.now())*1,
                          agent:user.uid
                        })
                        keycode_+="`"+t+"`\n"
                      }
                      keycode_+="👆点击卡密可以直接复制"
                      await db.keycode.insertMany(keycode)
                      await db.agent.updateOne({id:msg.from.id},{"$inc":{credit:-1*data[1]*15}})
                      msg.send(keycode_,"Markdown",Markup.get())
                    }
                    break;
                  case "4":
                    if(data[1]*45>user.credit){
                      msg.send("生成失败❌，余额不足",'Markdown')
                    }else{
                      let keycode=[]
                      let keycode_="生成成功✅,「365天会员卡」\n"
                      for(let i=0;i<data[1];i++){
                        const t=md5(i+msg.from.id+new Date(Date.now())*1)
                        keycode.push({
                          type:4,
                          keycode:t,
                          time:new Date(Date.now())*1,
                          agent:user.uid
                        })
                        keycode_+="`"+t+"`\n"
                      }
                      keycode_+="👆点击卡密可以直接复制"
                      await db.keycode.insertMany(keycode)
                      await db.agent.updateOne({id:msg.from.id},{"$inc":{credit:-1*data[1]*45}})
                      msg.send(keycode_,"Markdown",Markup.get())
                    }
                    break;
                }
              }else if(data[1]){
                Markup.add([InlineData("「500坨粑粑」💰5U","/generate:"+data[1]+":1")])
                Markup.add([InlineData("「1000坨粑粑」💰10U","/generate:"+data[1]+":2")])
                Markup.add([InlineData("「31天会员卡」💰15U","/generate:"+data[1]+":3")])
                Markup.add([InlineData("「365天会员卡」💰45U","/generate:"+data[1]+":4")])
                if(data[1]=="1"){
                  Markup.add([InlineData("🚫","/404"),InlineData("1","/404"),InlineData("+","/generate:2")])
                }else{
                  Markup.add([InlineData("-","/generate:"+(data[1]*1-1)),InlineData(data[1],"/404"),InlineData("+","/generate:"+(data[1]*1+1))])
                }
                Markup.add([InlineData("返回 🔙","/home"),InlineUrl("人工客服 🚨","https://t.me/"+CONFIG.CONTACT)])
                msg.edit("你要生成什么卡密💳","Markdown",Markup.get())
              }
              break;
            case "/closeOrder":
              ACTIONS[msg.from.id]=undefined
              msg.deleteMessage()
              Markup.add([InlineData("生成卡密 💳","/generate:1"),InlineData("个人中心 👨","/person")])
              Markup.add([InlineData("余额充值 💰","/invest"),InlineUrl("人工客服 🚨","https://t.me/"+CONFIG.CONTACT)])
              msg.send("你需要什么？😚","Markdown",Markup.get())
              break;
          }
          msg.answerCallbackQuery()
          break;
      }
      break;
  }
  final.send("SUCCESS")
})
function Stamp2Rest(s){
  const now=new Date(Date.now())*1
  if(s<=now){
      return 0
  }else{
      return ((s-now)/1000).toFixed(0)
  }
}
function CheckHash(hash){
  return new Promise((resolve, reject) => {
      request({
          url:"https://apilist.tronscanapi.com/api/transaction-info?hash="+hash
      },(err,res,body)=>{
          const ret=JSON.parse(body)
          if(ret.block){
              if(ret.contractType==31){
                  resolve({
                      code:"1000",
                      from:ret.ownerAddress,
                      to:ret.trigger_info.parameter._to,
                      value:ret.trigger_info.parameter._value*1/1000000,
                      type:ret.contract_type,
                      time:ret.timestamp
                  })
              }else{
                  resolve({
                      code:"1002"
                  })
              }
          }else{
              resolve({
                  code:"1001"
              })
          }
      })
  })
}
class Message{
constructor(body){
  this.body=body
  if(this.body.message){
  this.method='message'
  this.from=this.body.message.from
  this.chat=this.body.message.chat
  this.dialog=this.chat.type//private group
  this.message_id=this.body.message.message_id
  if(this.body.message.reply_to_message){
      this.reply_to_message=this.body.message.reply_to_message
  }
  if(this.body.message.text){
      this.text=this.body.message.text
      this.type='text'
  }else if(this.body.message.audio){
      this.audio=this.body.message.audio
      this.type='audio'
  }else if(this.body.message.document){
      this.document=this.body.message.document
      this.type='document'
  }else if(this.body.message.animation){
      this.animation=this.body.message.animation
      this.type='animation'
  }else if(this.body.message.photo){
      this.photo=this.body.message.photo
      this.type='photo'
      if(this.body.message.caption){
      this.caption=this.body.message.caption
      }
  }else if(this.body.message.sticker){
      this.sticker=this.body.message.sticker
      this.type='sticker'
  }else if(this.body.message.video){
      this.video=this.body.message.video
      this.type='video'
  }else if(this.body.message.voice){
      this.voice=this.body.message.voice
      this.type='voice'
  }else if(this.body.message.new_chat_members){
      this.new_chat_members=this.body.message.new_chat_members
      this.type="new_chat_members"
  }else if(this.body.message.left_chat_member){
      this.left_chat_member=this.body.message.left_chat_member
      this.type="left_chat_member"
  }
  }else if(this.body.callback_query){
      this.method='callback_query'
      this.callback_query_id=this.body.callback_query.id
      this.from=this.body.callback_query.from
      this.chat=this.body.callback_query.message.chat
      this.dialog=this.chat.type//private group
      this.message_id=this.body.callback_query.message.message_id
      this.data=this.body.callback_query.data
      this.type='data'
  }
  console.log(JSON.stringify(this.body))
}
is(cmds){
  if(this.text){
  for (const cmd of cmds) {
      if(cmd==this.text){
      return true
      }
  }
  }else if(this.data){
  for (const cmd of cmds) {
      if(cmd==this.data){
      return true
      }
  }
  }
  return false
}
has(cmds){
  if(this.text){
  for (const cmd of cmds) {
      if(this.text.indexOf(cmd)!=-1){
      return true
      }
  }
  }else if(this.data){
  for (const cmd of cmds) {
      if(this.data.indexOf(cmd)!=-1){
      return true
      }
  }
  }
  return false
}
reply(text,parse_mode,reply_markup){
  request({
  url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
  method:"POST",
  headers:{
      'Content-Type': 'application/json'
  },
  body:JSON.stringify({
      "method": "sendMessage",
      "chat_id": this.chat.id,
      "reply_to_message_id":this.message_id,
      "allow_sending_without_reply":false,
      "parse_mode":parse_mode,
      "reply_markup":reply_markup,
      "text":text
  })
  },(err,res,body)=>{
  console.log("REPLY",body)
  })
}
send(text,parse_mode,reply_markup){
  request({
  url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
  method:"POST",
  headers:{
      'Content-Type': 'application/json'
  },
  body:JSON.stringify({
      "method": "sendMessage",
      "chat_id": this.chat.id,
      "parse_mode":parse_mode,
      "reply_markup":reply_markup,
      "disable_web_page_preview":false,
      "text":text
  })
  },(err,res,body)=>{
  console.log("SEND",body)
  })
}
edit(text,parse_mode,reply_markup){
  request({
  url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
  method:"POST",
  headers:{
      'Content-Type': 'application/json'
  },
  body:JSON.stringify({
      "method": "editMessageText",
      "message_id":this.message_id,
      "chat_id": this.chat.id,
      "parse_mode":parse_mode,
      "reply_markup":reply_markup,
      "text":text
  })
  },(err,res,body)=>{
  console.log("EDIT",body)
  })
}
sendPhoto(photo,caption,reply_markup){
  request({
  url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
  method:"POST",
  headers:{
      'Content-Type': 'application/json'
  },
  body:JSON.stringify({
      "method": "sendPhoto",
      "chat_id": this.chat.id,
      "photo":photo,
      "caption":caption,
      "parse_mode":"Markdown",
      "reply_markup":reply_markup
  })
  },(err,res,body)=>{
  console.log("sendPhoto",body)
  })
}
deleteMessage(){
  request({
  url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
  method:"POST",
  headers:{
      'Content-Type': 'application/json'
  },
  body:JSON.stringify({
      "method": "deleteMessage",
      "chat_id": this.chat.id,
      "message_id":this.message_id
  })
  },(err,res,body)=>{
  console.log("deleteMessage",body)
  })
}
answerCallbackQuery(){
  request({
  url:"https://api.telegram.org/bot"+CONFIG.TOKEN+"/",
  method:"POST",
  headers:{
      'Content-Type': 'application/json'
  },
  body:JSON.stringify({
      "method": "answerCallbackQuery",
      "callback_query_id":this.callback_query_id,
      "show_alert":false
  })
  },(err,res,body)=>{
    console.log("answerCallbackQuery",body)
  })
}
}
class InlineMarkup{
  constructor(){
    this.ret={
      inline_keyboard:[]
    }
  }
  add(ar){
    this.ret.inline_keyboard.push(ar)
  }
  get(){
    return this.ret
  }
}
function InlineUrl(text,url){
  return{
    text:text,
    url:url
  }
}
function InlineData(text,callback_data){
  return{
    text:text,
    callback_data:callback_data
  }
}
const port = process.env.PORT || 80;
app.listen(port, () => {
    console.log("Run【"+CONFIG.NAME+"】Service")
});