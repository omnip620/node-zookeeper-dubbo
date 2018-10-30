# node-zookeeper-dubbo
nodejs通过dubbo默认协议通信

**3.0版本发布，使用长连接进行通信，同时重构了大量代码，性能几乎翻倍。**


### 用法

```javascript
const nzd=require('node-zookeeper-dubbo');
const app=require('express')();
const opt={
  application:{name:'fxxk'},
  register:'www.cctv.com:2181',
  dubboVer:'2.5.3.6',
  root:'dubbo',
  dependencies:{
    Foo:{
      interface:'com.service.Foo',
      version:'LATEST',
      timeout:6000,
      group:'isis',
      methodSignature: { // optional
        findById : (id) => [ {'$class': 'java.lang.Long', '$': id} ],
        findByName : (name) => [ java.String(name) ],
      }
    },
    Bar:{
      interface:'com.service.Bar',
      version:'LATEST',
      timeout:6000,
      group:'gcd'
    }
  }
}

const Dubbo=new nzd(opt);

Dubbo.on("service:changed", (event)=>console.log(event))

const customerObj = {
  $class: 'com.xxx.XXXDTO',
  $: {
    a: 1,
    b: 'test',
    c: {$class: 'java.lang.Long', $: 123}
  }
};

app.get('/foo',(req,res)=>{
  Dubbo.Foo
    .xxMethod({'$class': 'java.lang.Long', '$': '10000000'},customerObj)
    .then(data=>res.send(data))
    .catch(err=>res.send(err))
})

app.get('/foo/findById',(req,res)=>{
  Dubbo.Foo
    .findById(10000)
    .then(data=>res.send(data))
    .catch(err=>res.send(err))
})

app.listen(9090)

```
### 注意

须等待初始化完毕才能正常使用，标志：**Dubbo service init done**

### 参数配置说明
- **application**
  * name - 项目名称，必填
- **register** - zookeeper服务地址，必填
- **dubboVer** - dubbo版本，必填
- **root** - 注册到zookeeper上的根节点名称
- **dependencies** - 依赖的服务集，必填
  * Foo - 自定义名称，这里方便起见用Foo作为示例，必填
    * interface - 服务地址，必填
    * version - 注册的服务版本
    * timeout	-	超时时间，默认6000
    * group	-	分组
    * methodSignature	-	方法签名

可以选择使用  [js-to-java](https://github.com/node-modules/js-to-java)， 能极大提高效率。
```javascript
const java = require('js-to-java');
const arg = {$class:'int',$:123};
//等同于
const arg = java('int',123);
```

感谢为这个项目作出过贡献的每个人，感谢为我提供思路和指导的 [@caomu](https://github.com/caomu)，感谢 [js-to-java](https://github.com/node-modules/js-to-java), [hessian.js](https://github.com/node-modules/hessian.js) 的作者们。

[npm-image]:http://img.shields.io/npm/v/node-zookeeper-dubbo.svg?style=flat-square
[npm-url]:https://npmjs.org/package/node-zookeeper-dubbo?style=flat-square
[downloads-image]:http://img.shields.io/npm/dm/node-zookeeper-dubbo.svg?style=flat-square
