# node-zookeeper-dubbo
nodejs connect dubbo by default protocol in zookeeper

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]
[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/p412726700/node-zookeeper-dubbo/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

### config
##### env
dubbo service version
##### conn
zookeeper conn url
##### path
the service you need
##### version
dubbo version

### Example
```javascript
var Service=require('node-zookeeper-dubbo');

var opt={
  env:'test', // dubbo service version
  gruop:'dubbo', // dubbo group default by 'dubbo',optional
  conn:'127.0.0.1:2180', // zookeeper url
  path:'com.customer.Service', // service url
  version:'2.3.4.5' // dubbo version
}

var method="getUserByID";
var arg1={$class:'int',$:123}
var args=[arg1];

var service = new Service(opt);
service.excute(method,args,function(err,data){
  if(err){
    console.log(err);
    return;
  }
  console.log(data)
})

or

service
  .excute(method,args)
  .then(function(data){
    console.log(data);
  })
  .catch(function(err) {
    console.log(err);
  })

```
you can use  [js-to-java](https://github.com/node-modules/js-to-java)
```javascript
var arg1={$class:'int',$:123};
//equivalent
var arg1=java('int',123);
```

### Close zookeeper connection

Default the zookeeper connection is keep-alive,you can call ```service.zoo.close()``` to close the connect;


### Contributors
[PanEW](https://github.com/p412726700) @ 平安健康

[zhanghua](https://github.com/zhanghua499) @ 平安健康

[caomu](https://github.com/caomu) @ 平安健康

[zhchj126](https://github.com/zhchj126) @ 平安健康

[maochendong](https://github.com/maochendong)

### Join us
sending your CV to panzhichao@jk.cn

[npm-image]:http://img.shields.io/npm/v/node-zookeeper-dubbo.svg?style=flat-square
[npm-url]:https://npmjs.org/package/node-zookeeper-dubbo?style=flat-square
[downloads-image]:http://img.shields.io/npm/dm/node-zookeeper-dubbo.svg?style=flat-square
