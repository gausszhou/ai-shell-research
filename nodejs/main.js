#!/usr/bin/env node

const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

class AIShell {
  constructor() {
    this.currentShell = this.detectShell();
    this.currentDir = process.cwd();
    this.rl = null;
    this.isGitBash = this.checkIsGitBash();
  }

  detectShell() {
    const shell = process.env.SHELL || process.env.COMSPEC;
    if (shell) return shell;

    if (process.platform === 'win32') {
      try {
        require('child_process').execSync('powershell.exe -Command "exit"', { stdio: 'ignore' });
        return 'powershell.exe';
      } catch {
        return 'cmd.exe';
      }
    }
    return '/bin/bash';
  }

  checkIsGitBash() {
    return (
      process.platform === 'win32' &&
      this.currentShell.toLowerCase().includes('bash') &&
      this.currentShell.toLowerCase().includes('git')
    );
  }

  // 路径转换（双向）
  convertPath(inputPath, toUnix = true) {
    if (!this.isGitBash) return inputPath;

    if (toUnix) {
      // Windows -> Unix: D:\Code -> /d/Code
      let unixPath = inputPath.replace(/\\/g, '/');
      const match = unixPath.match(/^([A-Za-z]):\/(.*)$/);
      return match ? `/${match[1].toLowerCase()}/${match[2]}` : unixPath;
    } else {
      // Unix -> Windows: /d/Code -> D:\Code
      const match = inputPath.match(/^\/([a-z])\/(.*)$/i);
      return match ? `${match[1].toUpperCase()}:\\${match[2].replace(/\//g, '\\')}` : inputPath;
    }
  }

  // 格式化路径用于显示（支持 ~ 缩写）
  formatPathForDisplay(filePath) {
    let displayPath = this.isGitBash ? this.convertPath(filePath, true) : filePath;
    const homeDir = this.isGitBash ? this.convertPath(os.homedir(), true) : os.homedir();

    if (displayPath.startsWith(homeDir)) {
      displayPath = '~' + displayPath.slice(homeDir.length);
    }

    return displayPath;
  }

  getPrompt() {
    const username = os.userInfo().username;
    const hostname = os.hostname().split('.')[0];
    const displayDir = this.formatPathForDisplay(this.currentDir);
    return `[AI SHELL] ${username}@${hostname}:${displayDir}$ `;
  }

  async executeCommand(command) {
    const trimmed = command.trim();
    if (!trimmed) return;

    // 内置命令
    const builtins = {
      exit: () => this.exit(),
      quit: () => this.exit(),
      clear: () => console.clear(),
      cd: (cmd) => this.handleCd(cmd),
    };

    for (const [name, handler] of Object.entries(builtins)) {
      if (trimmed === name || trimmed.startsWith(`${name} `)) {
        await handler(trimmed);
        return;
      }
    }

    // 外部命令
    await this.runExternalCommand(trimmed);
  }

  exit() {
    process.exit(0);
  }

  handleCd(command) {
    const target = command.slice(3).trim();
    if (!target) return;

    let newPath;
    try {
      // 转换路径格式（如果是 Git Bash）
      let cdTarget = this.isGitBash ? this.convertPath(target, false) : target;

      if (cdTarget.startsWith('~')) {
        newPath = path.join(os.homedir(), cdTarget.slice(1));
      } else if (path.isAbsolute(cdTarget)) {
        newPath = cdTarget;
      } else {
        newPath = path.resolve(this.currentDir, cdTarget);
      }

      if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        this.currentDir = newPath;
        process.chdir(newPath);
        this.rl?.setPrompt(this.getPrompt());
      } else {
        console.error(`cd: ${target}: 没有那个文件或目录`);
      }
    } catch (error) {
      console.error(`cd: ${error.message}`);
    }
  }

  runExternalCommand(command) {
    return new Promise((resolve) => {
      const shellLower = this.currentShell.toLowerCase();
      let args;

      if (shellLower.includes('powershell')) {
        args = ['-Command', command];
      } else if (shellLower.includes('cmd') || this.currentShell === 'cmd.exe') {
        args = ['/c', command];
      } else {
        args = ['-c', command];
      }

      const child = spawn(this.currentShell, args, {
        cwd: this.currentDir,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: process.env,
      });

      child.stdout.on('data', (data) => process.stdout.write(data));
      child.stderr.on('data', (data) => process.stderr.write(data));
      child.on('close', () => resolve());
      child.on('error', (error) => {
        console.error(`错误: ${error.message}`);
        resolve();
      });
    });
  }

  start() {
    console.log('[AI SHELL] 已启动');
    console.log(`当前 shell: ${this.currentShell}\n`);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      terminal: true,
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      await this.executeCommand(line);
      this.currentDir = process.cwd(); // 同步工作目录
      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
    });

    this.rl.on('close', () => this.exit());
    this.rl.on('SIGINT', () => {
      this.exit();
    });
  }
}

const aiShell = new AIShell();
aiShell.start();
