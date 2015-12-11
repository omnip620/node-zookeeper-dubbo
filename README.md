# node-zookeeper-dubbo
### config
#####env
环境信息
#####conn
zookeeper 连接地址
#####path
所需服务
#####version
dubbo版本

###Example
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



