// Jenkins CI/CD Pipeline - Docker 构建环境
//
// 触发方式：GitHub webhook（push 到 develop 分支自动触发）
//
// 流水线阶段：
//   CI（容器内）: Checkout → Build → Test
//   CD（宿主机）: Build & Push Images + Cleanup
//
// 前置条件：
//   1. Jenkins 服务器已安装 Docker
//   2. Jenkins 插件：Pipeline、Git、GitHub plugin、Docker Pipeline
//   3. GitHub 仓库已配置 webhook（地址在 Jenkins 系统配置中管理）
//   4. Jenkins 凭据 tencent-registry-credentials（腾讯云容器镜像服务登录凭据）
//
// Jenkins Job SCM 配置：
//   - Repository URL: git@github.com:domonic18/ai-claude-code-ui.git
//   - Credentials: Git SSH 私钥
//   - Branch: */develop

pipeline {
    // 不设全局 agent，每个 stage 单独指定
    // CI 阶段用 Docker 容器（node:20），CD 阶段用宿主机（需要 Docker daemon）
    agent none

    // GitHub webhook 推送触发（仅 develop 分支的 push 事件）
    // webhook 地址在 Jenkins 系统配置中管理
    triggers {
        githubPush()
    }

    options {
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        disableConcurrentBuilds()
    }

    // 公用环境变量
    environment {
        REGISTRY = 'ccr.ccs.tencentyun.com'
        IMAGE_PREFIX = 'patent'
        DOCKER_PLATFORM = 'linux/amd64'
    }

    stages {
        // ==================== 拉取代码 ====================
        stage('Checkout') {
            agent {
                docker {
                    image 'ccr.ccs.tencentyun.com/sasan/node:20.20.2-bookworm-amd64'
                    args '--entrypoint='
                    registryUrl 'https://ccr.ccs.tencentyun.com'
                    registryCredentialsId 'tencent-registry-credentials'
                }
            }
            steps {
                // 使用 Jenkins Job SCM 配置自动拉取（仓库地址、凭据、分支已在 Job 配置中定义）
                checkout scm
                sh 'git log --oneline -5'
            }
        }

        // ==================== CI: 构建前端 ====================
        stage('CI: Build') {
            agent {
                docker {
                    image 'ccr.ccs.tencentyun.com/sasan/node:20.20.2-bookworm-amd64'
                    args '--entrypoint='
                    registryUrl 'https://ccr.ccs.tencentyun.com'
                    registryCredentialsId 'tencent-registry-credentials'
                }
            }
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
            agent {
                docker {
                    image 'ccr.ccs.tencentyun.com/sasan/node:20.20.2-bookworm-amd64'
                    args '--entrypoint='
                    registryUrl 'https://ccr.ccs.tencentyun.com'
                    registryCredentialsId 'tencent-registry-credentials'
                }
            }
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

        // ==================== CD: 构建 & 推送 Docker 镜像 ====================
        // 在 Jenkins 宿主机上执行（agent any），需要访问 Docker daemon
        // 构建 + 推送 + 清理放在同一个 agent 里，确保镜像在同一个 Docker daemon 上
        stage('CD: Build & Push Images') {
            agent any
            steps {
                echo '--- CD: 构建 Docker 镜像并推送到腾讯云仓库 ---'

                // agent any 可能分配不同节点，确保源代码可用
                checkout scm
                // 递归拉取 git submodule（extensions/ 是独立仓库，需要 fangfang023 账号的 SSH 密钥）
                withCredentials([sshUserPrivateKey(
                    credentialsId: 'github-fangfang023-submodule',
                    keyFileVariable: 'SSH_KEY_FILE'
                )]) {
                    sh 'GIT_SSH_COMMAND="ssh -i $SSH_KEY_FILE -o StrictHostKeyChecking=no" git submodule update --init --recursive'
                }

                // 获取 git short commit hash 作为镜像版本号
                script {
                    env.GIT_SHORT_HASH = sh(
                        script: 'git rev-parse --short=7 HEAD',
                        returnStdout: true
                    ).trim()
                }

                echo "镜像版本号: ${env.GIT_SHORT_HASH}"

                // -------- 1. 构建 base 镜像 --------
                // 最耗时的步骤：安装系统依赖 + npm ci
                // 有 Docker 层缓存时，package.json 不变则秒过
                echo '--- [1/3] 构建 base 镜像 ---'
                sh """
                    docker build \
                        --platform ${env.DOCKER_PLATFORM} \
                        -f docker/Dockerfile.base \
                        -t ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:base \
                        .
                """

                // -------- 2. 构建 main 应用镜像 --------
                echo '--- [2/3] 构建 main 应用镜像 ---'
                sh """
                    docker build \
                        --platform ${env.DOCKER_PLATFORM} \
                        --build-arg BASE_IMAGE=${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:base \
                        -f docker/Dockerfile.main \
                        -t ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:${env.GIT_SHORT_HASH} \
                        .
                """

                // -------- 3. 构建 sandbox 镜像 --------
                echo '--- [3/3] 构建 sandbox 镜像 ---'
                sh """
                    docker build \
                        --platform ${env.DOCKER_PLATFORM} \
                        --build-arg BASE_IMAGE=${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:base \
                        -f docker/Dockerfile.sandbox \
                        -t ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-sandbox:${env.GIT_SHORT_HASH} \
                        .
                """

                // -------- 4. 登录腾讯云仓库并推送 --------
                echo '--- 推送镜像到腾讯云容器镜像服务 ---'
                // 使用 Jenkins 凭据登录，避免密码泄露到日志
                withCredentials([usernamePassword(
                    credentialsId: 'tencent-registry-patent-deploy',
                    usernameVariable: 'REGISTRY_USER',
                    passwordVariable: 'REGISTRY_PASS'
                )]) {
                    sh "echo \${REGISTRY_PASS} | docker login ${env.REGISTRY} -u \${REGISTRY_USER} --password-stdin"
                }

                // 推送三个镜像（带重试，应对网络抖动导致的 TLS handshake timeout）
                // 重试策略：最多 3 次，间隔 10s/20s/30s，docker push 自身会复用已推送的层
                script {
                    def images = [
                        "${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:base",
                        "${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:${env.GIT_SHORT_HASH}",
                        "${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-sandbox:${env.GIT_SHORT_HASH}"
                    ]
                    for (img in images) {
                        retry(3) {
                            sh "docker push ${img}"
                        }
                    }
                }

                echo "--- 镜像推送完成 ---"
                echo "base:    ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:base"
                echo "main:    ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:${env.GIT_SHORT_HASH}"
                echo "sandbox: ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-sandbox:${env.GIT_SHORT_HASH}"
            }
            post {
                failure {
                    echo 'Docker 镜像构建或推送失败，请检查日志'
                }
                always {
                    // 清理本地镜像，释放磁盘空间
                    echo '--- 清理本地构建产物 ---'
                    sh """
                        docker rmi \
                            ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:base \
                            ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:${env.GIT_SHORT_HASH} \
                            ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-sandbox:${env.GIT_SHORT_HASH} \
                        || true
                    """
                    sh 'docker image prune -f || true'
                }
            }
        }
    }

    post {
        success {
            echo 'CI/CD 流水线通过'
            echo "镜像已推送: ${env.REGISTRY}/${env.IMAGE_PREFIX}/claude-code-ui:${env.GIT_SHORT_HASH}"
            cleanWs()
        }
        failure {
            echo 'CI/CD 流水线失败，请检查日志'
            echo '工作空间已保留，可用于排查问题'
        }
    }
}
