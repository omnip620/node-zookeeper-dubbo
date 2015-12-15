# node-zookeeper-dubbo
nodejs connect dubbo by default protocol in zookeeper
[npm-image]: http://img.shields.io/npm/v/node-zookeeper-dubbo.svg?style=flat-square
[npm-url]: https://npmjs.org/package/node-zookeeper-dubbo?style=flat-square
[downloads-image]: http://img.shields.io/npm/dm/node-zookeeper-dubbo.svg?style=flat-square
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url]

### config
##### env
envirmoment
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
  env:'test',
  conn:'127.0.0.1:2180',
  path:'com.customer.Service'
}

var method="getUserByID";
var arg1={$class:'int',$:123}
var arguments=[arg1];

var service = new Service(opt);
service.excute(method,arguments,function(err,data){
  if(err){
    console.log(err);
    return;
  }
  console.log(data)
})
```
you can use  [js-to-java](https://github.com/node-modules/js-to-java)
```javascript
var arg1={$class:'int',$:123};
//equivalent
var arg1=java('int',123);
```
### Contributors
[PanEW](https://github.com/p412726700)

[zhanghua](https://github.com/zhanghua499)

[caomu](https://github.com/caomu)

[zhchj126](https://github.com/zhchj126)

[maochendong](https://github.com/maochendong)






