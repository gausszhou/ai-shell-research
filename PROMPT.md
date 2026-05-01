使用 xxx 编程语言构建一个 cli 程序，作用是在用户和命令解释器之间建立一座桥梁，接管用户的命令输入，要求如下
1. 使用和当前相同的 shell 执行用户的命令，如果当前程序使用 bash 启动，那么也应该使用 bash 执行
2. 需要能持续性的交互
3. 使用我们自己的提示符
4. 在我们自己的提示符之前加上 [AI SHELL] 标签
5. 工作目录要显示完整路径
6. 工作目录要能同步更新展示
7. 工作目录的风格要和当前 shell 保持一致
8. 不要做任何多余的功能拓展
9. 支持 cmd powershell bash 等命令解释器
10. 支持 conhost openconsole(windows terminal) gnome terminal 等终端  