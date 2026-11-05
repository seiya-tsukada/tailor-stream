# ローカル開発専用（Vercel では使わない）。ソースは docker-compose.yml でマウントする
FROM node:22-slim

WORKDIR /app

# node_modules はイメージ内に入れ、compose の匿名ボリュームでホスト側と分ける
# （macOS の node_modules にある esbuild などのネイティブバイナリを Linux で使わないため）
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
