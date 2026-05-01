#!/usr/bin/env python3
"""
AIShell - 最简化版本，确保持续交互
"""

import os
import sys
import platform
from pathlib import Path

class AIShell:
    def __init__(self):
        self.current_shell = self._detect_shell()
        self.current_dir = os.getcwd()
        
    def _detect_shell(self):
        """检测当前使用的 shell"""
        parent_shell = os.environ.get("SHELL", "")
        if parent_shell:
            return parent_shell
        
        if platform.system() == "Windows":
            return os.environ.get("COMSPEC", "cmd.exe")
        
        return "/bin/bash"
    
    def _format_path(self, path):
        """格式化路径"""
        home = str(Path.home())
        if platform.system() == "Windows":
            formatted = str(Path(path))
            if formatted.startswith(home):
                formatted = "~" + formatted[len(home):]
            return formatted
        else:
            formatted = str(Path(path))
            if formatted.startswith(home):
                formatted = "~" + formatted[len(home):]
            return formatted
    
    def _get_prompt(self):
        """生成提示符"""
        username = os.environ.get("USER", os.environ.get("USERNAME", "user"))
        hostname = platform.node().split('.')[0]
        display_dir = self._format_path(self.current_dir)
        return f"[AI SHELL] {username}@{hostname}:{display_dir}$ "
    
    def start(self):
        """启动交互式 shell"""
        print("[AI SHELL] 已启动")
        print(f"当前 shell: {self.current_shell}\n")
        
        while True:
            try:
                # 获取用户输入
                user_input = input(self._get_prompt())
                
                if user_input.strip().lower() in ['exit', 'quit']:
                    print("[AI SHELL] 再见！")
                    break
                
                if user_input.strip():
                    # 使用 os.system 执行命令，确保不会卡住
                    # 先切换目录，再执行命令
                    if platform.system() == "Windows":
                        os.system(f'cd /d "{self.current_dir}" && {user_input}')
                    else:
                        os.system(f'cd "{self.current_dir}" && {user_input}')
                
                # 更新当前目录
                self.current_dir = os.getcwd()
                
            except KeyboardInterrupt:
                print()
                continue
            except EOFError:
                break

if __name__ == "__main__":
    try:
        shell = AIShell()
        shell.start()
    except KeyboardInterrupt:
        print("\n[AI SHELL] 再见！")