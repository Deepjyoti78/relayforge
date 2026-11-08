const http = require('node:http');

const PORT = process.env.RECEIVER_PORT || 9999;

let config = {
  statusCode: 200,
  delayMs: 0,
  retryAfterSeconds: null,
  failRate: 0, // 0 = never fail, 1.0 = always fail
};

const stats = {
  totalReceived: 0,
  successCount: 0,
  failureCount: 0,
  recentDeliveries: [],
  startTime: Date.now(),
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health and stats
  if (req.method === 'GET' && url.pathname === '/stats') {
    res.writeHead(200, { 'content-type': 'application/json' });
    const uptimeSec = Math.max(1, Math.floor((Date.now() - stats.startTime) / 1000));
    return res.end(
      JSON.stringify({
        ...stats,
        uptimeSec,
        throughputRps: (stats.totalReceived / uptimeSec).toFixed(2),
        config,
      }),
    );
  }

  // Reset counters
  if (req.method === 'POST' && url.pathname === '/reset') {
    stats.totalReceived = 0;
    stats.successCount = 0;
    stats.failureCount = 0;
    stats.recentDeliveries = [];
    stats.startTime = Date.now();
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Stats reset' }));
  }

  // Configuration endpoint
  if (req.method === 'POST' && url.pathname === '/config') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        config = { ...config, ...parsed };
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'Configuration updated', config }));
      } catch (err) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON config' }));
      }
    });
    return;
  }

  // Main webhook destination endpoint
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      stats.totalReceived++;

      const deliveryId = req.headers['x-relayforge-delivery'];
      const eventId = req.headers['x-relayforge-event-id'];
      const eventType = req.headers['x-relayforge-event'];
      const timestamp = req.headers['x-relayforge-timestamp'];
      const signature = req.headers['x-relayforge-signature'];

      if (stats.recentDeliveries.length > 50) {
        stats.recentDeliveries.shift();
      }
      stats.recentDeliveries.push({
        time: new Date().toISOString(),
        deliveryId,
        eventId,
        eventType,
        timestamp,
        hasSignature: Boolean(signature),
      });

      const executeResponse = () => {
        let code = config.statusCode;
        if (config.failRate > 0 && Math.random() < config.failRate) {
          code = 503;
        }

        const headers = { 'content-type': 'application/json' };
        if (code === 429 && config.retryAfterSeconds) {
          headers['retry-after'] = String(config.retryAfterSeconds);
        }

        if (code >= 200 && code < 300) {
          stats.successCount++;
        } else {
          stats.failureCount++;
        }

        res.writeHead(code, headers);
        res.end(
          JSON.stringify({
            received: true,
            status: code >= 200 && code < 300 ? 'accepted' : 'rejected',
            deliveryId,
            eventId,
          }),
        );
      };

      if (config.delayMs > 0) {
        setTimeout(executeResponse, config.delayMs);
      } else {
        executeResponse();
      }
    });
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Controlled Receiver] Listening on http://127.0.0.1:${PORT}`);
});
