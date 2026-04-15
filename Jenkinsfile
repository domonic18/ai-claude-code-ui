// Jenkins CI Pipeline - Master/Agent 架构
//
// 架构：Jenkins Master (Linux) → macOS Agent 节点
//
// 触发方式：GitHub webhook（push 到 develop 分支自动触发）
//
// 前置条件：
//   1. macOS Agent 节点已注册到 Jenkins Master（通过 SSH）
//   2. macOS Agent 上已安装：Node.js 20、git
//   3. Jenkins 插件：Pipeline、Git、SSH Build Agents、GitHub plugin
//   4. GitHub 仓库已配置 webhook: https://jenkins.portal.bj33smarter.com/github-webhook/
//
// Jenkins Credentials（凭据）：
//   - macos-agent-ssh : SSH Username with private key（连接 macOS Agent 用）
//
// 节点标签：macOS Agent 节点需设置标签 'macos'

pipeline {
    // 所有阶段都在 macOS Agent 上执行
    agent { label 'macos' }

    parameters {
        // .env.deploy 文件的绝对路径（位于 workspace 外以避免被 CleanBeforeCheckout 清除）
        string(name: 'ENV_DEPLOY_PATH', defaultValue: '', description: '.env.deploy 文件绝对路径（留空则跳过复制，测试将使用默认值）')
    }

    environment {
        // macOS Agent 通过 SSH 连接时 PATH 不完整，需要手动补充
        PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    }

    // GitHub webhook 推送触发（仅 develop 分支的 push 事件）
    // webhook 地址: https://jenkins.portal.bj33smarter.com/github-webhook/
    triggers {
        githubPush()
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
        // 跳过默认 checkout，手动控制 submodule
        skipDefaultCheckout()
    }

    stages {
        // ==================== 拉取代码 ====================
        stage('Checkout') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/develop']],
                    extensions: [
                        // 拉取 submodule（extensions/ 目录）
                        [$class: 'SubmoduleOption',
                         recursiveSubmodules: true,
                         reference: ''],
                        // 清理未跟踪文件
                        [$class: 'CleanBeforeCheckout']
                    ],
                    userRemoteConfigs: [[
                        url: 'git@github.com:domonic18/ai-claude-code-ui.git',
                        credentialsId: 'github-ssh-key'
                    ]]
                ])
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
                echo '--- CI: 运行测试 ---'
                sh '''
                    # 从 workspace 外复制环境配置（避免被 CleanBeforeCheckout 清除）
                    if [ -n "${ENV_DEPLOY_PATH}" ] && [ -f "${ENV_DEPLOY_PATH}" ]; then
                        cp "${ENV_DEPLOY_PATH}" .env.deploy
                        echo "已复制环境配置: ${ENV_DEPLOY_PATH}"
                    else
                        echo "未指定 ENV_DEPLOY_PATH 或文件不存在，跳过（测试将使用默认值）"
                    fi
                    npm run test:imports
                    npm run test:database
                    npm run test:user-settings-mcp
                '''
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
