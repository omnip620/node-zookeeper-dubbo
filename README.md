# node-zookeeper-dubbo
nodejs connect dubbo by default protocol in zookeeper

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]

#### There are a lot of improvements in [v2.0](https://github.com/p412726700/node-zookeeper-dubbo/tree/v2.0)

### config
##### env
dubbo service version
##### conn
zookeeper conn url
##### path
the service you need
##### version
dubbo version
##### services


### Usage
**first** you need to init the service so that invoke the consumers in zk

app.js
```javascript
var service=require('node-zookeeper-dubbo');
new Service({
  env:'test',
  conn:'127.0.0.1:2180',
  services: require('./dubbo/services')
})
```
/dubbo/services.js

```javascript
'use strict';

module.exports = {
  Foo: 'com.customer.FooService',
  Bar: 'com.customer.BarService'
};

```

in you business code, service.js

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

### Optimize

There are a lot of non-functional requirements need to be satisfied, but time is hard, so pls patience, we'll scare you.

### Contributors
[PanEW](https://github.com/p412726700)

[zhanghua](https://github.com/zhanghua499)

[caomu](https://github.com/caomu)

[zhchj126](https://github.com/zhchj126)



[npm-image]:http://img.shields.io/npm/v/node-zookeeper-dubbo.svg?style=flat-square
[npm-url]:https://npmjs.org/package/node-zookeeper-dubbo?style=flat-square
[downloads-image]:http://img.shields.io/npm/dm/node-zookeeper-dubbo.svg?style=flat-square
