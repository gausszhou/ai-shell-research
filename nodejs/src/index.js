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
    this.commandHistory = [];
    this.historyIndex = -1;
    this.currentLine = '';
    this.cursorPosition = 0;
    this.completions = [];
    this.completionIndex = 0;
    this.showingCompletions = false;
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

  // 获取命令补全列表
  async getCompletions(input) {
    const parts = input.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';
    
    // 如果是第一个词，补全命令
    if (parts.length === 1 || (parts.length === 0 && input.endsWith(' '))) {
      return await this.getCommandCompletions(lastPart);
    }
    
    // 否则补全文件路径
    return await this.getPathCompletions(lastPart);
  }

  // 获取命令补全
  async getCommandCompletions(prefix) {
    return new Promise((resolve) => {
      const child = spawn(this.currentShell, ['-c', 'compgen -c'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      let output = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', () => {
        const commands = output.split('\n')
          .filter(cmd => cmd.startsWith(prefix))
          .sort();
        resolve(commands);
      });

      child.on('error', () => {
        resolve([]);
      });
    });
  }

  // 获取路径补全
  async getPathCompletions(prefix) {
    return new Promise((resolve) => {
      // 展开路径
      let searchPath = prefix;
      let searchDir = this.currentDir;
      let searchPrefix = '';
      
      if (prefix.startsWith('~')) {
        searchPath = path.join(os.homedir(), prefix.slice(1));
        const dirPart = path.dirname(searchPath);
        const basePart = path.basename(searchPath);
        if (fs.existsSync(dirPart)) {
          searchDir = dirPart;
          searchPrefix = basePart;
        }
      } else if (prefix.startsWith('/') || (process.platform === 'win32' && prefix.match(/^[A-Z]:\\/))) {
        const dirPart = path.dirname(prefix);
        const basePart = path.basename(prefix);
        if (fs.existsSync(dirPart)) {
          searchDir = dirPart;
          searchPrefix = basePart;
        }
      } else if (prefix.includes('/')) {
        const fullPath = path.resolve(this.currentDir, prefix);
        const dirPart = path.dirname(fullPath);
        const basePart = path.basename(fullPath);
        if (fs.existsSync(dirPart)) {
          searchDir = dirPart;
          searchPrefix = basePart;
        }
      } else {
        searchPrefix = prefix;
      }

      try {
        const entries = fs.readdirSync(searchDir);
        const matches = entries
          .filter(entry => entry.startsWith(searchPrefix))
          .map(entry => {
            const fullPath = path.join(searchDir, entry);
            try {
              const stat = fs.statSync(fullPath);
              return {
                name: entry,
                isDir: stat.isDirectory(),
                fullPath: fullPath
              };
            } catch {
              return {
                name: entry,
                isDir: false,
                fullPath: fullPath
              };
            }
          });

        // 构建补全字符串
        const completions = matches.map(match => {
          let completion = match.name;
          if (match.isDir) {
            completion += '/';
          }
          return completion;
        });

        resolve(completions);
      } catch (error) {
        resolve([]);
      }
    });
  }

  // 显示补全列表
  showCompletions(completions, input) {
    if (completions.length === 0) return '';
    
    if (completions.length === 1) {
      // 只有一个补全，直接应用
      return this.applyCompletion(completions[0], input);
    }

    // 找到公共前缀
    const commonPrefix = this.findCommonPrefix(completions);
    if (commonPrefix.length > this.getLastWord(input).length) {
      // 有更长的公共前缀，先补全公共部分
      return this.applyCompletion(commonPrefix, input);
    }

    // 显示所有匹配项
    console.log('\n');
    const maxColumns = Math.floor(process.stdout.columns / 20);
    const columns = Math.min(maxColumns, completions.length);
    const rows = Math.ceil(completions.length / columns);
    
    for (let i = 0; i < rows; i++) {
      let line = '';
      for (let j = 0; j < columns; j++) {
        const index = i + j * rows;
        if (index < completions.length) {
          line += completions[index].padEnd(20);
        }
      }
      console.log(line);
    }
    
    // 重新显示提示符和当前输入
    process.stdout.write(this.getPrompt() + input);
    
    return input;
  }

  // 应用补全
  applyCompletion(completion, input) {
    const parts = input.split(/\s+/);
    const lastWord = this.getLastWord(input);
    
    if (parts.length === 1) {
      return completion;
    }
    
    parts[parts.length - 1] = completion;
    return parts.join(' ');
  }

  // 获取最后一个单词
  getLastWord(input) {
    const parts = input.split(/\s+/);
    return parts[parts.length - 1] || '';
  }

  // 找到公共前缀
  findCommonPrefix(strings) {
    if (strings.length === 0) return '';
    
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }
    return prefix;
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
    if (this.history.length > 1000) {
      this.history.shift();
    }

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
      this.rl.prompt(true);
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
    console.log('输入 "exit" 退出，按 Tab 键补全\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      terminal: true,
      completer: async (line) => {
        const completions = await this.getCompletions(line);
        return [completions, line];
      }
    });

    this.setupPromptUpdate();
    this.rl.prompt();

    // 重写 _ttyWrite 以支持 Tab 补全
    const originalTtyWrite = this.rl._ttyWrite;
    this.rl._ttyWrite = async (key, keyInfo) => {
      if (key === '\t' || keyInfo?.name === 'tab') {
        // 处理 Tab 补全
        const line = this.rl.line;
        const completions = await this.getCompletions(line);
        
        if (completions.length > 0) {
          const newLine = this.showCompletions(completions, line);
          if (newLine !== line) {
            // 清除当前行并写入新内容
            process.stdout.write('\r\x1b[K');
            process.stdout.write(this.getPrompt() + newLine);
            this.rl.line = newLine;
            this.rl.cursor = newLine.length;
          }
        }
      } else if (keyInfo?.name === 'up') {
        // 上箭头 - 历史命令
        if (this.history.length > 0) {
          if (this.historyIndex === -1) {
            this.currentLine = this.rl.line;
            this.historyIndex = this.history.length - 1;
          } else if (this.historyIndex > 0) {
            this.historyIndex--;
          }
          
          const historyCmd = this.history[this.historyIndex];
          process.stdout.write('\r\x1b[K');
          process.stdout.write(this.getPrompt() + historyCmd);
          this.rl.line = historyCmd;
          this.rl.cursor = historyCmd.length;
        }
      } else if (keyInfo?.name === 'down') {
        // 下箭头 - 历史命令
        if (this.historyIndex !== -1) {
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const historyCmd = this.history[this.historyIndex];
            process.stdout.write('\r\x1b[K');
            process.stdout.write(this.getPrompt() + historyCmd);
            this.rl.line = historyCmd;
            this.rl.cursor = historyCmd.length;
          } else {
            this.historyIndex = -1;
            process.stdout.write('\r\x1b[K');
            process.stdout.write(this.getPrompt() + this.currentLine);
            this.rl.line = this.currentLine;
            this.rl.cursor = this.currentLine.length;
          }
        }
      } else {
        // 其他按键正常处理
        originalTtyWrite.call(this.rl, key, keyInfo);
        this.historyIndex = -1;
      }
    };

    this.rl.on('line', async (line) => {
      await this.executeCommand(line);
      this.historyIndex = -1;
      this.currentLine = '';
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
      this.rl.line = '';
      this.rl.cursor = 0;
      this.rl.prompt();
    });
  }
}

// 启动 AI Shell
const aiShell = new AIShell();
aiShell.start().catch(console.error);