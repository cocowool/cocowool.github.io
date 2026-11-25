---
title: 20261125-change-brew-to-macport
date: 2026-11-25 15:53:05
keywords:
category: Mac
description: 
---

在 Mac 系统中，如果你经常使用命令行，那么对 `Homebrew` 这个工具一定不陌生，一个 `brew install` 命令，从简单的开发程序环境，到复杂的大模型工具，都能帮你自动搞定。

但是 Homebrew 提供服务时，针对不同的 macOS 操作系统版本，做了一些服务级别的区别处理。我让千问大模型帮忙整理出来。很不幸，我现在用的 2020 年购入的 MBP，运行的是 macOS Monterey Version 12.2.1，已经处于 Tie 3 级别。通过 brew 命令安装软件时，不仅享受不到直接下载编译好的安装包待遇，甚至可能不保证一定能安装成功。

在这种情况下，再继续使用 Homebrew 做本机的软件包管理，变得有点痛苦。很多的时候，安装软件都需要下载源文件编译安装，不仅下载、编译速度慢，关键失败率还特别高。

## 参考资料
1. [Homebrew homepage](https://brew.sh/)