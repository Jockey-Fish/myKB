/**
 * Ollama LLM服务 - 基于本地Ollama的LLM调用
 * 支持流式和非流式生成
 */

const axios = require("axios");
const logger = require("../logger");

class OllamaLLMService {
  constructor(options = {}) {
    this.baseUrl =
      options.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      "http://127.0.0.1:11434";
    this.model = options.model || process.env.OLLAMA_MODEL || "qwen2.5:7b";
    this.timeout = options.timeout || 60000; // 60秒超时
    this.initialized = false;

    // 创建axios实例 - 强制使用IPv4
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
      httpAgent: new (require("http").Agent)({ family: 4 }),
      httpsAgent: new (require("https").Agent)({ family: 4 }),
    });
  }

  /**
   * 初始化Ollama服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      logger.info("正在初始化Ollama LLM服务...");

      // 检查Ollama服务是否可用
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];

      // 检查模型是否存在
      const modelExists = models.some(
        (m) => m.name === this.model || m.name.startsWith(this.model),
      );

      if (!modelExists) {
        logger.warn(
          `模型 ${this.model} 未在Ollama中找到，请先运行: ollama pull ${this.model}`,
        );
      } else {
        logger.info(`Ollama模型已加载: ${this.model}`);
      }

      this.initialized = true;
      logger.info("Ollama LLM服务初始化完成");
    } catch (error) {
      logger.error("Ollama LLM服务初始化失败:", error);
      throw new Error(`Ollama初始化失败: ${error.message}`);
    }
  }

  /**
   * 非流式生成
   */
  async generate(prompt, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = Date.now();

      const payload = {
        model: options.model || this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          top_k: options.top_k || 40,
          num_predict: options.maxTokens || 2000,
        },
      };

      logger.debug("发送Ollama生成请求", {
        model: payload.model,
        promptLength: prompt.length,
      });

      const response = await this.client.post("/api/generate", payload);
      const result = response.data;

      const generateTime = Date.now() - startTime;

      logger.info("Ollama生成完成", {
        model: result.model,
        generateTime: `${generateTime}ms`,
        evalCount: result.eval_count,
        evalDuration: result.eval_duration,
      });

      return {
        content: result.response,
        model: result.model,
        provider: "ollama",
        metadata: {
          evalCount: result.eval_count,
          evalDuration: result.eval_duration,
          loadDuration: result.load_duration,
          promptEvalCount: result.prompt_eval_count,
          promptEvalDuration: result.prompt_eval_duration,
          totalDuration: result.total_duration,
        },
      };
    } catch (error) {
      logger.error("Ollama生成失败:", error);
      throw new Error(`LLM生成失败: ${error.message}`);
    }
  }

  /**
   * 流式生成
   */
  async *generateStream(prompt, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const payload = {
        model: options.model || this.model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          top_k: options.top_k || 40,
          num_predict: options.maxTokens || 2000,
        },
      };

      logger.debug("发送Ollama流式生成请求", {
        model: payload.model,
        promptLength: prompt.length,
      });

      const response = await this.client.post("/api/generate", payload, {
        responseType: "stream",
      });

      const stream = response.data;

      for await (const chunk of stream) {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.done) {
              logger.info("Ollama流式生成完成", {
                model: data.model,
                evalCount: data.eval_count,
                evalDuration: data.eval_duration,
              });
            }

            yield {
              content: data.response || "",
              done: data.done || false,
              model: data.model,
              provider: "ollama",
              metadata: {
                evalCount: data.eval_count,
                evalDuration: data.eval_duration,
                loadDuration: data.load_duration,
                promptEvalCount: data.prompt_eval_count,
                promptEvalDuration: data.prompt_eval_duration,
                totalDuration: data.total_duration,
              },
            };
          } catch (parseError) {
            logger.warn("解析Ollama流式响应失败:", parseError);
          }
        }
      }
    } catch (error) {
      logger.error("Ollama流式生成失败:", error);
      throw new Error(`LLM流式生成失败: ${error.message}`);
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    try {
      const response = await this.client.get("/api/tags");
      const models = response.data.models || [];
      const modelExists = models.some(
        (m) => m.name === this.model || m.name.startsWith(this.model),
      );

      return {
        provider: "ollama",
        model: this.model,
        baseUrl: this.baseUrl,
        initialized: this.initialized,
        available: true,
        modelExists,
        availableModels: models.map((m) => m.name),
        message: modelExists ? "Ollama服务正常" : `模型 ${this.model} 未找到`,
      };
    } catch (error) {
      return {
        provider: "ollama",
        model: this.model,
        baseUrl: this.baseUrl,
        initialized: false,
        available: false,
        message: `Ollama服务不可用: ${error.message}`,
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels() {
    try {
      const response = await this.client.get("/api/tags");
      return response.data.models || [];
    } catch (error) {
      logger.error("获取Ollama模型列表失败:", error);
      throw new Error(`获取模型列表失败: ${error.message}`);
    }
  }
}

module.exports = OllamaLLMService;
