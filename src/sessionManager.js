const { spawn } = require('child_process');
const { sessionTimeoutMs } = require('./config');
const { log } = require('./logger');

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  create(threadId, alias, cwd) {
    if (this.sessions.has(threadId)) {
      return this.sessions.get(threadId);
    }

    const session = {
      sessionId: null,
      alias,
      cwd,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      timer: null,
      busy: false,
      stats: {
        totalMessages: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostUsd: 0,
        totalDurationMs: 0,
        totalTurns: 0,
      },
      queue: [],
    };

    this._startTimer(threadId, session);
    this.sessions.set(threadId, session);
    log(`[SM] Created session ${threadId} (${alias} -> ${cwd})`);
    return session;
  }

  /**
   * Send message to Claude with streaming callbacks.
   * callbacks: { onText(fullText), onToolUse(toolName, input), onResult(stats) }
   */
  async sendMessage(threadId, text, callbacks = {}) {
    const session = this.sessions.get(threadId);
    if (!session) return null;

    session.lastActivity = Date.now();
    this._startTimer(threadId, session);

    if (session.busy) {
      return new Promise((resolve, reject) => {
        session.queue.push({ text, callbacks, resolve, reject });
        log(`[SM] Queued message for ${threadId} (${session.queue.length} in queue)`);
      });
    }

    return this._processMessage(threadId, session, text, callbacks);
  }

  async _processMessage(threadId, session, text, callbacks) {
    session.busy = true;

    try {
      let lastStats = null;
      const wrappedCallbacks = {
        ...callbacks,
        onResult: (stats) => {
          lastStats = stats;
          if (callbacks.onResult) callbacks.onResult(stats);
        },
      };
      const result = await this._runClaude(session, text, wrappedCallbacks);

      if (lastStats) {
        session.stats.totalMessages++;
        session.stats.totalTokensIn += lastStats.inputTokens || 0;
        session.stats.totalTokensOut += lastStats.outputTokens || 0;
        session.stats.totalCostUsd += lastStats.costUsd || 0;
        session.stats.totalDurationMs += lastStats.durationMs || 0;
        session.stats.totalTurns += lastStats.numTurns || 0;
      }

      session.busy = false;
      this._processQueue(threadId, session);

      return result;
    } catch (err) {
      session.busy = false;
      this._processQueue(threadId, session);
      throw err;
    }
  }

  _processQueue(threadId, session) {
    if (session.queue.length === 0) return;

    const next = session.queue.shift();
    log(`[SM] Dequeuing message for ${threadId} (${session.queue.length} remaining)`);

    this._processMessage(threadId, session, next.text, next.callbacks)
      .then(next.resolve)
      .catch(next.reject);
  }

  _runClaude(session, text, callbacks) {
    return new Promise((resolve, reject) => {
      const bashCwd = session.cwd.replace(/\\/g, '/').replace(/^([A-Z]):/, (_, d) => `/${d.toLowerCase()}`);
      const parts = ['claude', '-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];

      if (session.sessionId) {
        parts.push('--resume', session.sessionId);
      }

      const cmd = `cd '${bashCwd}' && ${parts.map(p => `'${p}'`).join(' ')}`;
      log(`[SM] CMD: ${cmd}`);

      const proc = spawn('bash', ['-c', cmd], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stdin.write(text);
      proc.stdin.end();

      let stdout = '';
      let resultText = '';
      let gotResult = false;

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        const lines = stdout.split('\n');
        stdout = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            // Init - capture session ID
            if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
              session.sessionId = event.session_id;
            }

            // Assistant message - text or tool_use
            if (event.type === 'assistant' && event.message) {
              for (const block of event.message.content) {
                if (block.type === 'text') {
                  resultText = block.text;
                  if (callbacks.onText) callbacks.onText(resultText);
                }
                if (block.type === 'tool_use') {
                  if (callbacks.onToolUse) callbacks.onToolUse(block.name, block.input);
                }
              }
            }

            // Result - final stats
            if (event.type === 'result') {
              gotResult = true;
              if (event.result) resultText = event.result;

              if (callbacks.onResult) {
                callbacks.onResult({
                  durationMs: event.duration_ms,
                  costUsd: event.total_cost_usd,
                  inputTokens: event.usage?.input_tokens || 0,
                  outputTokens: event.usage?.output_tokens || 0,
                  cacheRead: event.usage?.cache_read_input_tokens || 0,
                  cacheCreation: event.usage?.cache_creation_input_tokens || 0,
                  numTurns: event.num_turns,
                });
              }
            }
          } catch {}
        }
      });

      proc.stderr.on('data', (data) => {
        const errText = data.toString().trim();
        if (errText) log(`[SM] STDERR: ${errText.slice(0, 300)}`);
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn claude: ${err.message}`));
      });

      proc.on('exit', (code) => {
        log(`[SM] Exit code=${code}, result=${resultText.length} chars`);

        if (stdout.trim()) {
          try {
            const event = JSON.parse(stdout);
            if (event.type === 'result' && event.result) {
              resultText = event.result;
            }
          } catch {}
        }

        if (resultText) {
          resolve(resultText);
        } else if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}`));
        } else {
          resolve('Claude neodpovedal.');
        }
      });
    });
  }

  kill(threadId) {
    const session = this.sessions.get(threadId);
    if (!session) return false;
    this._clearTimer(session);

    for (const queued of session.queue) {
      queued.reject(new Error('Session ukoncena'));
    }
    session.queue = [];

    this.sessions.delete(threadId);
    log(`[SM] Killed session ${threadId}`);
    return true;
  }

  has(threadId)          { return this.sessions.has(threadId); }
  get(threadId)          { return this.sessions.get(threadId); }

  getActiveSessions() {
    return Array.from(this.sessions.entries()).map(([threadId, s]) => ({
      threadId, alias: s.alias, createdAt: s.createdAt, lastActivity: s.lastActivity,
    }));
  }

  getStats(threadId) {
    const session = this.sessions.get(threadId);
    if (!session) return null;
    return {
      alias: session.alias,
      cwd: session.cwd,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      ...session.stats,
    };
  }

  killAll() {
    for (const [threadId] of this.sessions) this.kill(threadId);
  }

  _startTimer(threadId, session) {
    this._clearTimer(session);
    session.timer = setTimeout(() => {
      log(`[SM] Session timeout ${threadId}`);
      this._onTimeout?.(threadId);
      this.kill(threadId);
    }, sessionTimeoutMs);
  }

  _clearTimer(session) {
    if (session.timer) { clearTimeout(session.timer); session.timer = null; }
  }

  onTimeout(callback) { this._onTimeout = callback; }
}

module.exports = new SessionManager();
