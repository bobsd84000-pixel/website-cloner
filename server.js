import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error('Missing ANTHROPIC_API_KEY environment variable.');
  process.exit(1);
}

async function handleClone(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  let url;
  try {
    url = String(JSON.parse(Buffer.concat(chunks).toString() || '{}').url ?? '').trim();
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid JSON body.' }));
  }

  if (!/^https?:\/\/.+/.test(url)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'A valid http(s) URL is required.' }));
  }

  const cleanUrl = url.replace(/^https?:\/\//, '');
  const screenshotUrl = `https://image.thum.io/get/width/1280/https://${cleanUrl}`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: screenshotUrl } },
            {
              type: 'text',
              text: "Genere HTML pur qui clone ce design exactement. Retourne UNIQUEMENT du HTML valide, pas d'explications. <!DOCTYPE html> complet avec <style> et contenu.",
            },
          ],
        }],
      }),
    });

    const data = await upstream.json();
    res.writeHead(data.error ? upstream.status : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data.error ? { error: data.error.message } : { html: data.content[0].text }));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

async function handleStatic(req, res) {
  const filePath = req.url === '/' ? '/index.html' : req.url;
  try {
    const body = await readFile(path.join(__dirname, filePath));
    const ext = path.extname(filePath);
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/clone') return handleClone(req, res);
  if (req.method === 'GET') return handleStatic(req, res);
  res.writeHead(405);
  res.end();
});

const port = process.env.PORT || 8787;
server.listen(port, () => console.log(`website-cloner listening on http://localhost:${port}`));
