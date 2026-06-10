/**
 * 简化版LLM服务 - 仅支持Mock模式
 * 用于测试和开发环境，不依赖外部依赖
 */

class LLMService {
  constructor(options = {}) {
    // 默认使用Mock模式
    this.provider = "mock";
    this.model = "mock-model";
    this.initialized = true;

    // Mock响应数据
    this.mockResponses = [
      "这是一个基于知识库内容生成的回答。根据您提供的参考资料，我为您整理了以下信息：",
      "根据文档内容，相关知识要点如下：首先，文档介绍了核心概念和基本原理；其次，详细说明了具体的实现方法；最后，提供了实际应用案例。",
      "通过分析参考文档，我理解您的问题涉及以下几个方面。让我为您逐一解答：",
      "基于检索到的知识片段，我将为您提供详细的回答。请注意，以下内容来自知识库：",
      "感谢您的提问！根据知识库中的信息，以下是相关解答：",
    ];
  }

  async initialize() {
    // 已经初始化
    return;
  }

  async generate(prompt, options = {}) {
    const response =
      this.mockResponses[Math.floor(Math.random() * this.mockResponses.length)];
    const fullResponse = `${response}\n\n您的问题是："${prompt}"\n\n由于当前处于Mock模式，这是一个模拟回答。在实际部署时，请安装Ollama并配置正确的LLM_PROVIDER环境变量。`;

    return {
      content: fullResponse,
      model: this.model,
      provider: "mock",
    };
  }

  async *generateStream(prompt, options = {}) {
    const response =
      this.mockResponses[Math.floor(Math.random() * this.mockResponses.length)];
    const fullResponse = `${response}\n\n您的问题是："${prompt}"\n\n由于当前处于Mock模式，这是一个模拟回答。在实际部署时，请安装Ollama并配置正确的LLM_PROVIDER环境变量。`;

    for (let i = 0; i < fullResponse.length; i++) {
      yield {
        content: fullResponse[i],
        done: false,
      };
      await new Promise((resolve) =>
        setTimeout(resolve, 30 + Math.random() * 20),
      );
    }

    yield { content: "", done: true };
  }

  async getStatus() {
    return {
      provider: "mock",
      model: this.model,
      initialized: true,
      available: true,
      message: "当前运行在Mock模式下",
    };
  }
}

module.exports = LLMService;
