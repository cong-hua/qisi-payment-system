# Zeabur部署指南

## 📁 部署文件清单
```
deploy-files/
├── real-server.js     # 主服务器文件
├── package.json       # 项目配置
├── package-lock.json  # 依赖版本锁定
├── zeabur.json       # Zeabur部署配置
├── .env.example      # 环境变量示例
├── config/           # 配置文件
│   └── database.js   # 数据库配置
├── models/           # 数据模型
│   ├── User.js       # 用户模型
│   ├── Order.js      # 订单模型
│   └── PointsLog.js  # 积分日志模型
└── DEPLOY.md         # 部署说明（本文件）
```

## 🚀 Zeabur部署步骤

### 1. 上传文件到Zeabur
- 将整个deploy-files文件夹上传到Zeabur项目

### 2. 配置环境变量
在Zeabur项目设置中添加以下环境变量：

#### 必需的环境变量：
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://congluo19_db_user:7xlhPXM6WWhH29yH@cluster0.nungpf1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
ALIPAY_PRIVATE_KEY=[您的支付宝RSA私钥]
ALIPAY_PUBLIC_KEY=[您的支付宝RSA公钥]
```

#### 其他变量（已在代码中设置默认值）：
```
SERVER_PORT=3000
ALIPAY_APP_ID=2021005182641746
ALIPAY_SERVER_URL=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://qisi.shop/api/payment/alipay/notify
ALIPAY_RETURN_URL=https://qisi.shop/payment/success
CORS_ORIGIN=https://qisi.shop
POINTS_EXCHANGE_RATE=100
```

### 3. 域名配置
- 绑定域名：qisi.shop
- 启用SSL证书

### 4. 验证部署
- 访问：https://qisi.shop/healthz
- 确认返回正常的健康检查信息

## 🔧 故障排除

### 常见问题：
1. **数据库连接失败**：检查MONGODB_URI是否正确
2. **支付宝初始化失败**：检查RSA密钥格式和完整性
3. **域名访问失败**：检查DNS解析和SSL证书

### 环境变量格式说明：
- RSA私钥需包含完整的头尾：`-----BEGIN RSA PRIVATE KEY-----` 和 `-----END RSA PRIVATE KEY-----`
- RSA公钥需包含完整的头尾：`-----BEGIN PUBLIC KEY-----` 和 `-----END PUBLIC KEY-----`