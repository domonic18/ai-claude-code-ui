// Jenkins CI Pipeline - Docker 构建环境
//
// 触发方式：GitHub webhook（push 到 develop 分支自动触发）
//
// 构建环境：Docker 镜像 node:20-bookworm（Debian，内置 gcc/make/python3，支持原生模块编译）
// 前置条件：
//   1. Jenkins 服务器已安装 Docker
//   2. Jenkins 插件：Pipeline、Git、GitHub plugin、Docker Pipeline
//   3. GitHub 仓库已配置 webhook（地址在 Jenkins 系统配置中管理）
//
// Jenkins Job SCM 配置：
//   - Repository URL: git@github.com:domonic18/ai-claude-code-ui.git
//   - Credentials: Git SSH 私钥
//   - Branch: */develop

pipeline {
    // 使用 Docker 镜像构建，Node.js 版本由镜像控制（与 .nvmrc 保持一致）
    agent {
        docker {
            image 'node:20-bookworm'
        }
    }

    // GitHub webhook 推送触发（仅 develop 分支的 push 事件）
    // webhook 地址在 Jenkins 系统配置中管理
    triggers {
        githubPush()
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    stages {
        // ==================== 拉取代码 ====================
        stage('Checkout') {
            steps {
                // 使用 Jenkins Job SCM 配置自动拉取（仓库地址、凭据、分支已在 Job 配置中定义）
                checkout scm
                sh 'git log --oneline -5'
            }
        }

        // ==================== CI: 构建前端 ====================
        stage('CI: Build') {
            steps {
                echo '--- CI: 安装依赖 & 构建前端 ---'
                sh 'npm ci'
                sh 'npm run build'
            }
            post {
                failure {
                    echo '前端构建失败，请检查代码'
                }
            }
        }

        // ==================== CI: 测试 ====================
        stage('CI: Test') {
            steps {
                echo '--- CI: 运行测试（单元测试 + 服务测试 + 前端测试，跳过 Docker 依赖的集成测试） ---'
                sh 'npm run test:ci'
            }
            post {
                failure {
                    echo '测试失败，请检查日志'
                }
            }
        }
    }

    post {
        success {
            echo 'CI 流水线通过'
            cleanWs()
        }
        failure {
            echo 'CI 流水线失败，请检查日志'
            echo '工作空间已保留，可用于排查问题'
        }
    }
}
