# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

1. package.json

```json
{
  "name": "intelligent-agent",
  "version": "4.0.0",
  "description": "Advanced web scraping and AI agent with skills, scheduling, API, and memory",
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js",
    "api": "node agent.js --api",
    "scheduler": "node agent.js --scheduler",
    "test": "node tests/run-tests.js"
  },
  "dependencies": {
    "playwright": "^1.45.0",
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "express": "^4.19.2",
    "better-sqlite3": "^9.4.3",
    "node-cron": "^3.0.3",
    "sharp": "^0.33.4",
    "dotenv": "^16.4.5",
    "openai": "^4.40.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "p-limit": "^3.1.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0",
    "express-validator": "^7.0.1",
    "uuid": "^9.0.1",
    "@xenova/transformers": "^2.14.1",
    "sqlite-vec": "^0.1.6"
  },
  "devDependencies": {
    "supertest": "^6.3.4"
  }
}
```

---

2. config.json

```json
{
  "provider": "ollama",
  "model": "llama3",
  "visionModel": "llava",
  "chunkSize": 4000,
  "chunkOverlap": 200,
  "imageMaxSize": 1024,
  "imageQuality": 80,
  "imageFormat": "jpeg",
  "headless": true,
  "proxyList": [],
  "proxyFile": null,
  "apiPort": 3000,
  "dbPath": "./data/agent.db",
  "dataRetentionDays": 30,
  "maxParallelAiCalls": 3,
  "maxSummaryChunks": 5,
  "allowedOrigins": ["http://localhost:3000"],
  "apiRateLimitWindowMs": 900000,
  "apiRateLimitMax": 100,
  "webhookUrl": "",
  "embeddingMethod": "auto",
  "enableFTS": true
}
```

---

3. .env.example

```env
OPENAI_API_KEY=sk-...
API_AUTH_TOKEN=your-secret-token
PROXY=http://user:pass@host:port
NODE_ENV=production
WEBHOOK_URL=
```

---

4. schedule.json

```json
[]
```

---

5. agent.js

```javascript
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { scrape } = require('./core/scraper');
const { runSkill, loadSkills, listSkills } = require('./core/skills');
const { initDatabase, saveResult, getResults, searchResults, cleanupOldResults } = require('./core/memory');
const { startScheduler } = require('./core/scheduler');
const { loadProxies, getNextProxy, getRandomProxy } = require('./core/proxy');
const { initHumanizer, humanizeText } = require('./core/humanizer');
const { applyScientificMethodology } = require('./core/scientific');
const { callAI } = require('./core/ai');
const { smartSplit, preprocessImage, logError } = require('./core/utils');
const { initVectorTable, indexText, searchSimilar } = require('./core/vector');
const { setEmbeddingMethod } = require('./core/embedding');
const config = require('./config.json');

let db = null;

async function main() {
  // تهيئة قاعدة البيانات
  db = initDatabase(config.dbPath);
  console.log('🗄️ Database initialized.');

  // تنظيف النتائج القديمة
  cleanupOldResults(config.dataRetentionDays || 30);

  // تهيئة جدول المتجهات
  try {
    initVectorTable(db);
  } catch (e) {
    console.warn('⚠️ تعذر تهيئة جدول المتجهات:', e.message);
  }

  // تحميل البروكسيات
  await loadProxies(config.proxyFile || null);

  // تحميل المهارات
  await loadSkills();

  // تهيئة الـ Humanizer
  await initHumanizer();

  const args = process.argv.slice(2);

  // خيارات خاصة
  if (args.includes('--api')) {
    console.log('🌐 Starting API server...');
    require('./api/server');
    return;
  }

  if (args.includes('--scheduler')) {
    console.log('⏰ Starting scheduler...');
    startScheduler();
    return;
  }

  if (args.includes('--list-skills')) {
    console.log('🧠 Available skills:');
    listSkills().forEach(name => console.log(` - ${name}`));
    return;
  }

  const opts = parseArgs(args);
  if (!opts) return;

  // تطبيق الإعدادات الافتراضية من config
  opts.provider = opts.provider || config.provider || 'auto';
  opts.model = opts.model || config.model || 'llama3';
  opts.visionModel = opts.visionModel || config.visionModel || 'llava';
  opts.chunkSize = opts.chunkSize || config.chunkSize || 4000;
  opts.chunkOverlap = opts.chunkOverlap || config.chunkOverlap || 200;
  opts.imageMaxSize = opts.imageMaxSize || config.imageMaxSize || 1024;
  opts.imageQuality = opts.imageQuality || config.imageQuality || 80;
  opts.imageFormat = opts.imageFormat || config.imageFormat || 'jpeg';
  opts.headless = config.headless !== false;
  opts.maxParallelAiCalls = opts.maxParallelAiCalls || config.maxParallelAiCalls || 3;

  // ضبط طريقة توليد المتجهات
  const embeddingMethod = opts.embeddingMethod || config.embeddingMethod || 'auto';
  setEmbeddingMethod(embeddingMethod);
  console.log(`🧬 طريقة التضمين: ${embeddingMethod}`);

  // البحث الدلالي
  if (opts.semanticSearch) {
    console.log(`🔍 البحث الدلالي عن: "${opts.semanticSearch}"`);
    const results = await searchSimilar(opts.semanticSearch, opts.searchLimit || 5);
    results.forEach((r, i) => console.log(`${i + 1}. ${r.text} (distance: ${r.distance?.toFixed(4) ?? ''})`));
    return;
  }

  // بحث عادي في النتائج
  if (opts.search) {
    const results = searchResults(opts.search, opts.searchLimit || 10);
    console.log(`Search results for "${opts.search}":`);
    results.forEach(r => console.log(`- [${r.type}] ${r.input?.slice(0, 80)}...`));
    return;
  }

  // وضع MCP
  if (opts.useMcp) {
    const { connectMCP, disconnectMCP, callMCPTool, listMCPTools } = require('./core/mcp-client');
    await connectMCP(opts.mcpCommand || 'cargo', ['run', '--', '--mcp']);
    const tools = await listMCPTools();
    console.log('🛠️ MCP Tools:', tools.map(t => t.name).join(', '));

    if (opts.url) {
      await callMCPTool('navigate', { url: opts.url });
      const extractResult = await callMCPTool('extract', { format: 'json' });
      console.log('📄 MCP Extract Result:', extractResult);
    }
    await disconnectMCP();
    return;
  }

  // تنفيذ مهارة
  if (opts.skill) {
    let inputText = '';
    if (opts.inputUrl) {
      console.log(`🌐 Scraping content from: ${opts.inputUrl}`);
      const data = await scrape(opts.inputUrl, opts);
      inputText = data.paragraphs.join('\n');
      console.log(`📄 Extracted ${inputText.length} chars from URL`);
    } else if (opts.inputImage) {
      inputText = 'The task is to analyze the attached image.';
    } else if (opts.input) {
      inputText = opts.input;
    } else if (opts.inputFile) {
      inputText = await fs.readFile(opts.inputFile, 'utf-8');
    } else {
      console.error('❌ You must provide input via --input, --input-file, --input-image, or --input-url');
      process.exit(1);
    }

    console.log(`🧠 Running skill: ${opts.skill}`);
    const result = await runSkill(opts.skill, inputText, opts);
    if (result) {
      const fileName = `skill_${opts.skill}_${Date.now()}.md`;
      await fs.writeFile(fileName, result, 'utf-8');
      saveResult('skill', opts.skill, result);
      // فهرسة دلالية
      try {
        await indexText(JSON.stringify({ skill: opts.skill, input: inputText, output: result }));
      } catch (e) {}
      console.log(`✅ Result saved to ${fileName}`);
    }
    return;
  }

  // المنهجية العلمية
  if (opts.scientific) {
    console.log('🔬 Running scientific methodology...');
    const result = await applyScientificMethodology(opts.scientific, opts);
    if (result) {
      const fileName = `scientific_analysis_${Date.now()}.md`;
      await fs.writeFile(fileName, result, 'utf-8');
      saveResult('scientific', opts.scientific, result);
      try {
        await indexText(JSON.stringify({ topic: opts.scientific, output: result }));
      } catch (e) {}
      console.log(`✅ Analysis saved to ${fileName}`);
    }
    return;
  }

  // استخراج بيانات
  if (opts.url) {
    console.log('🚀 Starting scraping...');
    const urls = opts.url.split(',').map(u => u.trim()).filter(Boolean);

    if (urls.length > 1 && opts.parallel) {
      console.log(`🔄 Parallel scraping ${urls.length} URLs...`);
      const { default: pLimit } = await import('p-limit');
      const limit = pLimit(opts.maxParallelAiCalls || 3);
      const results = await Promise.all(
        urls.map(u => limit(() => scrape(u, opts)))
      );
      for (let i = 0; i < results.length; i++) {
        const fileName = `output_${uuidv4()}_${Date.now()}.json`;
        await fs.writeFile(fileName, JSON.stringify(results[i], null, 2), 'utf-8');
        saveResult('scrape', urls[i], JSON.stringify(results[i]));
        try {
          await indexText(JSON.stringify({ url: urls[i], data: results[i] }));
        } catch (e) {}
      }
      console.log(`✅ Saved ${results.length} scrape results`);
    } else {
      // اختيار بروكسي عشوائي
      const proxy = getRandomProxy();
      if (proxy) opts.proxy = proxy;

      const data = await scrape(opts.url, opts);
      if (opts.humanize) {
        console.log('🧠 Humanizing text...');
        if (data.title) data.title = await humanizeText(data.title, opts);
        if (Array.isArray(data.paragraphs)) {
          data.paragraphs = await Promise.all(data.paragraphs.map(p => humanizeText(p, opts)));
        }
      }

      const fileName = `output_${uuidv4()}_${Date.now()}.json`;
      await fs.writeFile(fileName, JSON.stringify(data, null, 2), 'utf-8');
      saveResult('scrape', opts.url, JSON.stringify(data));
      try {
        await indexText(JSON.stringify({ url: opts.url, data: data }));
      } catch (e) {}
      console.log(`✅ Data saved to ${fileName}`);
    }
    return;
  }

  console.log('ℹ️ No valid task specified. Use --help for usage.');
}

function parseArgs(args) {
  const opts = {
    url: null,
    humanize: false,
    theme: null,
    model: null,
    provider: null,
    retries: 3,
    scientific: null,
    skill: null,
    input: null,
    inputFile: null,
    inputImage: null,
    inputUrl: null,
    listSkills: false,
    chunkSize: null,
    chunkOverlap: null,
    chunkStrategy: 'sentences',
    summarizeChunks: false,
    visionModel: null,
    imageMaxSize: null,
    imageQuality: null,
    imageFormat: null,
    useMcp: false,
    mcpCommand: null,
    mcpTool: null,
    useSessions: false,
    useProxy: false,
    proxyFile: null,
    parallel: false,
    search: null,
    searchLimit: 10,
    semanticSearch: null,
    embeddingMethod: null
  };

  if (args.includes('--help')) {
    console.log(`
Usage:
  node agent.js <url> [options]
  node agent.js --scientific "topic" [options]
  node agent.js --skill <name> [--input "text" | --input-file file | --input-url url | --input-image image] [options]
  node agent.js --list-skills
  node agent.js --api
  node agent.js --scheduler
  node agent.js --search "query"
  node agent.js --semantic-search "query"
  node agent.js --mcp [--url url] [--mcp-command command]

Options:
  --humanize              Enable humanization
  --theme <name>          Theme for humanization
  --provider <openai|ollama|auto>
  --model <name>          Model name for text
  --vision-model <name>   Model name for vision
  --chunk-size <num>      Chunk size for long texts
  --chunk-overlap <num>   Overlap between chunks
  --chunk-strategy <chars|sentences|paragraphs>
  --summarize-chunks      Summarize chunks first
  --input-image <path>    Path to image for vision tasks
  --image-max-size <px>   Max image dimension
  --image-quality <0-100> JPEG quality
  --use-sessions          Persist browser sessions
  --use-proxy             Use proxy for scraping
  --proxy-file <file>     Load proxies from file
  --parallel              Enable parallel processing for multiple URLs
  --search <query>        Search previous results
  --semantic-search <query>  Semantic search in stored embeddings
  --embedding-method <method>  Embedding method (transformers|ollama|openai|auto)
  --mcp                   Connect to MCP server
  --mcp-command <cmd>     Command to start MCP server
`);
    return null;
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--humanize') opts.humanize = true;
    else if (arg === '--theme') opts.theme = args[++i] || null;
    else if (arg === '--model') opts.model = args[++i] || null;
    else if (arg === '--provider') opts.provider = args[++i] || null;
    else if (arg === '--retries') opts.retries = parseInt(args[++i], 10) || 3;
    else if (arg === '--scientific') opts.scientific = args[++i] || null;
    else if (arg === '--skill') opts.skill = args[++i] || null;
    else if (arg === '--input') opts.input = args[++i] || null;
    else if (arg === '--input-file') opts.inputFile = args[++i] || null;
    else if (arg === '--input-image') opts.inputImage = args[++i] || null;
    else if (arg === '--input-url') opts.inputUrl = args[++i] || null;
    else if (arg === '--list-skills') opts.listSkills = true;
    else if (arg === '--chunk-size') opts.chunkSize = parseInt(args[++i], 10) || null;
    else if (arg === '--chunk-overlap') opts.chunkOverlap = parseInt(args[++i], 10) || null;
    else if (arg === '--chunk-strategy') opts.chunkStrategy = args[++i] || 'sentences';
    else if (arg === '--summarize-chunks') opts.summarizeChunks = true;
    else if (arg === '--vision-model') opts.visionModel = args[++i] || null;
    else if (arg === '--image-max-size') opts.imageMaxSize = parseInt(args[++i], 10) || null;
    else if (arg === '--image-quality') opts.imageQuality = parseInt(args[++i], 10) || null;
    else if (arg === '--image-format') opts.imageFormat = args[++i] || null;
    else if (arg === '--use-sessions') opts.useSessions = true;
    else if (arg === '--use-proxy') opts.useProxy = true;
    else if (arg === '--proxy-file') opts.proxyFile = args[++i] || null;
    else if (arg === '--parallel') opts.parallel = true;
    else if (arg === '--search') opts.search = args[++i] || null;
    else if (arg === '--search-limit') opts.searchLimit = parseInt(args[++i], 10) || 10;
    else if (arg === '--semantic-search') opts.semanticSearch = args[++i] || null;
    else if (arg === '--embedding-method') opts.embeddingMethod = args[++i] || null;
    else if (arg === '--mcp') opts.useMcp = true;
    else if (arg === '--mcp-command') opts.mcpCommand = args[++i] || null;
    else if (arg === '--mcp-tool') opts.mcpTool = args[++i] || null;
    else if (!arg.startsWith('--')) opts.url = arg;
  }

  if (!opts.url && !opts.scientific && !opts.skill && !opts.listSkills && !opts.useMcp && !opts.search && !opts.semanticSearch) {
    console.error('❌ You must specify a task (URL, --scientific, --skill, --list-skills, --mcp, --search, or --semantic-search).');
    return null;
  }

  return opts;
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  logError(`Fatal: ${err.message}`);
  process.exit(1);
});
```

---

6. core/scraper.js

```javascript
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { sleep } = require('./utils');
const { saveSession, getSession } = require('./memory');
const { getRandomProxy, markProxyFailed } = require('./proxy');

chromium.use(StealthPlugin());

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrape(url, options = {}) {
  const retries = options.retries || 3;
  const useProxy = options.useProxy || false;
  const proxyFile = options.proxyFile || null;

  let savedCookies = [];
  if (options.useSessions) {
    const session = getSession(url);
    if (session && session.cookies) {
      const parsed = JSON.parse(session.cookies);
      const now = Date.now() / 1000;
      savedCookies = parsed.filter(c => !c.expires || c.expires > now);
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    let browser;
    let context;
    let proxy;
    try {
      browser = await chromium.launch({
        headless: options.headless !== false,
        args: []
      });

      if (useProxy) {
        proxy = getRandomProxy();
        if (!proxy && proxyFile) {
          await loadProxies(proxyFile);
          proxy = getRandomProxy();
        }
      }

      const contextOptions = {
        userAgent: USER_AGENT,
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      };

      if (proxy) {
        contextOptions.proxy = { server: proxy };
      }

      context = await browser.newContext(contextOptions);

      if (savedCookies.length > 0) {
        await context.addCookies(savedCookies);
      }

      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(1000);

      const data = await page.evaluate(() => ({
        title: document.title,
        paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText.trim()).filter(t => t.length > 0),
        links: Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText.trim(), href: a.href }))
      }));

      if (options.useSessions) {
        const cookies = await context.cookies();
        saveSession(url, cookies);
      }

      await browser.close();
      if (proxy) markProxyFailed(proxy); // reset failure
      return data;
    } catch (error) {
      if (browser) await browser.close();
      if (context && proxy) markProxyFailed(proxy);
      if (attempt === retries) throw error;
      console.warn(`⚠️ Scrape attempt ${attempt} failed: ${error.message}. Retrying...`);
      await sleep(3000 * attempt);
    }
  }
}

module.exports = { scrape };
```

---

7. core/skills.js

```javascript
const fs = require('fs').promises;
const path = require('path');
const { callAI } = require('./ai');
const { preprocessImage, smartSplit } = require('./utils');
const pLimit = require('p-limit');

let skillsRegistry = {};

async function loadSkills() {
  const skillsDir = path.join(__dirname, '..', 'skills');
  try {
    const folders = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const skillName = folder.name;
        const skillPath = path.join(skillsDir, skillName);
        try {
          const instructions = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
          const refsDir = path.join(skillPath, 'references');
          const references = {};
          try {
            const refFiles = await fs.readdir(refsDir);
            for (const refFile of refFiles) {
              references[refFile] = await fs.readFile(path.join(refsDir, refFile), 'utf-8');
            }
          } catch {}
          skillsRegistry[skillName] = { instructions, references };
        } catch (e) {
          console.warn(`Failed to load skill ${skillName}: ${e.message}`);
        }
      }
    }
    console.log(`🧠 Loaded ${Object.keys(skillsRegistry).length} skills`);
  } catch {
    console.warn('No skills directory found');
  }
}

async function runSkill(skillName, inputText, options = {}) {
  if (Object.keys(skillsRegistry).length === 0) await loadSkills();
  const skill = skillsRegistry[skillName];
  if (!skill) throw new Error(`Skill "${skillName}" not found`);

  const refsText = Object.entries(skill.references)
    .map(([file, content]) => `### ${file}\n${content}`)
    .join('\n\n');

  const baseSystemPrompt = `You are an expert in executing the skill "${skillName}". Follow these instructions strictly:\n${skill.instructions}\n\n${refsText ? 'Additional references:\n' + refsText : ''}`;

  let imageBase64 = null;
  if (options.inputImage) {
    console.log(`Processing image: ${options.inputImage}`);
    imageBase64 = await preprocessImage(options.inputImage, options);
    if (!imageBase64) {
      console.warn('Could not process image, continuing without it.');
    }
  }

  if ((!inputText || inputText.trim().length === 0) && !imageBase64) {
    throw new Error('No input provided for skill. Provide text or an image.');
  }

  const chunkSize = options.chunkSize || 4000;
  const overlap = options.chunkOverlap || 200;
  const chunkStrategy = options.chunkStrategy || 'sentences';
  const summarizeChunks = options.summarizeChunks || false;
  const maxSummaryChunks = options.maxSummaryChunks || 5;
  const maxParallelAiCalls = options.maxParallelAiCalls || 3;

  let finalResult = '';

  if (inputText.length > chunkSize) {
    console.log(`Long input (${inputText.length} chars). Splitting with strategy '${chunkStrategy}'...`);
    const chunks = smartSplit(inputText, chunkStrategy, chunkSize, overlap);
    console.log(`Created ${chunks.length} chunks.`);

    if (summarizeChunks) {
      console.log('Summarizing chunks first...');
      const summaries = new Array(chunks.length);
      const limit = pLimit(maxParallelAiCalls);
      const batchSize = maxParallelAiCalls;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const promises = batch.map((chunk, batchIndex) => {
          const actualIndex = i + batchIndex;
          return limit(async () => {
            console.log(`Summarizing chunk ${actualIndex + 1}/${chunks.length}`);
            const summaryPrompt = `${baseSystemPrompt}\n\nSummarize the following text preserving key points:\n\n${chunk}`;
            return await callAI(
              'You are a precise summarization assistant.',
              summaryPrompt,
              { ...options, temperature: 0.3, maxTokens: 1000 }
            );
          });
        });
        const batchResults = await Promise.all(promises);
        batchResults.forEach((res, idx) => { summaries[i + idx] = res; });
      }

      let combinedSummaries = summaries;
      if (summaries.length > maxSummaryChunks) {
        const summaryGroupSize = Math.ceil(summaries.length / maxSummaryChunks);
        const groupedSummaries = [];
        for (let i = 0; i < summaries.length; i += summaryGroupSize) {
          const group = summaries.slice(i, i + summaryGroupSize).join('\n\n');
          groupedSummaries.push(await callAI(
            'Summarize the following combined summaries into a single concise summary.',
            group,
            { ...options, temperature: 0.3, maxTokens: 1000 }
          ));
        }
        combinedSummaries = groupedSummaries;
      }
      finalResult = await callAI(
        baseSystemPrompt,
        `Full text (via summaries):\n${combinedSummaries.join('\n\n')}\n\nPerform the required task on the entire content.`,
        { ...options, imageBase64 }
      );
    } else {
      const results = new Array(chunks.length);
      const limit = pLimit(maxParallelAiCalls);
      const batchSize = maxParallelAiCalls;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const promises = batch.map((chunk, batchIndex) => {
          const actualIndex = i + batchIndex;
          return limit(async () => {
            console.log(`Processing chunk ${actualIndex + 1}/${chunks.length}...`);
            const userPrompt = `Text to process (part ${actualIndex + 1}):\n\n${chunk}`;
            return await callAI(baseSystemPrompt, userPrompt, { ...options, imageBase64 });
          });
        });
        const batchResults = await Promise.all(promises);
        batchResults.forEach((res, idx) => { results[i + idx] = res; });
      }
      finalResult = results.join('\n\n---\n\n');
    }
  } else {
    const userPrompt = inputText.trim() ? `Input:\n${inputText}` : 'Analyze the attached image.';
    finalResult = await callAI(baseSystemPrompt, userPrompt, { ...options, imageBase64 });
  }

  return finalResult;
}

function listSkills() {
  return Object.keys(skillsRegistry);
}

module.exports = { loadSkills, runSkill, listSkills };
```

---

8. core/memory.js

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;

let db = null;

function initDatabase(dbPath = './data/agent.db') {
  const dir = path.dirname(dbPath);
  fs.mkdir(dir, { recursive: true }).catch(() => {});
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      input TEXT,
      output TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      cookies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS memory (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_results_type ON results(type);
    CREATE INDEX IF NOT EXISTS idx_results_created ON results(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_url ON sessions(url);

    -- FTS5 للبحث النصي
    CREATE VIRTUAL TABLE IF NOT EXISTS results_fts USING fts5(
      input,
      output,
      content='results',
      content_rowid='id'
    );
    CREATE TRIGGER IF NOT EXISTS results_ai AFTER INSERT ON results BEGIN
      INSERT INTO results_fts(rowid, input, output) VALUES (new.id, new.input, new.output);
    END;
    CREATE TRIGGER IF NOT EXISTS results_ad AFTER DELETE ON results BEGIN
      INSERT INTO results_fts(results_fts, rowid, input, output) VALUES('delete', old.id, old.input, old.output);
    END;
    CREATE TRIGGER IF NOT EXISTS results_au AFTER UPDATE ON results BEGIN
      INSERT INTO results_fts(results_fts, rowid, input, output) VALUES('delete', old.id, old.input, old.output);
      INSERT INTO results_fts(rowid, input, output) VALUES (new.id, new.input, new.output);
    END;
  `);
  return db;
}

function saveResult(type, input, output) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('INSERT INTO results (type, input, output) VALUES (?, ?, ?)');
  stmt.run(type, input, output);
}

function getResults(limit = 10, offset = 0) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM results ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);
}

function searchResults(query, limit = 5, offset = 0) {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare(`
      SELECT r.*, bm25(results_fts) as score
      FROM results_fts
      JOIN results r ON r.id = results_fts.rowid
      WHERE results_fts MATCH ?
      ORDER BY score
      LIMIT ? OFFSET ?
    `);
    const ftsQuery = query.split(/\s+/).map(w => w + '*').join(' ');
    return stmt.all(ftsQuery, limit, offset);
  } catch {
    const stmt = db.prepare(`
      SELECT * FROM results 
      WHERE input LIKE ? OR output LIKE ?
      ORDER BY id DESC LIMIT ? OFFSET ?
    `);
    return stmt.all(`%${query}%`, `%${query}%`, limit, offset);
  }
}

function saveSession(url, cookies) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('INSERT INTO sessions (url, cookies) VALUES (?, ?)');
  stmt.run(url, JSON.stringify(cookies));
}

function getSession(url) {
  if (!db) throw new Error('Database not initialized');
  return db.prepare('SELECT * FROM sessions WHERE url = ? ORDER BY id DESC LIMIT 1').get(url);
}

function setMemory(key, value) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(`
    INSERT INTO memory (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
}

function getMemory(key) {
  if (!db) throw new Error('Database not initialized');
  const row = db.prepare('SELECT value FROM memory WHERE key = ?').get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

function cleanupOldResults(days = 30) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('DELETE FROM results WHERE created_at < datetime("now", ?)');
  const info = stmt.run(`-${days} days`);
  return info.changes;
}

function getDatabase() {
  return db;
}

module.exports = {
  initDatabase,
  saveResult,
  getResults,
  searchResults,
  saveSession,
  getSession,
  setMemory,
  getMemory,
  cleanupOldResults,
  getDatabase
};
```

---

9. core/ai.js

```javascript
const { logError } = require('./utils');
const { saveResult } = require('./memory');

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = 'llama3';
const DEFAULT_VISION_MODEL = 'llava';
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;

let openaiClient = null;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    const { OpenAI } = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function isOllamaAvailable() {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

function createTimeoutController() {
  return new AbortController();
}

async function callAI(systemPrompt, userPrompt, options = {}) {
  const provider = options.provider || 'auto';
  const model = options.model || DEFAULT_MODEL;
  const visionModel = options.visionModel || DEFAULT_VISION_MODEL;
  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 2000;
  const imageBase64 = options.imageBase64 || null;

  const openaiAvailable = provider === 'openai' && process.env.OPENAI_API_KEY;
  const ollamaAvailable = (provider === 'ollama' || provider === 'auto') && await isOllamaAvailable();
  if (!openaiAvailable && !ollamaAvailable) {
    throw new Error('No AI provider available. Please set OPENAI_API_KEY or start Ollama.');
  }

  const attempt = async (remaining) => {
    const controller = createTimeoutController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      if (provider === 'openai' && process.env.OPENAI_API_KEY) {
        const openai = getOpenAI();
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ];
        if (imageBase64) {
          messages[1].content = [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ];
          const response = await openai.chat.completions.create({
            model: visionModel,
            messages,
            temperature,
            max_tokens: maxTokens
          }, { signal: controller.signal });
          clearTimeout(timeoutId);
          return response.choices[0].message.content.trim();
        } else {
          const response = await openai.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens
          }, { signal: controller.signal });
          clearTimeout(timeoutId);
          return response.choices[0].message.content.trim();
        }
      } else if (provider === 'ollama' || (provider === 'auto' && ollamaAvailable)) {
        const payload = {
          model: imageBase64 ? visionModel : model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false
        };
        if (imageBase64) payload.images = [imageBase64];
        const res = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`Ollama API returned ${res.status}`);
        const data = await res.json();
        clearTimeout(timeoutId);
        return data.response.trim();
      } else {
        throw new Error('Selected provider is not available');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      try {
        saveResult('ai-attempt-error', systemPrompt, `${error.name}: ${error.message}`);
      } catch {}
      if (remaining > 0) {
        console.warn(`⚠️ Attempt failed (${MAX_RETRIES - remaining + 1}/${MAX_RETRIES}). Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
        return attempt(remaining - 1);
      }
      try {
        saveResult('ai-final-error', systemPrompt, error.message);
      } catch {}
      throw error;
    }
  };

  try {
    return await attempt(MAX_RETRIES);
  } catch (error) {
    logError(`AI call failed: ${error.message}`);
    throw error;
  }
}

module.exports = { callAI, isOllamaAvailable };
```

---

10. core/proxy.js

```javascript
const fs = require('fs').promises;
const path = require('path');
const { logError } = require('./utils');

let proxyList = [];
let currentIndex = 0;
let failedProxies = new Set();

async function loadProxies(proxyFile = null) {
  if (proxyFile) {
    try {
      const content = await fs.readFile(proxyFile, 'utf-8');
      proxyList = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
      console.log(`Loaded ${proxyList.length} proxies from ${proxyFile}`);
    } catch (e) {
      console.warn(`Failed to load proxies from ${proxyFile}: ${e.message}`);
    }
  } else {
    try {
      const config = require('../config.json');
      if (config.proxyList && Array.isArray(config.proxyList)) {
        proxyList = config.proxyList;
        console.log(`Loaded ${proxyList.length} proxies from config.json`);
      }
    } catch {}
  }
}

function getNextProxy() {
  if (proxyList.length === 0) return null;
  const available = proxyList.filter(p => !failedProxies.has(p));
  const pool = available.length ? available : proxyList;
  if (pool.length === 0) return null;
  const proxy = pool[currentIndex % pool.length];
  currentIndex++;
  return proxy;
}

function markProxyFailed(proxy) {
  failedProxies.add(proxy);
  if (failedProxies.size >= proxyList.length) {
    failedProxies.clear();
  }
}

function getRandomProxy() {
  if (proxyList.length === 0) return null;
  const pool = proxyList.filter(p => !failedProxies.has(p));
  return (pool.length ? pool : proxyList)[Math.floor(Math.random() * (pool.length ? pool.length : proxyList.length))];
}

function getProxyCount() {
  return proxyList.length;
}

module.exports = { loadProxies, getNextProxy, getRandomProxy, getProxyCount, markProxyFailed };
```

---

11. core/utils.js

```javascript
const fs = require('fs').promises;
const path = require('path');

function logError(message) {
  return fs.appendFile(
    path.join(__dirname, '..', 'error.log'),
    `${new Date().toISOString()} - ${message}\n`
  ).catch(() => {});
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {}
}

async function preprocessImage(imagePath, options = {}) {
  const maxSize = options.imageMaxSize || 1024;
  const quality = options.imageQuality || 80;
  const format = options.imageFormat || 'jpeg';

  try {
    const imageBuffer = await fs.readFile(imagePath);
    let sharp;
    try {
      sharp = require('sharp');
    } catch {
      sharp = null;
    }

    if (sharp) {
      let pipeline = sharp(imageBuffer);
      const metadata = await pipeline.metadata();
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (Math.max(width, height) > maxSize) {
        pipeline = pipeline.resize({
          width: maxSize,
          height: maxSize,
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      switch (format.toLowerCase()) {
        case 'png':
          pipeline = pipeline.png({ quality });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'jpeg':
        case 'jpg':
        default:
          pipeline = pipeline.jpeg({ quality });
          break;
      }

      const processed = await pipeline.toBuffer();
      return processed.toString('base64');
    } else {
      return imageBuffer.toString('base64');
    }
  } catch (error) {
    console.warn(`Warning: failed to preprocess image ${imagePath}: ${error.message}`);
    const rawBuffer = await fs.readFile(imagePath).catch(() => null);
    return rawBuffer ? rawBuffer.toString('base64') : null;
  }
}

function splitBySentences(text, chunkSize, overlap) {
  const sentenceEnders = /(?<=[.!?؟])\s+/g;
  const sentences = text.split(sentenceEnders).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      let start = 0;
      while (start < sentence.length) {
        const end = Math.min(start + chunkSize, sentence.length);
        chunks.push(sentence.slice(start, end));
        start = end - overlap;
      }
      continue;
    }

    if ((currentChunk + ' ' + sentence).trim().length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + sentence;
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

function splitByParagraphs(text, chunkSize, overlap) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      const subChunks = splitBySentences(para, chunkSize, overlap);
      chunks.push(...subChunks);
      continue;
    }

    if ((currentChunk + '\n\n' + para).trim().length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + para;
      } else {
        currentChunk = para;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

function smartSplit(text, strategy = 'sentences', chunkSize = 4000, overlap = 200) {
  if (text.length <= chunkSize) return [text];

  switch (strategy) {
    case 'paragraphs':
      return splitByParagraphs(text, chunkSize, overlap);
    case 'sentences':
      return splitBySentences(text, chunkSize, overlap);
    case 'chars':
    default:
      const chunks = [];
      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start = end - overlap;
      }
      return chunks;
  }
}

module.exports = {
  logError,
  sleep,
  ensureDir,
  preprocessImage,
  smartSplit
};
```

---

12. core/scheduler.js

```javascript
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { scrape } = require('./scraper');
const { runSkill } = require('./skills');
const { humanizeText } = require('./humanizer');
const { saveResult, cleanupOldResults } = require('./memory');
const { logError } = require('./utils');

async function loadSchedule() {
  const schedulePath = path.join(__dirname, '..', 'schedule.json');
  try {
    const content = await fs.readFile(schedulePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    const defaultSchedule = [];
    await fs.writeFile(schedulePath, JSON.stringify(defaultSchedule, null, 2));
    return defaultSchedule;
  }
}

async function notifyWebhook(task, status, error = null) {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, status, error, timestamp: new Date().toISOString() })
    });
  } catch (e) {
    console.warn('Webhook notification failed:', e.message);
  }
}

async function executeTask(task) {
  console.log(`Executing scheduled task: ${task.type || 'unknown'}`);
  try {
    if (task.type === 'skill' || task.type === 'seo-audit') {
      const data = await scrape(task.url, { useSessions: true });
      const result = await runSkill(task.skill || 'seo-audit', data.paragraphs.join('\n'), task);
      saveResult('scheduled-skill', task.url, result);
      await notifyWebhook(task, 'success');
      console.log('Scheduled skill completed');
    } else if (task.type === 'scrape-and-humanize') {
      const data = await scrape(task.url, { useSessions: true });
      if (task.humanize) {
        if (data.title) data.title = await humanizeText(data.title, task);
        if (data.paragraphs) data.paragraphs = await Promise.all(data.paragraphs.map(p => humanizeText(p, task)));
      }
      saveResult('scheduled-scrape', task.url, JSON.stringify(data));
      await notifyWebhook(task, 'success');
      console.log('Scheduled scrape completed');
    }
  } catch (error) {
    logError(`Scheduled task failed: ${error.message}`);
    await notifyWebhook(task, 'error', error.message);
    console.error('Scheduled task failed:', error.message);
  }
}

function startScheduler() {
  // تنظيف دوري للنتائج القديمة
  setInterval(() => {
    const config = require('../config.json');
    const removed = cleanupOldResults(config.dataRetentionDays || 30);
    if (removed > 0) console.log(`🗑️ Cleaned up ${removed} old results`);
  }, 24 * 60 * 60 * 1000);

  loadSchedule().then(tasks => {
    if (tasks.length === 0) {
      console.log('No scheduled tasks found. A default schedule.json has been created. Add tasks to it.');
      return;
    }
    tasks.forEach(task => {
      if (cron.validate(task.cron)) {
        cron.schedule(task.cron, () => executeTask(task));
        console.log(`Scheduled "${task.type}" with cron "${task.cron}"`);
      } else {
        console.warn(`Invalid cron expression: ${task.cron}`);
      }
    });
    console.log(`Scheduler started with ${tasks.length} task(s)`);
  });
}

module.exports = { startScheduler, loadSchedule };
```

---

13. core/scientific.js

```javascript
const fs = require('fs').promises;
const path = require('path');
const { callAI } = require('./ai');

let scientificMethodology = {};

async function loadScientificMethodology() {
  const methodologyDir = path.join(__dirname, '..', 'scientific-methodology');
  try {
    const files = await fs.readdir(methodologyDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const key = file.replace('.md', '');
        const content = await fs.readFile(path.join(methodologyDir, file), 'utf-8');
        scientificMethodology[key] = content;
      }
    }
    console.log(`Loaded ${Object.keys(scientificMethodology).length} scientific methodology references`);
  } catch {
    console.warn('No scientific-methodology directory found');
  }
}

async function applyScientificMethodology(topic, options = {}) {
  if (Object.keys(scientificMethodology).length === 0) {
    await loadScientificMethodology();
  }

  if (Object.keys(scientificMethodology).length === 0) {
    throw new Error('No scientific methodology references available');
  }

  const methodologyText = Object.entries(scientificMethodology)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, content]) => `### ${key}\n${content}`)
    .join('\n\n');

  const systemPrompt = `You are a specialized researcher in selecting high-impact scientific problems.
Apply the following methodology precisely to the given topic, covering all nine stages in order.
Methodology:
${methodologyText}

Provide the final output in a structured format with subheadings for each stage.`;

  const userPrompt = `Scientific topic to analyze:\n${topic}`;

  try {
    const result = await callAI(systemPrompt, userPrompt, {
      ...options,
      temperature: 0.5,
      maxTokens: 4000
    });
    return result;
  } catch (error) {
    console.error('Failed to apply scientific methodology:', error.message);
    return null;
  }
}

module.exports = {
  loadScientificMethodology,
  applyScientificMethodology
};
```

---

14. core/humanizer.js

```javascript
const fs = require('fs').promises;
const path = require('path');
const { callAI } = require('./ai');

let themes = {};
let copyFrameworks = [];
let naturalTransitions = [];
let skillInstructions = '';

async function loadThemes() {
  const themesDir = path.join(__dirname, '..', 'themes');
  try {
    const files = await fs.readdir(themesDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const themeName = file.replace('.md', '');
        const content = await fs.readFile(path.join(themesDir, file), 'utf-8');
        themes[themeName] = content;
      }
    }
    console.log(`Loaded ${Object.keys(themes).length} themes`);
  } catch {
    console.warn('No themes directory found');
  }
}

async function loadReferences() {
  const refDir = path.join(__dirname, '..', 'references');
  try {
    const frameworksContent = await fs.readFile(path.join(refDir, 'copy-frameworks.md'), 'utf-8');
    copyFrameworks = frameworksContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[-*]\s+/.test(line))
      .map(line => line.replace(/^[-*]\s+/, '').trim());
  } catch {}

  try {
    const transitionsContent = await fs.readFile(path.join(refDir, 'natural-transitions.md'), 'utf-8');
    naturalTransitions = transitionsContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^[-*]\s+/.test(line))
      .map(line => line.replace(/^[-*]\s+/, '').trim());
  } catch {}
}

async function loadSkillInstructions() {
  try {
    skillInstructions = await fs.readFile(path.join(__dirname, '..', 'SKILL.md'), 'utf-8');
  } catch {
    skillInstructions = 'Rewrite the text in a very natural human style, preserving meaning and avoiding robotic phrasing.';
  }
}

async function initHumanizer() {
  await loadThemes();
  await loadReferences();
  await loadSkillInstructions();
}

function localHumanize(text) {
  let result = text.replace(/\s+/g, ' ').trim();

  if (copyFrameworks.length > 0) {
    const framework = copyFrameworks[Math.floor(Math.random() * copyFrameworks.length)];
    result = `${framework} ${result}`;
  }

  if (naturalTransitions.length > 0) {
    const transition = naturalTransitions[Math.floor(Math.random() * naturalTransitions.length)];
    result = `${transition} ${result}`;
  }

  return result;
}

async function humanizeText(text, options = {}) {
  if (!text || text.trim().length < 20) return text;

  if (Object.keys(themes).length === 0) {
    await initHumanizer();
  }

  const themeName = options.theme || null;
  const availableThemes = Object.keys(themes);
  if (!themeName || !themes[themeName]) {
    themeName = availableThemes[Math.floor(Math.random() * availableThemes.length)] || 'default';
  }
  const themeContent = themes[themeName] || 'Clear and organized writing style.';

  const systemPrompt = `You are a professional rewriter.
Follow these instructions precisely:
${skillInstructions}

Rewrite the provided text according to the theme "${themeName}" described as follows:
${themeContent}

Output only the final rewritten text, no explanations.`;

  try {
    return await callAI(systemPrompt, text, {
      ...options,
      temperature: 0.7,
      maxTokens: 1500
    });
  } catch (error) {
    console.warn('AI rewriting failed, using local fallback.');
    return localHumanize(text);
  }
}

module.exports = {
  initHumanizer,
  humanizeText,
  localHumanize,
  loadThemes,
  loadReferences,
  loadSkillInstructions
};
```

---

15. core/embedding.js

```javascript
let embedder = null;
let embeddingMethod = 'auto';

async function loadTransformersEmbedder() {
  const { pipeline } = require('@xenova/transformers');
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✅ تم تحميل نموذج transformers.js');
}

async function generateEmbeddingWithTransformers(text) {
  if (!embedder) await loadTransformersEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

async function generateEmbeddingWithOllama(text) {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  });
  if (!res.ok) throw new Error(`Ollama embeddings failed: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

async function generateEmbeddingWithOpenAI(text) {
  const { OpenAI } = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

async function isOllamaAvailable() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    return res.ok;
  } catch {
    return false;
  }
}

async function generateEmbedding(text) {
  if (embeddingMethod === 'openai' && process.env.OPENAI_API_KEY) {
    return await generateEmbeddingWithOpenAI(text);
  } else if (embeddingMethod === 'ollama' || (embeddingMethod === 'auto' && await isOllamaAvailable())) {
    return await generateEmbeddingWithOllama(text);
  } else {
    return await generateEmbeddingWithTransformers(text);
  }
}

function setEmbeddingMethod(method) {
  embeddingMethod = method;
}

module.exports = { generateEmbedding, setEmbeddingMethod };
```

---

16. core/vector.js

```javascript
const { getDatabase } = require('./memory');
const { generateEmbedding } = require('./embedding');

let useVecExtension = false;

function initVectorTable(db) {
  try {
    db.loadExtension('sqlite-vec');
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vec0(
        id INTEGER PRIMARY KEY,
        text TEXT,
        embedding FLOAT[384]
      );
    `);
    useVecExtension = true;
    console.log('✅ تم تفعيل sqlite-vec للبحث المتجهي');
  } catch (e) {
    console.warn('⚠️ sqlite-vec غير متاح، سيتم استخدام البحث الخطي');
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT,
        embedding TEXT
      );
    `);
    useVecExtension = false;
  }
}

async function insertEmbedding(text, embedding) {
  const db = getDatabase();
  const stmt = db.prepare('INSERT INTO embeddings (text, embedding) VALUES (?, ?)');
  stmt.run(text, JSON.stringify(embedding));
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] ** 2;
    magB += b[i] ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function searchSimilar(text, limit = 5) {
  const db = getDatabase();
  const queryEmbedding = await generateEmbedding(text);
  if (useVecExtension) {
    const stmt = db.prepare(`
      SELECT text, distance
      FROM embeddings
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `);
    return stmt.all(JSON.stringify(queryEmbedding), limit);
  } else {
    const rows = db.prepare('SELECT text, embedding FROM embeddings').all();
    const scored = rows.map(row => {
      const emb = JSON.parse(row.embedding);
      const score = cosineSimilarity(queryEmbedding, emb);
      return { text: row.text, distance: 1 - score, score };
    });
    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, limit);
  }
}

async function indexText(text) {
  const embedding = await generateEmbedding(text);
  await insertEmbedding(text, embedding);
}

module.exports = { initVectorTable, insertEmbedding, searchSimilar, indexText };
```

---

17. core/mcp-client.js

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

let client = null;

async function connectMCP(command = 'cargo', args = ['run', '--', '--mcp']) {
  const transport = new StdioClientTransport({
    command,
    args,
  });

  client = new Client({
    name: 'intelligent-agent-mcp',
    version: '4.0.0',
  });

  await client.connect(transport);
  console.log('Connected to MCP server');
  return client;
}

async function disconnectMCP() {
  if (client) {
    await client.close();
    client = null;
    console.log('Disconnected from MCP server');
  }
}

async function listMCPTools() {
  if (!client) throw new Error('Not connected to MCP server');
  const tools = await client.listTools();
  return tools.tools;
}

async function callMCPTool(name, args = {}) {
  if (!client) throw new Error('Not connected to MCP server');
  const result = await client.callTool({ name, arguments: args });
  return result;
}

module.exports = {
  connectMCP,
  disconnectMCP,
  listMCPTools,
  callMCPTool
};
```

---

18. api/server.js

```javascript
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const { scrape } = require('../core/scraper');
const { runSkill, listSkills, loadSkills } = require('../core/skills');
const { saveResult, getResults, searchResults, initDatabase, cleanupOldResults } = require('../core/memory');
const { loadProxies } = require('../core/proxy');
const { humanizeText } = require('../core/humanizer');
const { applyScientificMethodology } = require('../core/scientific');
const { searchSimilar } = require('../core/vector');
const config = require('../config.json');

const app = express();

app.use(helmet());
const allowedOrigins = config.allowedOrigins || ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: config.apiRateLimitWindowMs || 15 * 60 * 1000,
  max: config.apiRateLimitMax || 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

const authMiddleware = (req, res, next) => {
  const token = req.headers['x-api-key'] || req.query.apiKey;
  if (process.env.API_AUTH_TOKEN && token !== process.env.API_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

initDatabase(config.dbPath);
loadProxies(config.proxyFile || null);

setInterval(() => {
  const removed = cleanupOldResults(config.dataRetentionDays || 30);
  if (removed > 0) console.log(`🗑️ Cleaned up ${removed} old results`);
}, 24 * 60 * 60 * 1000);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.json({
    name: 'Intelligent Agent API v4.0.0',
    endpoints: [
      { method: 'GET', path: '/skills', description: 'List available skills' },
      { method: 'POST', path: '/scrape', description: 'Scrape a URL', auth: true },
      { method: 'POST', path: '/skill', description: 'Run a skill', auth: true },
      { method: 'POST', path: '/scientific', description: 'Apply scientific methodology', auth: true },
      { method: 'POST', path: '/semantic-search', description: 'Semantic search in stored embeddings', auth: true },
      { method: 'GET', path: '/results', description: 'Get recent results (paginated)' },
      { method: 'GET', path: '/search', description: 'Search results' }
    ]
  });
});

app.get('/skills', async (req, res) => {
  await loadSkills();
  res.json({ skills: listSkills() });
});

app.post('/scrape',
  authMiddleware,
  [
    body('url').isURL().withMessage('Valid URL required'),
    body('humanize').optional().isBoolean(),
    body('theme').optional().isString(),
    body('useSessions').optional().isBoolean(),
    body('useProxy').optional().isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { url, humanize, theme, useSessions, useProxy } = req.body;
      const options = {
        headless: config.headless,
        useSessions: useSessions || false,
        useProxy: useProxy || false,
        proxyFile: config.proxyFile || null
      };
      const data = await scrape(url, options);
      if (humanize) {
        if (data.title) data.title = await humanizeText(data.title, { theme });
        if (data.paragraphs) {
          data.paragraphs = await Promise.all(data.paragraphs.map(p => humanizeText(p, { theme })));
        }
      }
      saveResult('scrape', url, JSON.stringify(data));
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

app.post('/skill',
  authMiddleware,
  [
    body('skill').isString().notEmpty(),
    body('input').optional().isString(),
    body('inputUrl').optional().isURL(),
    body('inputImageBase64').optional().custom((value) => {
      try {
        Buffer.from(value, 'base64');
        return true;
      } catch { return false; }
    }).withMessage('Invalid Base64 image data'),
    body('chunkSize').optional().isInt({ min: 100 }),
    body('chunkStrategy').optional().isIn(['chars', 'sentences', 'paragraphs'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { skill, input, inputUrl, inputImageBase64, provider, model, chunkSize, chunkStrategy, summarizeChunks } = req.body;
      let inputText = input || '';
      if (inputUrl) {
        const data = await scrape(inputUrl, { headless: config.headless });
        inputText = data.paragraphs.join('\n');
      }
      let inputImagePath = null;
      if (inputImageBase64) {
        const tempFile = path.join(__dirname, '..', 'data', `temp_${uuidv4()}.png`);
        await fs.writeFile(tempFile, Buffer.from(inputImageBase64, 'base64'));
        inputImagePath = tempFile;
      }
      const result = await runSkill(skill, inputText, {
        provider, model, chunkSize, chunkStrategy, summarizeChunks,
        inputImage: inputImagePath,
        maxParallelAiCalls: config.maxParallelAiCalls || 3,
        maxSummaryChunks: config.maxSummaryChunks || 5
      });
      if (inputImagePath) {
        await fs.unlink(inputImagePath).catch(() => {});
      }
      saveResult('skill', skill, result);
      res.json({ result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

app.post('/scientific', authMiddleware, async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic required' });
    const result = await applyScientificMethodology(topic);
    saveResult('scientific', topic, result);
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/semantic-search', authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query required' });
    const results = await searchSimilar(query, 5);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/results', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const results = getResults(limit, offset);
  res.json({ results, limit, offset });
});

app.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q parameter' });
  const limit = Math.min(parseInt(req.query.limit) || 5, 50);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  res.json(searchResults(query, limit, offset));
});

app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

app.listen(config.apiPort, () => {
  console.log(`🌐 Secure API running on port ${config.apiPort}`);
});
```

---

19. public/index.html

```html
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>الوكيل الذكي - لوحة التحكم</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>🤖 الوكيل الذكي</h1>
    <p>نفذ مهام الاستخراج، إعادة الصياغة، والمهارات المتخصصة من خلال واجهة بسيطة.</p>

    <div class="tabs">
      <button class="tab active" data-tab="scrape">استخراج</button>
      <button class="tab" data-tab="skill">مهارة</button>
      <button class="tab" data-tab="scientific">منهجية علمية</button>
    </div>

    <div id="scrape" class="tab-content active">
      <input type="url" id="scrapeUrl" placeholder="https://example.com" class="full-width">
      <label><input type="checkbox" id="humanize"> إعادة صياغة بشرية</label>
      <select id="themeSelect" disabled>
        <option value="">اختر ثيم (اختياري)</option>
      </select>
      <button onclick="runScrape()">تشغيل الاستخراج</button>
    </div>

    <div id="skill" class="tab-content">
      <select id="skillSelect" class="full-width">
        <option value="">اختر مهارة...</option>
      </select>
      <textarea id="skillInput" rows="5" placeholder="أدخل النص أو اتركه فارغًا إذا كنت ستستخدم رابطًا أو صورة" class="full-width"></textarea>
      <input type="url" id="skillUrl" placeholder="أو رابط لاستخراج المحتوى منه" class="full-width">
      <input type="file" id="skillImage" accept="image/*">
      <button onclick="runSkill()">تشغيل المهارة</button>
    </div>

    <div id="scientific" class="tab-content">
      <input type="text" id="scientificTopic" placeholder="موضوع البحث العلمي" class="full-width">
      <button onclick="runScientific()">تحليل المنهجية</button>
    </div>

    <div class="results">
      <h2>النتائج</h2>
      <div id="resultBox" class="result-box"></div>
      <button id="speakBtn" onclick="speakResult()" disabled>🔊 استمع للنتيجة</button>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

---

20. public/style.css

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f0f4f8;
  color: #333;
  line-height: 1.6;
  padding: 20px;
}
.container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
h1 { text-align: center; margin-bottom: 10px; color: #2c3e50; }
p { text-align: center; margin-bottom: 20px; }
.tabs { display: flex; gap: 10px; margin-bottom: 20px; }
.tab { flex: 1; padding: 10px; border: none; background: #e2e8f0; cursor: pointer; border-radius: 5px; font-weight: bold; }
.tab.active { background: #3498db; color: white; }
.tab-content { display: none; }
.tab-content.active { display: block; }
.full-width { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 5px; }
button { padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer; }
button:hover { background: #2980b9; }
button:disabled { background: #95a5a6; cursor: not-allowed; }
.results { margin-top: 30px; }
.result-box { background: #f8f9fa; padding: 15px; border-radius: 5px; min-height: 100px; white-space: pre-wrap; }
#speakBtn { margin-top: 10px; }
```

---

21. public/app.js

```javascript
async function loadOptions() {
  try {
    const skillsRes = await fetch('/skills');
    const skillsData = await skillsRes.json();
    const skillSelect = document.getElementById('skillSelect');
    skillsData.skills.forEach(skill => {
      const option = document.createElement('option');
      option.value = skill;
      option.textContent = skill;
      skillSelect.appendChild(option);
    });
  } catch (e) {
    console.warn('تعذر تحميل المهارات:', e);
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

document.getElementById('humanize').addEventListener('change', e => {
  document.getElementById('themeSelect').disabled = !e.target.checked;
});

function displayResult(result) {
  const resultBox = document.getElementById('resultBox');
  if (typeof result === 'string') {
    resultBox.textContent = result;
  } else {
    resultBox.textContent = JSON.stringify(result, null, 2);
  }
  document.getElementById('speakBtn').disabled = false;
}

async function runScrape() {
  const url = document.getElementById('scrapeUrl').value.trim();
  if (!url) { alert('أدخل رابطًا صالحًا'); return; }
  const humanize = document.getElementById('humanize').checked;
  const theme = document.getElementById('themeSelect').value || undefined;
  try {
    const res = await fetch('/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, humanize, theme })
    });
    const data = await res.json();
    displayResult(data);
  } catch (e) {
    displayResult('خطأ: ' + e.message);
  }
}

async function runSkill() {
  const skill = document.getElementById('skillSelect').value;
  if (!skill) { alert('اختر مهارة'); return; }
  const input = document.getElementById('skillInput').value;
  const inputUrl = document.getElementById('skillUrl').value.trim();
  const imageFile = document.getElementById('skillImage').files[0];

  let body = { skill, input, inputUrl };

  if (imageFile) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      body.inputImageBase64 = base64;
      await sendSkillRequest(body);
    };
    reader.readAsDataURL(imageFile);
  } else {
    await sendSkillRequest(body);
  }
}

async function sendSkillRequest(body) {
  try {
    const res = await fetch('/skill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    displayResult(data.result || data);
  } catch (e) {
    displayResult('خطأ: ' + e.message);
  }
}

async function runScientific() {
  const topic = document.getElementById('scientificTopic').value.trim();
  if (!topic) { alert('أدخل موضوعًا'); return; }
  try {
    const res = await fetch('/scientific', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    const data = await res.json();
    displayResult(data.result || data);
  } catch (e) {
    displayResult('خطأ: ' + e.message);
  }
}

async function runSemanticSearch() {
  const query = document.getElementById('semanticQuery').value.trim();
  if (!query) { alert('أدخل استعلامًا'); return; }
  try {
    const res = await fetch('/semantic-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    displayResult(data.results || data);
  } catch (e) {
    displayResult('خطأ: ' + e.message);
  }
}

function speakResult() {
  const text = document.getElementById('resultBox').textContent;
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-SA';
  speechSynthesis.speak(utterance);
}

loadOptions();
```

---

22. skills/seo-audit/SKILL.md

```markdown
# SEO Audit Skill

You are an SEO expert. Audit the given website content and provide a detailed report including:
- Technical health checks (meta tags, headings, page speed hints)
- On-page SEO analysis (keyword usage, content quality)
- Ranking gaps and opportunities
- Actionable recommendations

Format the output in Markdown with clear sections.
```

---

23. skills/content-research-writer/SKILL.md

```markdown
# Content Research Writer Skill

You are a professional content writer and researcher. Based on the input topic or raw text, produce high-quality, well-structured content with:
- Engaging hook
- Well-researched points
- Proper citations if sources are provided
- Clear headings and subheadings
- SEO-friendly language

Write in a natural, human style.
```

---

24. themes/ocean-depths.md

```markdown
Writing style: calm, immersive, descriptive, with marine metaphors. Use deep blue imagery, flowing sentences, and a sense of mystery.
```

---

25. references/copy-frameworks.md

```markdown
- AIDA (Attention, Interest, Desire, Action)
- PAS (Problem, Agitate, Solve)
- BAB (Before, After, Bridge)
```

---

26. references/natural-transitions.md

```markdown
- Interestingly,
- It's worth noting that,
- On the other hand,
- As a result,
```

---

27. scientific-methodology/01-intuition-pumps.md (مثال)

```markdown
# 01 – Intuition Pumps

Tool to break down complex concepts and generate initial hypotheses.
```

(ملفات 02 إلى 09 بنفس النمط حسب الحاجة)

---

28. tests/run-tests.js

```javascript
const assert = require('assert');
const { smartSplit } = require('../core/utils');
const { initDatabase, saveResult, searchResults, cleanupOldResults } = require('../core/memory');
const { localHumanize } = require('../core/humanizer');

console.log('🧪 Running basic tests...\n');

// Test 1: smartSplit sentences
const text1 = 'This is a test. Another sentence here. Third one.';
const chunks1 = smartSplit(text1, 'sentences', 20, 5);
assert(chunks1.length > 0, 'smartSplit should produce chunks');
assert(chunks1[0].includes('test'), 'First chunk should contain first sentence');
console.log('✅ smartSplit sentences test passed');

// Test 2: smartSplit paragraphs
const text2 = 'Paragraph one.\n\nParagraph two here.\n\nParagraph three is longer.';
const chunks2 = smartSplit(text2, 'paragraphs', 50, 5);
assert(chunks2.length >= 1, 'smartSplit paragraphs should produce chunks');
console.log('✅ smartSplit paragraphs test passed');

// Test 3: memory functions
const db = initDatabase(':memory:');
saveResult('test', 'hello world', 'output');
const results = searchResults('hello');
assert(results.length > 0, 'searchResults should find inserted result');
console.log('✅ memory search test passed');

// Test 4: cleanupOldResults
const removed = cleanupOldResults(0);
assert(removed > 0, 'cleanupOldResults should remove old entries');
console.log('✅ cleanup test passed');

// Test 5: localHumanize
const humanized = localHumanize('This is a test.');
assert(typeof humanized === 'string', 'localHumanize should return string');
console.log('✅ localHumanize test passed');

console.log('\n🎉 All tests passed!');
```

---
