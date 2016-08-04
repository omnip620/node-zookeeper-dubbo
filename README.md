# node-zookeeper-dubbo
nodejs connect dubbo by default protocol in zookeeper

[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][npm-url]


### Usage

```javascript
const nzd=require('node-zookeeper-dubbo');

const opt={
  application:{name:'fxxk'},
  register:'www.cctv.com:2181',
  dubboVer:'2.5.3.6',
  dependencies:{
    Foo:{interface:'com.service.Foo',version:'LATEST',timeout:6000,group:'isis'},
    Bar:{interface:'com.service.Bar',version:'LATEST',timeout:6000,group:'gcd'}
  }  
}

const Dubbo=nzd(opt);

Dubbo.Foo
  .xxMethod({'$class': 'java.lang.Long', '$': '10000000'})
  .then(console.log)
  .catch(console.error)

```

### Config
#### application
###### name
you application name
#### register
zookeeper conn url
#### dubboVer
the dubbo version
#### dependencies
the services you need to with
##### interface
interface (optional)
##### version
version (optional)
##### timeout
timeout (optional)
##### group
group (optional)

Notice

**First** must wait the service init done before use it ,symbol is **Dubbo service init done**


you can use  [js-to-java](https://github.com/node-modules/js-to-java)
```javascript
var arg1={$class:'int',$:123};
//equivalent
var arg1=java('int',123);
```

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
