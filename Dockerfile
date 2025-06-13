FROM node:20-alpine

WORKDIR /usr/src/app

# Cria usuário não-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copia os arquivos necessários da máquina local
COPY server ./server
COPY dist ./dist
COPY package*.json ./
COPY node_modules ./node_modules  

# Permissões
RUN chown -R appuser:appgroup /usr/src/app
USER appuser

ENV NODE_ENV=production
ENV HTTPS_PORT=3003
ENV SSL_KEY_PATH=/usr/src/app/ssl/server.key
ENV SSL_CERT_PATH=/usr/src/app/ssl/server.crt

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const https = require('https'); const options = { hostname: 'localhost', port: 3003, path: '/api/health', method: 'GET', rejectUnauthorized: false }; const req = https.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "server/index.js"]
