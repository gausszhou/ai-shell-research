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

  getPrompt() {
    const username = os.userInfo().username;
    const hostname = os.hostname().split('.')[0];
    return `[AI SHELL] ${username}@${hostname}:${this.currentDir}$ `;
  }

  executeCommand(command) {
    if (!command || command.trim() === '') {
      return Promise.resolve();
    }

    // 仅实现必要的内置命令
    if (command.trim() === 'exit' || command.trim() === 'quit') {
      console.log('再见！');
      process.exit(0);
    }

    if (command.trim() === 'clear') {
      console.clear();
      return Promise.resolve();
    }

    if (command.trim().startsWith('cd ')) {
      return this.handleCd(command);
    }

    // 根据 shell 类型选择参数
    return new Promise((resolve) => {
      let args;
      const shellLower = this.currentShell.toLowerCase();
      
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
        env: process.env
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

  handleCd(command) {
    const target = command.trim().substring(3).trim();
    let newPath;

    try {
      if (target.startsWith('~')) {
        newPath = path.join(os.homedir(), target.slice(1));
      } else if (path.isAbsolute(target)) {
        newPath = target;
      } else {
        newPath = path.resolve(this.currentDir, target);
      }

      if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        this.currentDir = newPath;
        process.chdir(newPath);
        // 更新提示符
        if (this.rl) {
          this.rl.setPrompt(this.getPrompt());
        }
      } else {
        console.error(`cd: ${target}: 没有那个文件或目录`);
      }
    } catch (error) {
      console.error(`cd: ${error.message}`);
    }
    return Promise.resolve();
  }

  start() {
    console.clear();
    console.log('[AI SHELL] 已启动');
    console.log(`当前 shell: ${this.currentShell}\n`);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      terminal: true
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      await this.executeCommand(line);
      // 命令执行后同步工作目录
      this.currentDir = process.cwd();
      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\n再见！');
      process.exit(0);
    });

    // 处理 Ctrl+C
    this.rl.on('SIGINT', () => {
      console.log('\n输入 exit 退出');
      this.rl.prompt();
    });
  }
}

const aiShell = new AIShell();
aiShell.start()