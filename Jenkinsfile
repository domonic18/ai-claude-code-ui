// Jenkins CI/CD Pipeline - Master/Agent 架构
//
// 架构：Jenkins Master (Linux) → macOS Agent 节点
// 所有构建和部署都在 macOS Agent 上完成，不需要 CCR 中转
//
// 触发方式：Poll SCM 每 5 分钟轮询 develop 分支变更
//
// 前置条件：
//   1. macOS Agent 节点已注册到 Jenkins Master（通过 SSH）
//   2. macOS Agent 上已安装：Docker Desktop、Node.js 20、git
//   3. Jenkins 插件：Pipeline、Git、SSH Build Agents
//
// Jenkins Credentials（凭据）：
//   - macos-agent-ssh : SSH Username with private key（连接 macOS Agent 用）
//
// 节点标签：macOS Agent 节点需设置标签 'macos'

pipeline {
    // 所有阶段都在 macOS Agent 上执行
    agent { label 'macos' }

    parameters {
        // 部署目录（绝对路径，不允许包含路径遍历字符）
        string(name: 'DEPLOY_DIR', defaultValue: '/opt/claude-code-ui/deploy', description: '项目部署目录（绝对路径，禁止包含 .. 或特殊字符）')
        // 健康检查端口（应与 docker-compose.deploy.yml 中的宿主机映射端口一致）
        string(name: 'HEALTH_PORT', defaultValue: '3001', description: '健康检查端口（宿主机映射端口，1-65535）')
    }

    environment {
        // 镜像版本号 = git short commit hash
        VERSION = """${sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()}"""
    }

    // 每 5 分钟轮询 develop 分支，有新提交才触发
    triggers {
        pollSCM('H/5 * * * *')
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        // 不并发执行，防止同时部署
        disableConcurrentBuilds()
        // 跳过默认 checkout，手动控制 submodule
        skipDefaultCheckout()
    }

    stages {
        // ==================== 参数校验（Groovy 层，在 shell 之前执行） ====================
        stage('Validate Params') {
            steps {
                script {
                    // 校验 DEPLOY_DIR：必须为绝对路径，只允许字母、数字、-_/. 和空格
                    def deployDir = params.DEPLOY_DIR?.trim()
                    if (!deployDir) {
                        error 'DEPLOY_DIR 不能为空'
                    }
                    // 拒绝路径遍历（.. 出现在任何位置）
                    if (deployDir.contains('..')) {
                        error "DEPLOY_DIR 包含路径遍历字符 '..': ${deployDir}"
                    }
                    // 必须以 / 开头（绝对路径）
                    if (!deployDir.startsWith('/')) {
                        error "DEPLOY_DIR 必须为绝对路径（以 / 开头）: ${deployDir}"
                    }
                    // 只允许安全字符：字母、数字、-、_、/、.、空格
                    if (!(deployDir ==~ /^[a-zA-Z0-9\-_\/.\s]+$/)) {
                        error "DEPLOY_DIR 包含非法字符，仅允许字母、数字、-、_、/、.、空格: ${deployDir}"
                    }

                    // 校验 HEALTH_PORT：必须为 1-65535 的纯数字
                    def portStr = params.HEALTH_PORT?.trim()
                    if (!(portStr ==~ /^[0-9]+$/)) {
                        error "HEALTH_PORT 必须为纯数字: ${portStr}"
                    }
                    def portNum = portStr.toInteger()
                    if (portNum < 1 || portNum > 65535) {
                        error "HEALTH_PORT 超出合法范围 (1-65535): ${portNum}"
                    }
                }
            }
        }

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
                sh "echo '版本: ${VERSION}'"
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

        // ==================== CD: 构建 Docker 镜像 ====================
        stage('CD: Build Images') {
            steps {
                echo "--- CD: 构建 Docker 镜像 (version: ${VERSION}) ---"
                sh '''
                    # 检查 base 镜像是否存在，不存在则先构建
                    if ! docker image inspect claude-code-ui:base >/dev/null 2>&1; then
                        echo "base 镜像不存在，首次构建..."
                        docker build -f docker/Dockerfile.base -t claude-code-ui:base .
                    fi

                    # 构建主应用镜像
                    echo ">>> 构建主应用镜像..."
                    docker build \
                        --build-arg BASE_IMAGE=claude-code-ui:base \
                        -f docker/Dockerfile.main \
                        -t claude-code-ui:${VERSION} \
                        -t claude-code-ui:latest \
                        .

                    # 构建沙箱镜像
                    echo ">>> 构建沙箱镜像..."
                    docker build \
                        --build-arg BASE_IMAGE=claude-code-ui:base \
                        -f docker/Dockerfile.sandbox \
                        -t claude-code-sandbox:${VERSION} \
                        -t claude-code-sandbox:latest \
                        .

                    echo "镜像构建完成:"
                    docker images | grep -E "claude-code-(ui|sandbox)" | head -6
                '''
            }
        }

        // ==================== CD: 部署 ====================
        stage('CD: Deploy') {
            steps {
                echo "--- CD: 部署 (version: ${VERSION}) ---"
                // DEPLOY_DIR 和 HEALTH_PORT 已在 Validate Params 阶段通过 Groovy 正则校验
                // 此处通过 Groovy 拼接将已校验的值注入到 shell 变量中，避免 shell 注入风险
                sh """#!/bin/bash
                    set -euo pipefail

                    DEPLOY_DIR="${params.DEPLOY_DIR.trim()}"
                    HEALTH_PORT="${params.HEALTH_PORT.trim()}"

                    # 确保部署目录存在
                    mkdir -p "\${DEPLOY_DIR}"

                    # 复制 docker-compose 模板到部署目录
                    cp docker-compose.deploy.yml "\${DEPLOY_DIR}/docker-compose.deploy.yml"

                    # 替换模板中的 \${IMAGE_VERSION}
                    export IMAGE_VERSION="${VERSION}"
                    if command -v envsubst >/dev/null 2>&1; then
                        envsubst '\${IMAGE_VERSION}' < "\${DEPLOY_DIR}/docker-compose.deploy.yml" > "\${DEPLOY_DIR}/docker-compose.deploy.resolved.yml"
                    else
                        sed "s/\\\\\\${IMAGE_VERSION}/${VERSION}/g" "\${DEPLOY_DIR}/docker-compose.deploy.yml" > "\${DEPLOY_DIR}/docker-compose.deploy.resolved.yml"
                    fi

                    # 检查 .env.deploy 是否存在
                    if [ ! -f "\${DEPLOY_DIR}/.env.deploy" ]; then
                        echo "ERROR: \${DEPLOY_DIR}/.env.deploy 不存在，请先手动创建"
                        exit 1
                    fi

                    # 停止旧容器
                    echo ">>> 停止旧容器..."
                    docker-compose -f "\${DEPLOY_DIR}/docker-compose.deploy.resolved.yml" down --timeout 30 2>/dev/null || true

                    # 启动新容器
                    echo ">>> 启动新容器..."
                    docker-compose -f "\${DEPLOY_DIR}/docker-compose.deploy.resolved.yml" up -d

                    # 健康检查（先 sleep 等待容器启动，首次检查时给予启动缓冲）
                    echo ">>> 健康检查..."
                    TIMEOUT=90
                    ELAPSED=0
                    # 先等待 5 秒，给予容器启动缓冲时间，避免首次 curl 失败
                    sleep 5
                    ELAPSED=5
                    while [ "\${ELAPSED}" -lt "\${TIMEOUT}" ]; do
                        if curl -sf "http://localhost:\${HEALTH_PORT}/health" >/dev/null 2>&1; then
                            echo "健康检查通过 (\${ELAPSED}s)"
                            break
                        fi
                        sleep 5
                        ELAPSED=\$((ELAPSED + 5))
                        echo "  等待中... (\${ELAPSED}s/\${TIMEOUT}s)"
                    done

                    if [ "\${ELAPSED}" -ge "\${TIMEOUT}" ]; then
                        echo "ERROR: 健康检查失败 (\${TIMEOUT}s 超时)"
                        # 将容器日志写入文件而非直接输出到 Jenkins 控制台，避免敏感信息泄露
                        docker-compose -f "\${DEPLOY_DIR}/docker-compose.deploy.resolved.yml" logs --tail 50 > "\${DEPLOY_DIR}/deploy-failed.log" 2>&1
                        echo "容器日志已保存到: \${DEPLOY_DIR}/deploy-failed.log"
                        echo "请登录 Agent 机器查看日志，排查问题后重试"
                        exit 1
                    fi

                    # 清理旧镜像
                    echo ">>> 清理旧镜像..."
                    docker image prune -f --filter "until=168h" || true

                    echo ">>> 部署完成: ${VERSION}"
                """
            }
        }
    }

    post {
        success {
            echo "部署成功! 版本: ${VERSION}"
            // 可加通知：邮件、钉钉、Slack 等
        }
        failure {
            echo "流水线失败，请检查日志"
        }
        always {
            cleanWs()
        }
    }
}
