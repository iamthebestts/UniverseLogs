--[[
    db    db d8b   db d888888b db    db d88888b d8888b. .d8888. d88888b      db       .d88b.   d888b  .d8888. 
    88    88 888o  88   `88'   88    88 88'     88  `8D 88'  YP 88'          88      .8P  Y8. 88' Y8b 88'  YP 
    88    88 88V8o 88    88    Y8    8P 88ooooo 88oobY' `8bo.   88ooooo      88      88    88 88      `8bo.   
    88    88 88 V8o88    88    `8b  d8' 88      88`8b     `Y8b. 88           88      88    88 88  ooo   `Y8b. 
    88b  d88 88  V888   .88.    `8bd8'  88.     88 `88. db   8D 88.          88booo. `8b  d8' 88. ~8~ db   8D 
    ~Y8888P' VP   V8P Y888888P    YP    Y88888P 88   YD `8888Y' Y88888P      Y88888P  `Y88P'   Y888P`8888Y' 
                                                                                                          
                                                                                                          
    UniverseLogs v1.0.0 — Enterprise-Grade Logging for Roblox
    
    ⚡ Async • 📦 Buffered • 🛡️ Resilient • 🔍 Observable
    
    📝 Auto-generated build — DO NOT EDIT MANUALLY
    🔗 https://github.com/iamthebestts/UniverseLogs
    📜 MIT License | © iamthebestts
    
]]--


type LogLevel__MADE_BY_IAMTHEBESTTS_TYPE_a='trace'|'debug'|'info'|'warn'|'error'|'fatal'type LogEntry__MADE_BY_IAMTHEBESTTS_TYPE_b={id:string,
universe_id:string,level:LogLevel__MADE_BY_IAMTHEBESTTS_TYPE_a,message:string,topic:string?,metadata:{[string]:any}?,timestamp:string
}type LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c={level:LogLevel__MADE_BY_IAMTHEBESTTS_TYPE_a,message:string,topic:string?,metadata:{[string]:any}?,_id
:string?,_ts:number?}type QueryFilters__MADE_BY_IAMTHEBESTTS_TYPE_d={level:LogLevel__MADE_BY_IAMTHEBESTTS_TYPE_a?,topic:string?,from:string?,to:
string?,cursor_ts:string?,cursor_id:string?,limit:number?}type LogsCount__MADE_BY_IAMTHEBESTTS_TYPE_e={total:number,byLevel:{trace:
number,debug:number,info:number,warn:number,error:number,fatal:number}}type UniverseInfo__MADE_BY_IAMTHEBESTTS_TYPE_f={id:string,name
:string?,description:string?}type Config__MADE_BY_IAMTHEBESTTS_TYPE_g={apiKey:string,baseUrl:string?,localBufferCapacity:number?,
autoFlush:boolean?,flushInterval:number?,throttleWindow:number?,maxRetries:number?,useDataStoreFallback:boolean?,
fallbackInterval:number?,fallbackTTL:number?,fallbackMaxQueue:number?,autoReportErrors:boolean?,errorFilter:((message:
string,stackTrace:string,script:Instance)->boolean)?,maxBulkSize:number?,maxThrottleEntries:number?}type
SanitizeOptions__MADE_BY_IAMTHEBESTTS_TYPE_h={maxDepth:number?,maxTableSize:number?,maxStringLength:number?,includeInstancePath:
boolean?}local __UNIVERSELOGS_MODULE={cache={}::any}do do local function __modImpl()return{}end function
__UNIVERSELOGS_MODULE.a():typeof(__modImpl())local v=__UNIVERSELOGS_MODULE.cache.a if not v then v={c=__modImpl()}
__UNIVERSELOGS_MODULE.cache.a=v end return v.c end end do local function __modImpl()__UNIVERSELOGS_MODULE.a()local
Config={}Config.__index=Config function Config.new(apiKey:string,options:{[string]:any}?):Config__MADE_BY_IAMTHEBESTTS_TYPE_g local
self=setmetatable({},Config)local opts=options and options or{}self.apiKey=apiKey self.baseUrl=opts.baseUrl or
'https://api.universelogs.com'self.localBufferCapacity=opts.localBufferCapacity or 1000 self.autoFlush=opts.autoFlush or
true self.flushInterval=opts.flushInterval or 5000 self.throttleWindow=opts.throttleWindow or 5 self.maxRetries=opts.
maxRetries or 3 self.useDataStoreFallback=if opts.useDataStoreFallback~=nil then opts.useDataStoreFallback else true
self.fallbackInterval=opts.fallbackInterval or 300 self.fallbackTTL=opts.fallbackTTL or 3600 self.fallbackMaxQueue=opts.
fallbackMaxQueue or 1000 self.autoReportErrors=opts.autoReportErrors or false self.errorFilter=opts.errorFilter self.
maxBulkSize=opts.maxBulkSize or 500 self.maxThrottleEntries=opts.maxThrottleEntries or 5000 return self end return
Config end function __UNIVERSELOGS_MODULE.b():typeof(__modImpl())local v=__UNIVERSELOGS_MODULE.cache.b if not v then v={
c=__modImpl()}__UNIVERSELOGS_MODULE.cache.b=v end return v.c end end do local function __modImpl()local HttpService=game
:GetService('HttpService')__UNIVERSELOGS_MODULE.a()local Utils={}function Utils.generateId():string return HttpService:
GenerateGUID(false):lower():gsub('-','')end function Utils.isoTimestamp():string return DateTime.now():ToIsoDate()end
function Utils.urlEncode(str:string):string return HttpService:UrlEncode(str)end function Utils.buildQueryString(params:
{[string]:any}?):string if not params or next(params)==nil then return''end local parts={}for key,value in pairs(params)
do if value~=nil then table.insert(parts,`{key}={Utils.urlEncode(tostring(value))}`)end end return'?'..table.concat(
parts,'&')end function Utils.validateLogInput(input:{[string]:any}):(boolean,string?)if not input.level then return
false,'level is required'end if not input.message then return false,'message is required'end local validLevels={trace=
true,debug=true,info=true,warn=true,error=true,fatal=true}if not validLevels[input.level]then return false,
'invalid level'end if#input.message>2048 then return false,'message exceeds 2048 characters'end if input.topic and#input
.topic>100 then return false,'topic exceeds 100 characters'end return true end local DEFAULT_OPTIONS:
SanitizeOptions__MADE_BY_IAMTHEBESTTS_TYPE_h={maxDepth=10,maxTableSize=64,maxStringLength=512,includeInstancePath=false}function
Utils.sanitizeMetadata(data:any,visited:{[any]:boolean}?,depth:number?,options:SanitizeOptions__MADE_BY_IAMTHEBESTTS_TYPE_h?):any
local opts=options or DEFAULT_OPTIONS local currentDepth=depth or 0 local maxDepth=opts.maxDepth or DEFAULT_OPTIONS.
maxDepth local maxTableSize=opts.maxTableSize or DEFAULT_OPTIONS.maxTableSize local maxStringLength=opts.maxStringLength
or DEFAULT_OPTIONS.maxStringLength if currentDepth>maxDepth then return'[Max Depth Exceeded]'end local t=typeof(data)if
t=='string'then if#data>maxStringLength then return string.sub(data,1,maxStringLength)..'... [truncated '..tostring(#
data-maxStringLength)..' chars]'end return data elseif t=='number'then if data~=data then return'[NaN]'end if data==math
.huge then return'[Infinity]'end if data==-math.huge then return'[-Infinity]'end return data elseif t=='boolean'or t==
'nil'then return data end if t=='Vector3'then return string.format('Vector3(%.3f, %.3f, %.3f)',data.X,data.Y,data.Z)
elseif t=='Vector2'then return string.format('Vector2(%.3f, %.3f)',data.X,data.Y)elseif t=='CFrame'then local pos=data.
Position return string.format('CFrame(%.2f, %.2f, %.2f)',pos.X,pos.Y,pos.Z)elseif t=='Color3'then return string.format(
'Color3(R=%.3f, G=%.3f, B=%.3f)',data.R,data.G,data.B)elseif t=='UDim2'then return string.format('UDim2(%s, %s, %s, %s)'
,tostring(data.X.Scale),tostring(data.X.Offset),tostring(data.Y.Scale),tostring(data.Y.Offset))elseif t=='Enum'or t==
'EnumItem'then return tostring(data)elseif t=='UDim'then return string.format('UDim(%s, %s)',tostring(data.Scale),
tostring(data.Offset))elseif t=='Ray'then return string.format(
[[Ray(Origin=Vector3(%.2f, %.2f, %.2f), Direction=Vector3(%.2f, %.2f, %.2f))]],data.Origin.X,data.Origin.Y,data.Origin.Z
,data.Direction.X,data.Direction.Y,data.Direction.Z)elseif t=='Axes'then return tostring(data)elseif t=='BrickColor'then
return'BrickColor('..data.Name..')'elseif t=='NumberRange'then return string.format('NumberRange(%.3f, %.3f)',data.Min,
data.Max)elseif t=='Rect'then return string.format('Rect(%.2f, %.2f, %.2f, %.2f)',data.Min.X,data.Min.Y,data.Max.X,data.
Max.Y)elseif t=='PhysicalProperties'then return string.format(
[[PhysicalProperties(Density=%.3f, Friction=%.3f, Elasticity=%.3f)]],data.Density,data.Friction,data.Elasticity)elseif t
=='TweenInfo'then return string.format('TweenInfo(Time=%.2f, Style=%s, Direction=%s, Repeat=%d)',data.Time,tostring(data
.EasingStyle),tostring(data.EasingDirection),data.RepeatCount)end if t=='Instance'then if data:IsA('Player')then return
'Player('..data.Name..', UserId='..tostring(data.UserId)..')'end if opts.includeInstancePath then return data.ClassName
..'("'..data.Name..'") @ '..data:GetFullName()end return data.ClassName..'("'..data.Name..'")'end if t=='table'then
local vTable=visited or{}if vTable[data]then return'[Circular Reference]'end vTable[data]=true local sanitized={}local
count=0 for k,v in pairs(data)do count=count+1 if count>maxTableSize then sanitized.__truncated='Table truncated at '..
tostring(maxTableSize)..' entries'break end local cleanKey if typeof(k)=='string'then cleanKey=k else cleanKey='['..
tostring(k)..']'end sanitized[cleanKey]=Utils.sanitizeMetadata(v,vTable,currentDepth+1,opts)end vTable[data]=nil return
sanitized end return'['..t..'] '..tostring(data)end return Utils end function __UNIVERSELOGS_MODULE.c():typeof(
__modImpl())local v=__UNIVERSELOGS_MODULE.cache.c if not v then v={c=__modImpl()}__UNIVERSELOGS_MODULE.cache.c=v end
return v.c end end do local function __modImpl()local DataStoreService=game:GetService('DataStoreService')
__UNIVERSELOGS_MODULE.a()local Utils=__UNIVERSELOGS_MODULE.c()local STORE_NAME='UniverseLogs_Fallback_v1'local
LOCK_STORE='UniverseLogs_Lock_v1'local LOCK_TTL=20 local SERVER_ID=game.JobId~=''and game.JobId or tostring(math.random(
1e9))local FallbackStore={}FallbackStore.__index=FallbackStore function FallbackStore.new(config:Config__MADE_BY_IAMTHEBESTTS_TYPE_g,
universeKey:string)local self=setmetatable({},FallbackStore)self.config=config self.storeKey=`queue_{universeKey}`self.
lockKey=`lock_{universeKey}`self.dataStore=DataStoreService:GetDataStore(STORE_NAME)self.lockStore=DataStoreService:
GetDataStore(LOCK_STORE)return self end function FallbackStore:_acquireLock():boolean local acquired=false local now=
DateTime.now().UnixTimestamp local ok=pcall(function()self.lockStore:UpdateAsync(self.lockKey,function(current)if
current==nil or current.serverId==SERVER_ID or(now-current.acquiredAt)>LOCK_TTL then acquired=true return{serverId=
SERVER_ID,acquiredAt=now}end acquired=false return nil end)end)return ok and acquired end function FallbackStore:
_releaseLock()pcall(function()self.lockStore:UpdateAsync(self.lockKey,function(current)if current and current.serverId==
SERVER_ID then return nil end return current end)end)end function FallbackStore:push(logs:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c})if
not self.config.useDataStoreFallback then return end local now=DateTime.now().UnixTimestamp pcall(function()self.
dataStore:UpdateAsync(self.storeKey,function(oldData)local queue:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}=oldData or{}local
existingIds:{[string]:boolean}={}for _,entry in ipairs(queue)do if entry._id then existingIds[entry._id]=true end end
local max=self.config.fallbackMaxQueue or 1000 local logsToAdd=logs if#logsToAdd>max then local trimmed={}for i=#
logsToAdd-max+1,#logsToAdd do table.insert(trimmed,logsToAdd[i])end logsToAdd=trimmed end for _,log in ipairs(logsToAdd)
do if not log._id then log._id=Utils.generateId()end if not log._ts then log._ts=now end if not log._id or not
existingIds[log._id]then table.insert(queue,log)if log._id then existingIds[log._id]=true end end end if#queue>max then
local trimmed={}for i=#queue-max+1,#queue do table.insert(trimmed,queue[i])end queue=trimmed end return queue end)end)
end function FallbackStore:processQueue(httpFlush:({LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c})->(boolean,any)):number if not self.config
.useDataStoreFallback then return 0 end if not self:_acquireLock()then return 0 end local sent=0 local now=DateTime.now(
).UnixTimestamp local ok,queue=pcall(function()return self.dataStore:GetAsync(self.storeKey)end)if not ok or type(queue)
~='table'or#queue==0 then self:_releaseLock()return 0 end local valid:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}={}for _,log in ipairs(
queue)do local age=log._ts and(now-log._ts)or 0 if age<self.config.fallbackTTL then table.insert(valid,log)end end local
batchSize=self.config.maxBulkSize or 500 local remaining:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}=table.clone(valid)while#remaining>0
do local batch:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}={}for i=1,math.min(batchSize,#remaining)do local clean:
LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c={level=remaining[i].level,message=remaining[i].message,topic=remaining[i].topic,metadata=
remaining[i].metadata}table.insert(batch,clean)end local httpOk=httpFlush(batch)if httpOk then sent+=#batch local
newRemaining:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}={}for i=#batch+1,#remaining do table.insert(newRemaining,remaining[i])end
remaining=newRemaining else break end end pcall(function()self.dataStore:SetAsync(self.storeKey,#remaining>0 and
remaining or nil)end)self:_releaseLock()return sent end return FallbackStore end function __UNIVERSELOGS_MODULE.d():
typeof(__modImpl())local v=__UNIVERSELOGS_MODULE.cache.d if not v then v={c=__modImpl()}__UNIVERSELOGS_MODULE.cache.d=v
end return v.c end end do local function __modImpl()local HttpService=game:GetService('HttpService')
__UNIVERSELOGS_MODULE.a()local Utils=__UNIVERSELOGS_MODULE.c()local HttpClient={}HttpClient.__index=HttpClient function
HttpClient.new(config:Config__MADE_BY_IAMTHEBESTTS_TYPE_g)local self=setmetatable({},HttpClient)self.config=config return self end
function HttpClient:_request(method:string,path:string,body:any?,query:{[string]:any}?):(boolean,any,number?)local url=
self.config.baseUrl..path..Utils.buildQueryString(query)local headers={['X-API-Key']=self.config.apiKey}if body then
headers['Content-Type']='application/json'end local bodyJson=body and HttpService:JSONEncode(body)or''local attempt=0
local delayTime=3 while attempt<=self.config.maxRetries do local success,result=pcall(function()if method=='GET'then
return HttpService:GetAsync(url,true,headers)elseif method=='POST'or method=='DELETE'then return HttpService:
RequestAsync({Url=url,Method=method,Headers=headers,Body=bodyJson})end return false,'Invalid method',nil end)if success
then local statusCode=200 local responseBody=result if typeof(result)=='table'and result.StatusCode~=nil then statusCode
=result.StatusCode responseBody=result.Body if statusCode>=500 or statusCode==429 then success=false end end if success
then if responseBody and responseBody~=''then local decodeSuccess,decoded=pcall(HttpService.JSONDecode,HttpService,
responseBody)if decodeSuccess then return true,decoded,statusCode else return false,'Failed to decode JSON: '..tostring(
responseBody),statusCode end end return true,responseBody,statusCode end end attempt+=1 if attempt<=self.config.
maxRetries then task.wait(delayTime)delayTime*=2 else return false,result,nil end end return false,nil,nil end function
HttpClient:healthCheck():(boolean,{status:string,timestamp:string,version:string}?)return self:_request('GET',
'/api/health')end function HttpClient:ping():(boolean,{pong:boolean,timestamp:string}?)return self:_request('GET',
'/api/ping')end function HttpClient:getLogsCount(filters:{from:string?,to:string?}?):(boolean,LogsCount__MADE_BY_IAMTHEBESTTS_TYPE_e?
)return self:_request('GET','/api/logs/count',nil,filters)end function HttpClient:getLogs(filters:
QueryFilters__MADE_BY_IAMTHEBESTTS_TYPE_d?):(boolean,{logs:{LogEntry__MADE_BY_IAMTHEBESTTS_TYPE_b},nextCursor:any}?)return self:_request('GET',
'/api/logs',nil,filters)end function HttpClient:getLogById(id:string):(boolean,LogEntry__MADE_BY_IAMTHEBESTTS_TYPE_b?)return self:
_request('GET',`/api/logs/{id}`)end function HttpClient:createLog(log:LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c):(boolean,
LogEntry__MADE_BY_IAMTHEBESTTS_TYPE_b?)return self:_request('POST','/api/logs',log)end function HttpClient:createLogsBulk(logs:{
LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}):(boolean,{logs:{LogEntry__MADE_BY_IAMTHEBESTTS_TYPE_b}}?)local max=self.config.maxBulkSize or 500 if#logs
<=max then return self:_request('POST','/api/logs/bulk',{logs=logs})end local success=true local results={logs={}}for i=
1,#logs,max do local chunk={}for j=i,math.min(i+max-1,#logs)do table.insert(chunk,logs[j])end local ok,result=self:
_request('POST','/api/logs/bulk',{logs=chunk})if not ok then success=false elseif result and result.logs then for _,log
in ipairs(result.logs)do table.insert(results.logs,log)end end end return success,results end function HttpClient:
deleteLogs(params:{olderThan:string,level:string?,topic:string?}):(boolean,{deleted:number}?)return self:_request(
'DELETE','/api/logs',nil,params)end function HttpClient:createUniverse(universeId:number|string,options:{name:string?,
description:string?,createKey:boolean?}?):(boolean,{universe:any,key:string?}?)local opts=options and options or{}local
body={universeId=universeId,name=opts.name,description=opts.description,createKey=opts.createKey}return self:_request(
'POST','/api/universes',body)end function HttpClient:getUniverse(id:string):(boolean,{universe:
UniverseInfo__MADE_BY_IAMTHEBESTTS_TYPE_f,logs:{LogEntry__MADE_BY_IAMTHEBESTTS_TYPE_b}}?)return self:_request('GET',`/api/universes/{id}`)end
function HttpClient:revokeUniverse(id:string):(boolean,{success:boolean}?)return self:_request('POST',`/api/universes/{
id}/revoke`)end return HttpClient end function __UNIVERSELOGS_MODULE.e():typeof(__modImpl())local v=
__UNIVERSELOGS_MODULE.cache.e if not v then v={c=__modImpl()}__UNIVERSELOGS_MODULE.cache.e=v end return v.c end end do
local function __modImpl()__UNIVERSELOGS_MODULE.a()local LogBuffer={}LogBuffer.__index=LogBuffer function LogBuffer.new(
maxSize:number,flushInterval:number,flushCallback:({LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c})->())local self=setmetatable({},LogBuffer)
self.buffer={}::{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}self.maxSize=maxSize self.flushInterval=flushInterval self.flushCallback=
flushCallback self.flushThread=nil self._flushing=false self:_scheduleFlush()return self end function LogBuffer:
_scheduleFlush()if self.flushThread then task.cancel(self.flushThread)end self.flushThread=task.delay(self.flushInterval
,function()self.flushThread=nil self:flush()end)end function LogBuffer:add(log:LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c)table.insert(
self.buffer,log)if#self.buffer>=self.maxSize then if self.flushThread then task.cancel(self.flushThread)self.flushThread
=nil end self:flush()end end function LogBuffer:flush()if self._flushing or#self.buffer==0 then self:_scheduleFlush()
return{await=function()end}end self._flushing=true local batch=self.buffer self.buffer={}local thread=coroutine.running(
)local completed=false task.spawn(function()self.flushCallback(batch)self._flushing=false self:_scheduleFlush()completed
=true if coroutine.status(thread)~='dead'then task.defer(thread)end end)return{await=function(_self,timeout:number?)if
completed then return end local timeoutThread if timeout then timeoutThread=task.delay(timeout,function()if not
completed then completed=true task.spawn(thread)end end)end coroutine.yield()if timeoutThread then task.cancel(
timeoutThread)end end}end function LogBuffer:destroy()if self.flushThread then task.cancel(self.flushThread)self.
flushThread=nil end if#self.buffer>0 then self.flushCallback(self.buffer)self.buffer={}end end return LogBuffer end
function __UNIVERSELOGS_MODULE.f():typeof(__modImpl())local v=__UNIVERSELOGS_MODULE.cache.f if not v then v={c=
__modImpl()}__UNIVERSELOGS_MODULE.cache.f=v end return v.c end end end local RunService=game:GetService('RunService')
local ScriptContext=game:GetService('ScriptContext')local Config=__UNIVERSELOGS_MODULE.b()local FallbackStore=
__UNIVERSELOGS_MODULE.d()local HttpClient=__UNIVERSELOGS_MODULE.e()local LogBuffer=__UNIVERSELOGS_MODULE.f()local Types=
__UNIVERSELOGS_MODULE.a()local Utils=__UNIVERSELOGS_MODULE.c()type UniverseLogsImpl={config:Config__MADE_BY_IAMTHEBESTTS_TYPE_g,http:
any,buffer:any,fallback:any,_fallbackLoop:thread?,_throttleCleanupLoop:thread?,throttleCache:{[string]:number},
throttleCount:number,init:(self:UniverseLogsImpl)->(boolean,string?),destroy:(self:UniverseLogsImpl)->(),log:(self:
UniverseLogsImpl,level:LogLevel__MADE_BY_IAMTHEBESTTS_TYPE_a,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}
?)->(),trace:(self:UniverseLogsImpl,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}?)->(),debug
:(self:UniverseLogsImpl,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}?)->(),info:(self:
UniverseLogsImpl,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}?)->(),warn:(self:
UniverseLogsImpl,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}?)->(),error:(self:
UniverseLogsImpl,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}?)->(),fatal:(self:
UniverseLogsImpl,message:string,options:{topic:string?,metadata:any?,throttleKey:string?}?)->(),getLogs:(self:
UniverseLogsImpl,filters:QueryFilters__MADE_BY_IAMTHEBESTTS_TYPE_d?)->(boolean,any),getLogsCount:(self:UniverseLogsImpl,filters:{from
:string?,to:string?}?)->(boolean,any),getLogById:(self:UniverseLogsImpl,id:string)->(boolean,any),deleteLogs:(self:
UniverseLogsImpl,params:{olderThan:string,level:string?,topic:string?})->(boolean,any)}local UniverseLogs={}UniverseLogs
.__index=UniverseLogs UniverseLogs.Types=Types function UniverseLogs.new(apiKey:string,options:{[string]:any}?):
UniverseLogsImpl local self=setmetatable({},UniverseLogs)::any self.config=Config.new(apiKey,options)self.http=
HttpClient.new(self.config)self.fallback=FallbackStore.new(self.config,tostring(options and options.universeId or apiKey
:sub(1,16)))self.buffer=LogBuffer.new(self.config.localBufferCapacity,self.config.flushInterval,function(logs)self:
_flushLogs(logs)end)self._fallbackLoop=nil self.throttleCache={}self.throttleCount=0 return self end function
UniverseLogs:_httpFlush(logs:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c}):(boolean,any)return self.http:createLogsBulk(logs)end function
UniverseLogs:_flushLogs(logs:{LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c})local ok,result=self:_httpFlush(logs)if not ok then self.
fallback:push(logs)if result then warn(`[UniverseLogs] Flush failed: {tostring(result)}`)end end end function
UniverseLogs:_startFallbackLoop()if not self.config.useDataStoreFallback then return end self._fallbackLoop=task.spawn(
function()while true do task.wait(self.config.fallbackInterval)self.fallback:processQueue(function(batch)local ok=self:
_httpFlush(batch)return ok end)end end)end function UniverseLogs:_startThrottleCleanupLoop()self._throttleCleanupLoop=
task.spawn(function()while true do task.wait(60)pcall(function()local now=DateTime.now().UnixTimestamp local newCache={}
local newCount=0 for key,timestamp in pairs(self.throttleCache)do if now-timestamp<self.config.throttleWindow then
newCache[key]=timestamp newCount+=1 end end self.throttleCache=newCache self.throttleCount=newCount end)end end)end
function UniverseLogs:init():(boolean,string?)if RunService:IsServer()then local ok,result=self.http:healthCheck()if not
ok then return false,`Health check failed: {tostring(result)}`end end self:_startFallbackLoop()self:
_startThrottleCleanupLoop()game:BindToClose(function()if self.buffer then self.buffer:flush():await(5)end end)if self.
config.autoReportErrors then ScriptContext.Error:Connect(function(message:string,stackTrace:string,sc:Instance)if self.
config.errorFilter then local ok,shouldReport=pcall(self.config.errorFilter,message,stackTrace,sc)if not ok or not
shouldReport then return end end self:error(`[Auto-Log] {message}`,{stack=stackTrace,instance=sc:GetFullName()})end)end
return true,nil end function UniverseLogs:destroy()if self._fallbackLoop then task.cancel(self._fallbackLoop)self.
_fallbackLoop=nil end if self._throttleCleanupLoop then task.cancel(self._throttleCleanupLoop)self._throttleCleanupLoop=
nil end self.buffer:destroy()end function UniverseLogs:log(level:LogLevel__MADE_BY_IAMTHEBESTTS_TYPE_a,message:string,options:{topic:
string?,metadata:any?,throttleKey:string?}?)local input:LogInput__MADE_BY_IAMTHEBESTTS_TYPE_c={level=level,message=message,topic=
options and options.topic or nil,metadata=(options and options.metadata)and Utils.sanitizeMetadata(options.metadata)or
nil,_id=Utils.generateId(),_ts=DateTime.now().UnixTimestamp}local throttleKey=(options and options.throttleKey)or`{level
}:{message}`local now=DateTime.now().UnixTimestamp local lastTimestamp=self.throttleCache[throttleKey]if lastTimestamp
and(now-lastTimestamp<self.config.throttleWindow)then return end local max=self.config.maxThrottleEntries or 5000 if
self.throttleCount>=max then if not lastTimestamp then return end end if not lastTimestamp then self.throttleCount+=1
end self.throttleCache[throttleKey]=now local valid,err=Utils.validateLogInput(input)if not valid then warn(`[UniverseLogs] Invalid log: {
err}`)return end if self.config.autoFlush then self.buffer:add(input)else task.spawn(function()self:_flushLogs({input})
end)end end function UniverseLogs:trace(msg,opts)return self:log('trace',msg,opts)end function UniverseLogs:debug(msg,
opts)return self:log('debug',msg,opts)end function UniverseLogs:info(msg,opts)return self:log('info',msg,opts)end
function UniverseLogs:warn(msg,opts)return self:log('warn',msg,opts)end function UniverseLogs:error(msg,opts)return self
:log('error',msg,opts)end function UniverseLogs:fatal(msg,opts)return self:log('fatal',msg,opts)end function
UniverseLogs:getLogs(filters)return self.http:getLogs(filters)end function UniverseLogs:getLogsCount(f)return self.http:
getLogsCount(f)end function UniverseLogs:getLogById(id)return self.http:getLogById(id)end function UniverseLogs:
deleteLogs(params)return self.http:deleteLogs(params)end debug.setmemorycategory('UniverseLogs By iamthebestts >;3')
debug.profilebegin('UniverseLogs By iamthebestts >;3')debug.profileend()UniverseLogs.__author='iamthebestts >;3'
UniverseLogs.__version='1.0.0'UniverseLogs.__license='MIT'UniverseLogs.__url=
'https://github.com/iamthebestts/UniverseLogs'return setmetatable(UniverseLogs,{__tostring=function()return
'UniverseLogs v1.0.0 by iamthebestts >;3'end,__metatable='Protected by iamthebestts >;3'})