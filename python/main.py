#!/usr/bin/env python3
"""
AIShell - 在用户和命令解释器之间建立桥梁
使用 os.system 确保持续交互
"""

import os
import sys
import platform
import signal
import re
from pathlib import Path

class AIShell:
    def __init__(self):
        self.current_shell = self._detect_shell()
        self.current_dir = os.getcwd()
        self.is_git_bash = self._check_is_git_bash()
        
    def _detect_shell(self):
        """检测当前使用的 shell"""
        shell = os.environ.get("SHELL", os.environ.get("COMSPEC"))
        if shell:
            return shell
        
        if platform.system() == 'Windows':
            return 'cmd.exe'
        return '/bin/bash'
    
    def _check_is_git_bash(self):
        """检测是否为 Git Bash"""
        return (
            platform.system() == 'Windows' and
            'bash' in self.current_shell.lower() and
            'git' in self.current_shell.lower()
        )
    
    def convert_path(self, input_path, to_unix=True):
        """路径转换（双向）"""
        if not self.is_git_bash:
            return input_path
        
        if to_unix:
            # Windows -> Unix: D:\Code -> /d/Code
            unix_path = input_path.replace('\\', '/')
            match = re.match(r'^([A-Za-z]):/(.*)$', unix_path)
            if match:
                return f"/{match[1].lower()}/{match[2]}"
            return unix_path
        else:
            # Unix -> Windows: /d/Code -> D:\Code
            match = re.match(r'^/([a-z])/(.*)$', input_path, re.IGNORECASE)
            if match:
                return f"{match[1].upper()}:\\{match[2].replace('/', '\\')}"
            return input_path
    
    def format_path_for_display(self, file_path):
        """格式化路径用于显示（支持 ~ 缩写）"""
        if self.is_git_bash:
            display_path = self.convert_path(file_path, True)
            home_dir = self.convert_path(str(Path.home()), True)
        else:
            display_path = file_path
            home_dir = str(Path.home())
        
        if display_path.startswith(home_dir):
            display_path = '~' + display_path[len(home_dir):]
        
        return display_path
    
    def get_prompt(self):
        """生成自定义提示符"""
        username = os.environ.get("USER", os.environ.get("USERNAME", "user"))
        hostname = platform.node().split('.')[0]
        display_dir = self.format_path_for_display(self.current_dir)
        return f"[AI SHELL] {username}@{hostname}:{display_dir}$ "
    
    def run_command(self, command):
        """执行命令 - 使用 os.system 保证持续交互"""
        if platform.system() == 'Windows':
            # Windows: 先切换目录再执行命令
            os.system(f'cd /d "{self.current_dir}" && {command}')
        else:
            # Unix/Linux: 先切换目录再执行命令
            os.system(f'cd "{self.current_dir}" && {command}')
    
    def start(self):
        """启动交互式 shell"""
        print('[AI SHELL] 已启动')
        print(f'当前 shell: {self.current_shell}')
        print("输入 'exit' 或按 Ctrl+C 退出\n")
        
        # 设置信号处理
        def signal_handler(sig, frame):
            print()
            print('再见！')
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        
        # 主交互循环
        while True:
            try:
                # 获取用户输入
                user_input = input(self.get_prompt())
                
                # 处理退出命令
                if user_input.strip().lower() in ['exit', 'quit']:
                    print('再见！')
                    break
                
                # 清屏命令
                if user_input.strip().lower() == 'clear':
                    os.system('cls' if platform.system() == 'Windows' else 'clear')
                    continue
                
                # 执行命令
                if user_input.strip():
                    self.run_command(user_input)
                
                # 同步当前目录
                self.current_dir = os.getcwd()
                
            except EOFError:
                print('再见！')
                break
            except KeyboardInterrupt:
                continue
            except Exception as e:
                print(f"错误: {e}", file=sys.stderr)
                self.current_dir = os.getcwd()

def main():
    try:
        shell = AIShell()
        shell.start()
    except KeyboardInterrupt:
        print("\n再见！")

if __name__ == "__main__":
    main()