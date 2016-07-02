var Service=require('./index.js');

var opt={
  env:'1.0.0', // dubbo service version
  gruop:'', // dubbo group default by 'dubbo',optional
  conn:'127.0.0.1:1181', // zookeeper url
  path:'com.acmcoder.acmexamhr.service.EntAccountService', // service url
  version:'1.0.0' // dubbo version
}

//var method="checkLogin";
var arg1={$class:'java.lang.String',$:'13911998129'};
var arg2={$class:'java.lang.String',$:'flower'};
//var args=[arg1, arg2];

var service = new Service(opt);
service.init().then(function() {
	//更优雅的方式调用远程方法
	service.checkLogin(arg1, arg2)
	  .then(function(data){
	    console.log(data);
	  })
	  .catch(function(err) {
	    console.log(err);
	  });
	/*service
  .excute(method,args)
  .then(function(data){
    console.log(data);
  })
  .catch(function(err) {
    console.log(err);
  });*/
});
/*service.excute(method,args,function(err,data){
  if(err){
    console.log(err);
    return;
  }
  console.log(data)
})

or
*/
