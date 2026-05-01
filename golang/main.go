package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"runtime"
	"strings"
)

func main() {
	// 获取当前 shell
	shell := getShell()

	reader := bufio.NewReader(os.Stdin)

	for {
		printPrompt()

		input, err := reader.ReadString('\n')
		if err != nil {
			fmt.Fprintf(os.Stderr, "\nError: %v\n", err)
			break
		}

		input = strings.TrimSpace(input)

		if input == "" {
			continue
		}

		if input == "exit" || input == "quit" {
			break
		}

		// 根据不同的 shell 执行命令
		executeCommand(shell, input)

		// 处理 cd 命令，手动更新工作目录
		handleChangeDir(input)
	}
}

func getShell() string {
	// Windows 优先检查 ComSpec
	if runtime.GOOS == "windows" {
		if comspec := os.Getenv("ComSpec"); comspec != "" {
			return comspec
		}
		// 检查是否有 PowerShell
		if _, err := exec.LookPath("powershell.exe"); err == nil {
			return "powershell.exe"
		}
		return "cmd.exe"
	}

	// Unix/Linux/macOS
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	return "/bin/sh"
}

func executeCommand(shell string, command string) {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		if strings.Contains(strings.ToLower(shell), "powershell") {
			cmd = exec.Command(shell, "-Command", command)
		} else {
			// cmd.exe
			cmd = exec.Command(shell, "/C", command)
		}
	} else {
		// Unix shells (bash, zsh, sh, etc.)
		cmd = exec.Command(shell, "-c", command)
	}

	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	cmd.Run()
}

func handleChangeDir(input string) {
	parts := strings.Fields(input)
	if len(parts) == 0 {
		return
	}

	// 检查是否是 cd 命令
	if parts[0] == "cd" || (runtime.GOOS == "windows" && strings.ToLower(parts[0]) == "chdir") {
		var targetDir string
		if len(parts) == 1 {
			// cd 无参数，切换到用户主目录
			homeDir, err := os.UserHomeDir()
			if err == nil {
				targetDir = homeDir
			} else {
				return
			}
		} else {
			targetDir = parts[1]
		}

		os.Chdir(targetDir)
	}
}

func printPrompt() {
	dir, err := os.Getwd()
	if err != nil {
		dir = "unknown"
	}

	currentUser, err := user.Current()
	username := "unknown"
	if err == nil {
		username = currentUser.Username
		// Windows 用户名可能包含域名，取最后一部分
		if runtime.GOOS == "windows" {
			parts := strings.Split(username, "\\")
			username = parts[len(parts)-1]
		}
	}

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	fmt.Printf("[AI SHELL] %s@%s:%s$ ", username, hostname, dir)
}
