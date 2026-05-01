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
    this.history = [];
    this.rl = null;
    this.childProcess = null;
  }

  // 检测当前使用的 Shell
  detectShell() {
    // 首先检查环境变量
    const shellFromEnv = process.env.SHELL || process.env.COMSPEC;
    if (shellFromEnv) {
      return shellFromEnv;
    }

    // Windows 检测
    if (process.platform === 'win32') {
      try {
        require('child_process').execSync('powershell.exe -Command "echo test"', { stdio: 'ignore' });
        return 'powershell.exe';
      } catch {
        return 'cmd.exe';
      }
    }

    // Unix/Linux/Mac 默认
    return '/bin/bash';
  }

  // 获取提示符
  getPrompt() {
    const hostname = os.hostname().split('.')[0];
    const username = os.userInfo().username;
    return `[AI SHELL] ${username}@${hostname}:${this.currentDir}$ `;
  }

  // 执行命令
  async executeCommand(command) {
    if (!command || command.trim() === '') {
      return;
    }

    // 处理内置命令
    if (command.trim() === 'exit' || command.trim() === 'quit') {
      console.log('再见！');
      process.exit(0);
    }

    if (command.trim() === 'clear') {
      console.clear();
      return;
    }

    if (command.trim().startsWith('cd ')) {
      await this.handleCdCommand(command);
      return;
    }

    // 添加到历史记录
    this.history.push(command);

    // 执行命令
    return new Promise((resolve) => {
      const child = spawn(this.currentShell, ['-c', command], {
        cwd: this.currentDir,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: process.env
      });

      // 处理输出
      child.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          // 静默处理非零退出码
        }
        resolve();
      });

      child.on('error', (error) => {
        console.error(`执行错误: ${error.message}`);
        resolve();
      });
    });
  }

  // 处理 cd 命令
  async handleCdCommand(command) {
    const targetDir = command.trim().substring(3).trim();
    let newPath;

    try {
      if (targetDir.startsWith('~')) {
        newPath = path.join(os.homedir(), targetDir.slice(1));
      } else if (path.isAbsolute(targetDir)) {
        newPath = targetDir;
      } else {
        newPath = path.resolve(this.currentDir, targetDir);
      }

      // 检查目录是否存在
      if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        this.currentDir = newPath;
        process.chdir(newPath);
      } else {
        console.error(`cd: ${targetDir}: 没有那个文件或目录`);
      }
    } catch (error) {
      console.error(`cd: ${error.message}`);
    }
  }

  // 更新工作目录
  updateWorkingDirectory() {
    this.currentDir = process.cwd();
    if (this.rl) {
      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
    }
  }

  // 设置提示符更新监听
  setupPromptUpdate() {
    // 监听 SIGCONT 信号（当进程恢复时）
    process.on('SIGCONT', () => {
      this.updateWorkingDirectory();
    });

    // 定期检查工作目录变化
    setInterval(() => {
      const currentDir = process.cwd();
      if (currentDir !== this.currentDir) {
        this.updateWorkingDirectory();
      }
    }, 1000);
  }

  // 启动 Shell
  async start() {
    console.clear();
    console.log('🤖 AI Shell - 智能命令行工具');
    console.log(`Shell: ${this.currentShell}`);
    console.log(`工作目录: ${this.currentDir}`);
    console.log('输入 "exit" 退出，输入 "help" 查看帮助\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      terminal: true
    });

    this.setupPromptUpdate();
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      await this.executeCommand(line);
      this.updateWorkingDirectory();
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n再见！');
      process.exit(0);
    });

    // 处理 Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log('\n使用 "exit" 退出');
      this.rl.prompt();
    });
  }
}

// 启动 AI Shell
const aiShell = new AIShell();
aiShell.start().catch(console.error);