const WebSocket = require('ws');
const http = require('http');

// ایجاد سرور HTTP
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// ذخیره اتصالات کاربران
const users = new Map();

wss.on('connection', (ws) => {
  let userId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'register':
          // ثبت کاربر جدید
          userId = data.userId;
          users.set(userId, ws);
          console.log(`User registered: ${userId}`);
          
          // تأیید ثبت‌نام
          ws.send(JSON.stringify({
            type: 'registered',
            userId: userId
          }));
          break;

        case 'offer':
          // ارسال offer به کاربر مقصد
          const targetUser = users.get(data.target);
          if (targetUser && targetUser.readyState === WebSocket.OPEN) {
            targetUser.send(JSON.stringify({
              type: 'offer',
              from: userId,
              offer: data.offer
            }));
          }
          break;

        case 'answer':
          // ارسال answer به کاربر مبدأ
          const caller = users.get(data.target);
          if (caller && caller.readyState === WebSocket.OPEN) {
            caller.send(JSON.stringify({
              type: 'answer',
              from: userId,
              answer: data.answer
            }));
          }
          break;

        case 'candidate':
          // ارسال candidate ICE
          const peer = users.get(data.target);
          if (peer && peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({
              type: 'candidate',
              from: userId,
              candidate: data.candidate
            }));
          }
          break;

        case 'message':
          // ارسال پیام متنی
          const recipient = users.get(data.target);
          if (recipient && recipient.readyState === WebSocket.OPEN) {
            recipient.send(JSON.stringify({
              type: 'message',
              from: userId,
              message: data.message
            }));
          }
          break;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      users.delete(userId);
      console.log(`User disconnected: ${userId}`);
    }
  });
});

// برای Vercel Serverless Functions
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ 
    status: 'Signaling server is running',
    users: users.size
  });
};

// برای اجرای محلی
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
  });
}