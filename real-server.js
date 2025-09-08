// 生产环境支付宝支付服务器
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const AlipaySdk = require('alipay-sdk').default;
require('dotenv').config();

// 数据库和模型
const { connectDB, dbStatus } = require('./database');
const User = require('./User');
const Order = require('./Order');
const PointsLog = require('./PointsLog');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// 安全中间件
app.use(helmet({
  hsts: { 
    maxAge: 31536000, // 1年
    includeSubDomains: true,
    preload: true 
  }
}));

// 信任代理(Zeabur反向代理)
app.set('trust proxy', 1);

// CORS配置
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://qisi.shop',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 请求体解析
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// 速率限制配置
const createRateLimit = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false
});

// 支付宝SDK初始化
let alipaySDK = null;

function initAlipaySDK() {
  if (!process.env.ALIPAY_APP_ID || !process.env.ALIPAY_PRIVATE_KEY || !process.env.ALIPAY_PUBLIC_KEY) {
    console.error('❌ 支付宝配置不完整');
    return false;
  }

  try {
    alipaySDK = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY,
      gateway: process.env.ALIPAY_SERVER_URL || 'https://openapi.alipay.com/gateway.do',
      timeout: 30000,
      camelCase: true
    });
    console.log('✅ 支付宝SDK初始化成功');
    return true;
  } catch (error) {
    console.error('❌ 支付宝SDK初始化失败:', error);
    return false;
  }
}

// 健康检查
app.get('/healthz', async (req, res) => {
  try {
    const db = dbStatus();
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      database: db.connected ? 'connected' : 'disconnected',
      alipay: alipaySDK ? 'ready' : 'not_configured'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// 临时：检测Zeabur出口IP地址
app.get('/check-ip', async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('https://ipinfo.io/json', { timeout: 10000 });
    res.json({
      success: true,
      outboundIP: response.data.ip,
      location: `${response.data.city}, ${response.data.country}`,
      region: response.data.region,
      org: response.data.org,
      note: 'This is the IP that Zeabur uses to connect to external services like MongoDB'
    });
  } catch (error) {
    res.json({ 
      success: false,
      error: 'Failed to detect outbound IP',
      details: error.message
    });
  }
});

// 获取或创建默认用户(生产环境应该有用户注册系统)
async function getDefaultUser() {
  let user = await User.findOne({ username: 'defaultUser' });
  if (!user) {
    user = await User.create({
      username: 'defaultUser',
      email: 'user@qisi.shop',
      points: 0
    });
  }
  return user;
}

// 创建支付订单API
app.post('/api/points/recharge', 
  createRateLimit(60000, 30, '请求过于频繁，请稍后再试'),
  async (req, res) => {
    if (!alipaySDK) {
      return res.status(500).json({ 
        success: false, 
        error: '支付宝服务未就绪' 
      });
    }

    const { amount, paymentType = 'web' } = req.body;

    // 参数验证
    if (!amount || amount < 0.01 || amount > 10000) {
      return res.status(400).json({
        success: false,
        error: '金额必须在0.01-10000之间'
      });
    }

    if (!['web', 'mobile'].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        error: '无效的支付类型'
      });
    }

    try {
      // 获取用户
      const user = await getDefaultUser();
      
      // 生成订单ID
      const orderId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const points = Math.floor(amount * (process.env.POINTS_EXCHANGE_RATE || 100));

      // 创建订单记录
      const order = await Order.create({
        orderId,
        userId: user._id,
        amount,
        points,
        status: 'pending'
      });

      // 支付宝支付参数
      const method = paymentType === 'mobile' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
      const productCode = paymentType === 'mobile' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';

      const bizContent = {
        outTradeNo: orderId,
        totalAmount: amount.toString(),
        subject: '积分充值',
        body: `充值${amount}元获得${points}积分`,
        productCode
      };

      // 使用官方SDK生成支付链接
      const result = await alipaySDK.exec(method, {
        bizContent,
        notifyUrl: process.env.ALIPAY_NOTIFY_URL,
        returnUrl: process.env.ALIPAY_RETURN_URL
      });

      console.log(`✅ 创建支付订单: ${orderId}, 金额: ${amount}元`);

      res.json({
        success: true,
        orderId,
        amount,
        points,
        paymentUrl: result,
        message: '订单创建成功，请前往支付宝完成支付'
      });

    } catch (error) {
      console.error('创建支付订单失败:', error);
      res.status(500).json({ 
        success: false, 
        error: '订单创建失败，请稍后重试' 
      });
    }
  }
);

// 支付宝异步通知处理
app.post('/api/payment/alipay/notify',
  createRateLimit(60000, 120, '通知请求过于频繁'),
  async (req, res) => {
    console.log('收到支付宝异步通知');
    
    if (!alipaySDK) {
      console.error('支付宝SDK未初始化');
      return res.send('fail');
    }

    try {
      // 验签
      const isValid = alipaySDK.checkNotifySign(req.body);
      if (!isValid) {
        console.error('支付宝通知签名验证失败');
        return res.send('fail');
      }

      const { 
        out_trade_no: orderId, 
        trade_no: alipayTradeNo, 
        trade_status: tradeStatus, 
        total_amount: totalAmount,
        app_id: appId
      } = req.body;

      // 验证应用ID
      if (appId !== process.env.ALIPAY_APP_ID) {
        console.error('支付宝应用ID不匹配');
        return res.send('fail');
      }

      // 只处理支付成功的通知
      if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
        console.log(`订单 ${orderId} 支付状态: ${tradeStatus}`);
        return res.send('success');
      }

      // 幂等处理：查找并更新订单状态
      const order = await Order.findOneAndUpdate(
        { orderId, status: 'pending' },
        { 
          status: 'success',
          alipayTradeNo,
          paymentTime: new Date()
        },
        { new: true }
      );

      if (!order) {
        console.log(`订单 ${orderId} 已处理或不存在`);
        return res.send('success');
      }

      // 验证金额
      if (parseFloat(totalAmount) !== order.amount) {
        console.error(`订单 ${orderId} 金额不匹配: 预期${order.amount}, 实际${totalAmount}`);
        return res.send('fail');
      }

      // 更新用户积分
      const user = await User.findByIdAndUpdate(
        order.userId,
        { $inc: { points: order.points } },
        { new: true }
      );

      // 记录积分变动日志
      await PointsLog.create({
        userId: order.userId,
        type: 'recharge',
        delta: order.points,
        orderId: orderId,
        description: `支付成功充值: ${order.amount}元`
      });

      console.log(`🎉 支付成功! 订单: ${orderId}, 用户积分: ${user.points}`);
      res.send('success');

    } catch (error) {
      console.error('处理支付宝通知失败:', error);
      res.send('fail');
    }
  }
);

// 支付成功跳转页面
app.get('/payment/success', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>支付成功</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 500px; margin: 0 auto; }
        h1 { color: #52c41a; margin-bottom: 20px; }
        .success-icon { font-size: 80px; margin-bottom: 20px; }
        button { padding: 15px 30px; background: #1890ff; color: white; 
                border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">🎉</div>
        <h1>支付成功！</h1>
        <p>您的充值已完成，积分将在几分钟内到账</p>
        <button onclick="window.close()">关闭窗口</button>
    </div>
</body>
</html>
  `);
});

// 用户积分查询API  
app.get('/api/points/balance', async (req, res) => {
  try {
    const user = await getDefaultUser();
    res.json({
      success: true,
      points: user.points
    });
  } catch (error) {
    console.error('查询积分失败:', error);
    res.status(500).json({
      success: false,
      error: '查询失败'
    });
  }
});

// 交易记录查询API
app.get('/api/orders/history', async (req, res) => {
  try {
    const user = await getDefaultUser();
    const orders = await Order.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('orderId amount points status alipayTradeNo createdAt');

  res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('查询订单失败:', error);
    res.status(500).json({
      success: false,
      error: '查询失败'
    });
  }
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 启动服务器（优化：DB失败不中止进程）
async function startServer() {
  // 连接数据库
  try {
    await connectDB();
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败，服务将在无数据库模式下启动:', error.message);
  }
  
  // 初始化支付宝SDK
  initAlipaySDK();
  
  // 启动HTTP服务器（显式绑定 0.0.0.0）
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 生产环境服务器启动成功!`);
    console.log(`🌐 服务器地址: http://0.0.0.0:${PORT}`);
    console.log(`🔧 健康检查: http://0.0.0.0:${PORT}/healthz`);
    console.log(`💳 支付服务: ${alipaySDK ? '就绪' : '未配置'}`);
    console.log(`🗄️  数据库: ${dbStatus().connected ? '已连接' : '未连接'}`);
  });
}

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});

// 启动应用
startServer();
