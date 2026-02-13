/**
 * Vite 服务端中间件插件 — 七牛云 API
 * 
 * 提供两个 API：
 *   POST /api/qiniu/upload-token  — 生成上传凭证
 *   POST /api/qiniu/delete        — 删除云端文件
 * 
 * 密钥仅在 Node.js 进程中使用，不暴露给前端
 */

import type { Plugin } from 'vite';
import qiniu from 'qiniu';

interface QiniuServerConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
}

export function qiniuServerPlugin(config: QiniuServerConfig): Plugin {
  return {
    name: 'qiniu-server-api',
    configureServer(server) {
      const mac = new qiniu.auth.digest.Mac(config.accessKey, config.secretKey);

      // POST /api/qiniu/upload-token
      server.middlewares.use('/api/qiniu/upload-token', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // 读取请求体
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { key } = body ? JSON.parse(body) : { key: undefined };

            const putPolicy = new qiniu.rs.PutPolicy({
              scope: key ? `${config.bucket}:${key}` : config.bucket,
              expires: 3600, // 1 小时有效
            });
            const token = putPolicy.uploadToken(mac);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ token, key }));
          } catch (err) {
            console.error('[Qiniu Server] Token 生成失败:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Token 生成失败' }));
          }
        });
      });

      // POST /api/qiniu/delete
      server.middlewares.use('/api/qiniu/delete', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { key } = JSON.parse(body);
            if (!key) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: '缺少 key 参数' }));
              return;
            }

            const bucketManager = new qiniu.rs.BucketManager(mac, new qiniu.conf.Config());
            
            await new Promise<void>((resolve, reject) => {
              bucketManager.delete(config.bucket, key, (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            console.error('[Qiniu Server] 删除失败:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: '删除失败' }));
          }
        });
      });

      console.log('[Qiniu Server] API 中间件已启动');
      console.log('  POST /api/qiniu/upload-token');
      console.log('  POST /api/qiniu/delete');
    },
  };
}
