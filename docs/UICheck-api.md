# UI 检查构建

本文档描述 MTAT 网关下 **UI 检查** 相关接口：**仅支持 AI 自动化构建**（自然语言指令，对应 [MTAT 构建管理](./MTAT-api.md) 中 AI 分支语义），不支持用例 ID 的常规自动化。路径前缀为 `/UICheck`，并**扩展**可选入参 `callback_url`（构建终态 Webhook + ZIP 地址）。

## API 列表


| 端点                                 | 方法   | 用途                   |
| ---------------------------------- | ---- | -------------------- |
| `/UICheck/build`                   | POST | UI 检查构建（仅 AI 自动化，异步） |
| `/UICheck/buildStatus/{requestId}` | GET  | 查询构建请求状态             |


---

## UI 检查构建

> 触发 **AI 自动化** UI 检查构建：`cmds` 为自然语言步骤描述，**不支持**传入用例 ID 走常规自动化。采用**异步模式**，立即返回 `requestId`。构建**终态**（成功或失败）后，可选通过 `callback_url` 推送结果与报告包下载地址；亦可继续通过 `/UICheck/buildStatus/{requestId}` 轮询。

### curl 示例

```bash
curl -s \
  "https://connectors.meitu-int.com/gateway/api.mtatpro.meitu-int.com/UICheck/build" \
  -H "Authorization: Bearer ${OMNIBUS_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "side": 2,
    "projectId": 29,
    "pkgUid": "97485",
    "pkgVariant": "setup64Release",
    "cmds": [
      {"cmd":"打开相机拍照，保存图片","imgName":"camera"},
      {"cmd":"美图秀秀-美化美容 / 人像美容 / 丰盈提拉 / 面部丰盈_素材未选中","imgName":"面部丰盈_素材未选中"}
      ],
    "deviceId": 0,
    "callback_url": "https://your-service.example.com/v1/uicheck/callback"
  }'
```

`callback_url` 可省略；省略时仅靠轮询 `buildStatus` 获取终态。

### 入参说明


| 参数           | 类型       | 必填  | 说明                                                                                                     |
| ------------ | -------- | --- | ------------------------------------------------------------------------------------------------------ |
| side         | int      | ✅   | **UICheck 仅支持 AI 自动化，当前仅支持 Android**，须传 `2`。传 `1`（iOS）或其它值将返回错误                                        |
| projectId    | int      | ✅   | 项目 ID（会先固定美图秀秀）                                                                                        |
| pkgUid       | string   | ✅   | 安装包 number（需要测试的安装包构建ID）                                                                               |
| pkgVariant   | string   | ✅   | 安装包变种，如 `release`、`debug`、`setup64Release`                                                             |
| cmds         | object[] | ✅   | **自然语言指令列表**，每个元素为JSONObject，必须包含`cmd`和`imgName`字段                  |
| deviceId     | int      |     | 设备 ID，大于 0 表示使用指定设备立即构建，不填或 0 表示使用固定测试设备                                                               |
| callback_url | string   |     | 构建进入**终态**后，服务端向该地址发起 **HTTP POST** 回调（见下文「构建完成回调」）。须为 **HTTPS** 公网可达 URL；不传则仅能通过轮询 `buildStatus` 获知结果 |

**cmds 对象内部字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|-----|------|:---:|------|
| cmd | string | ✅ | 自然语言指令，描述要执行的UI操作 |
| imgName | string | ✅ | 关联的图片名称，用于UI核对时对比参考（key） |


### 构建完成回调（`callback_url`）

当本次请求的 `requestId` 对应构建结束（成功 `status=3` 或失败 `status=4`）且产物已就绪时，MTAT 向 `callback_url` 发送**单次**通知（与 `/UICheck/buildStatus` 中 `status` 语义一致）。


| 项目             | 约定                                                                                    |
| -------------- | ------------------------------------------------------------------------------------- |
| HTTP 方法        | `POST`                                                                                |
| `Content-Type` | `application/json; charset=utf-8`                                                     |
| 请求体            | JSON 对象，见下表                                                                           |
| 鉴权             | 服务端不携带调用方 `Authorization`；**内部系统**以网络隔离（内网 / 白名单等）为准，凭 body 中 `request_id` 等与本地任务关联即可 |
| 超时             | 建议调用方在 **10s** 内返回 HTTP **2xx**；非 2xx 或超时将按重试策略重发                                     |
| 幂等             | 同一 `request_id` 的终态回调，语义上**至多成功投递一次**；调用方应按 `request_id` 去重                           |


**回调请求体字段**


| 字段               | 类型     | 必填   | 说明                                                          |
| ---------------- | ------ | ---- | ----------------------------------------------------------- |
| `event`          | string | ✅    | 固定为 `uicheck.build.completed`，便于调用方路由多类 Webhook             |
| `request_id`     | int    | ✅    | 与提交构建时返回的 `response.requestId` 一致                           |
| `build_id`       | string | 条件   | 构建号；失败且尚未生成构建号时可为空字符串                                       |
| `status`         | int    | ✅    | 终态：`3` 成功、`4` 失败（与 `buildStatus` 中 `response.status` 一致）    |
| `result`         | string |      | 失败原因或补充说明；成功时可为空字符串                                         |
| `report_zip_url` | string | null | 条件                                                          |
| `completed_at`   | string | ✅    | 构建终态时间，**RFC 3339** / ISO 8601，例：`2026-03-26T08:30:00.000Z` |


**回调示例（成功，含 ZIP）**

```json
{
  "event": "uicheck.build.completed",
  "request_id": 1001,
  "build_id": "AUT202603180042",
  "status": 3,
  "result": "",
  "report_zip_url": "https://storage.example.com/reports/AUT202603180042.zip?sig=...",
  "completed_at": "2026-03-26T08:30:00.000Z"
}
```

**回调示例（失败，无包）**

```json
{
  "event": "uicheck.build.completed",
  "request_id": 1002,
  "build_id": "",
  "status": 4,
  "result": "设备离线导致构建失败",
  "report_zip_url": null,
  "completed_at": "2026-03-26T08:35:12.000Z"
}
```

**调用方 URL 设计建议**

- 路径：使用不易猜测的路径段，例如 `/v1/uicheck/callback`。
- 方法：仅接受 `POST`，其它方法返回 `405`。
- 响应：收到合法回调后返回 `200` 与短 JSON，例如 `{"received": true}`；业务入队异步处理，避免在 Webhook 内做长时间任务。
- 安全：内网场景建议仍使用 **HTTPS**；可选校验 `request_id` 是否为本系统近期发起的构建。

### 响应示例

```json
{
  "code": 200,
  "msg": "构建请求已提交，正在后台异步处理",
  "response": {
    "requestId": 1001
  },
  "timestamp": 1710734400000
}
```

### 响应字段说明


| 字段                 | 类型     | 说明               |
| ------------------ | ------ | ---------------- |
| code               | int    | 状态码，200 表示成功     |
| msg                | string | 消息               |
| response           | object | 响应数据对象           |
| response.requestId | int    | 请求 ID，用于后续查询构建状态 |


### 构建模式说明

UICheck **固定为 AI 自动化**（与通用构建里 `buildType=2` 语义一致），不再根据 `cmds` 是否像用例 ID 做分支；调用方只需提供自然语言 `cmds`。

### 注意事项

1. **应用端**： **Android**（`side=2`） **iOS**（`side=1`）
2. **设备选择**：
  - `deviceId > 0`：使用指定设备立即构建（需设备空闲）
  - `deviceId = 0` 或不传：使用系统配置的固定测试设备
3. **异步模式**：接口立即返回 `requestId`。若未传 `callback_url`，需调用 `/UICheck/buildStatus/{requestId}` 轮询直至终态；若已传 `callback_url`，仍可同时轮询，以回调为准或互为备份
4. - `cmds` 字段是 JSONObject 数组，每个元素必须包含 `cmd`（自然语言指令）和 `imgName`（图片名称）两个字段
   - `cmd` 支持中文描述，系统会解析并执行对应的UI操作
   - `imgName` 用于UI核对时对比参考图片
   - 指令需要具体明确，避免模糊描述
   - 传入空数组或缺少 `cmd`/`imgName` 字段会返回参数错误

5. **错误响应示例**：

```json
{
  "code": 400,
  "msg": "找不到项目"
}
```

```json
{
  "code": 400,
  "msg": "cmds 必填"
}
```

```json
{
  "code": 400,
  "msg": "cmds[0].cmd 必填"
}
```

```json
{
  "code": 400,
  "msg": "cmds[0].imgName 必填"
}
```


---

## 查询构建请求状态

> 通过 `requestId` 查询 UI 检查构建请求的执行状态、buildId、重试次数等。字段与行为与 [MTAT-api.md](./MTAT-api.md) 中「查询构建请求状态」一致，仅路径不同。

### curl 示例

```bash
curl -s \
  "https://connectors.meitu-int.com/gateway/api.mtatpro.meitu-int.com/UICheck/buildStatus/25" \
  -H "Authorization: Bearer ${OMNIBUS_ACCESS_TOKEN}"
```

### 入参说明


| 参数        | 类型  | 必填  | 说明          |
| --------- | --- | --- | ----------- |
| requestId | int | ✅   | 请求 ID（路径参数） |


### 响应示例

```json
{
  "code": 200,
  "msg": "查询成功",
  "response": {
    "status": 3,
    "buildId": "AUT202603180042",
    "retryCount": 0,
    "result": ""
  },
  "timestamp": 1710734400000
}
```

### 响应字段说明


| 字段                  | 类型     | 说明                                                    |
| ------------------- | ------ | ----------------------------------------------------- |
| code                | int    | 状态码，200 表示成功                                          |
| msg                 | string | 消息                                                    |
| response            | object | 响应数据对象                                                |
| response.status     | int    | 请求状态，枚举值：`0`(待构建)、`1`(设备触发中)、`2`(构建中)、`3`(成功)、`4`(失败) |
| response.buildId    | string | 关联的构建号，构建完成后返回                                        |
| response.retryCount | int    | 触发重试次数                                                |
| response.result     | string | 失败原因或结果说明                                             |


### 请求状态 (status) 说明


| 值   | 状态    | 说明                    |
| --- | ----- | --------------------- |
| 0   | 待构建   | 请求已提交，等待处理            |
| 1   | 设备触发中 | 正在分配/触发测试设备           |
| 2   | 构建中   | 构建任务正在执行              |
| 3   | 成功    | 构建成功完成                |
| 4   | 失败    | 构建失败，查看 result 字段了解原因 |


