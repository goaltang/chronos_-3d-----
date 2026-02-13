import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { qiniuServerPlugin } from './server/qiniuServerPlugin';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isQiniu = env.STORAGE_PROVIDER === 'qiniu';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        // 七牛云模式下启用服务端 API 中间件（Token 生成 + 文件删除）
        ...(isQiniu ? [qiniuServerPlugin({
          accessKey: env.QINIU_ACCESS_KEY || '',
          secretKey: env.QINIU_SECRET_KEY || '',
          bucket: env.QINIU_BUCKET || '',
          domain: env.QINIU_DOMAIN || '',
        })] : []),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        // 存储配置（仅传前端需要的非敏感信息）
        'process.env.STORAGE_PROVIDER': JSON.stringify(env.STORAGE_PROVIDER || 'local'),
        'process.env.QINIU_BUCKET': JSON.stringify(env.QINIU_BUCKET || ''),
        'process.env.QINIU_DOMAIN': JSON.stringify(env.QINIU_DOMAIN || ''),
        // ⚠️ ACCESS_KEY 和 SECRET_KEY 不再注入前端，仅在服务端使用
        'process.env.QINIU_TOKEN_ENDPOINT': JSON.stringify(env.QINIU_TOKEN_ENDPOINT || '/api/qiniu/upload-token'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
