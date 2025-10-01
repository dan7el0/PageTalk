const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const FREE_API_ENDPOINT = 'https://c0rpr74ughd0-deploy.space.z.ai/api/asr-inference';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function callFreeASRAPI(audioBlob, options) {
  const base64 = await blobToBase64(audioBlob);
  const payload = {
    audio_file: { data: base64, name: 'recording.dat', type: audioBlob.type, size: audioBlob.size },
    context: options.context || '',
    language: options.language || 'auto',
    enable_itn: !!options.enable_itn
  };
  const response = await chrome.runtime.sendMessage({
    type: 'callASRAPI',
    payload: {
      url: FREE_API_ENDPOINT,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    }
  });
  if (response.success && response.data.success) {
    const result = response.data.data;
    if (Array.isArray(result) && result.length >= 1) {
        const text = result[0];
        const langInfo = result[1] || '';
        const langMatch = langInfo.match(/检测到的语言：(.*?)$/);
        let lang = langMatch ? langMatch[1] : langInfo;
        lang = lang.split(' / ')[0].trim();
        return [text, lang];
    }
    throw new Error('API 未能返回有效文本');
  } else {
    throw new Error(response.data?.error || response.data?.details || response.error || '请求失败');
  }
}

export async function callDashScopeASRAPI(audioBlob, options) {
  if (!options.apiKey) {
    // Toast is handled by caller
    throw new Error('未提供阿里云百炼 API Key');
  }
  const base64 = await blobToBase64(audioBlob);
  const audioDataURI = `data:${audioBlob.type};base64,${base64}`;
  const system_parts = [];
  if (options.language && options.language !== 'auto') system_parts.push(`asr language:${options.language}`);
  if (options.context) system_parts.push(options.context);
  const messages = [];
  if (system_parts.length > 0) messages.push({ role: "system", content: [{ text: system_parts.join('\n') }] });
  messages.push({ role: "user", content: [{ audio: audioDataURI }] });
  const payload = {
    model: options.dashscopeModelId || "qwen3-asr-flash",
    input: { messages },
    parameters: { asr_options: { enable_lid: options.language === 'auto', enable_itn: !!options.enable_itn } }
  };
  const response = await chrome.runtime.sendMessage({
    type: 'callASRAPI',
    payload: {
      url: API_ENDPOINT,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${options.apiKey}` },
        body: JSON.stringify(payload)
      }
    }
  });
  if (response.success) {
    const result = response.data;
    const choice = result.output?.choices?.[0];
    if (choice?.finish_reason === 'stop' && choice.message?.content?.[0]?.text) {
      const text = choice.message.content[0].text;
      const lang = choice.message.annotations?.find(a => a.type === 'audio_info')?.language || '';
      return [text, lang];
    } else {
      throw new Error(result?.message || 'API 未能返回有效文本');
    }
  } else {
    throw new Error(response.error || '请求失败');
  }
}


export async function callDashScopeASRAPIStream(audioBlob, options, callbacks) {
    const { onChunk, onFinish, onError } = callbacks;
    if (!options.apiKey) {
        onError(new Error('未提供阿里云百炼 API Key'));
        return;
    }
    
    const base64 = await blobToBase64(audioBlob);
    const audioDataURI = `data:${audioBlob.type};base64,${base64}`;

    const system_parts = [];
    if (options.language && options.language !== 'auto') system_parts.push(`asr language:${options.language}`);
    if (options.context) system_parts.push(options.context);
    
    const messages = [];
    if (system_parts.length > 0) messages.push({ role: "system", content: [{ text: system_parts.join('\n') }] });
    messages.push({ role: "user", content: [{ audio: audioDataURI }] });

    const payload = {
        model: options.dashscopeModelId || "qwen3-asr-flash",
        input: { messages },
        parameters: {
            incremental_output: true,
            asr_options: { enable_lid: options.language === 'auto', enable_itn: !!options.enable_itn }
        }
    };
    
    const apiOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${options.apiKey}`,
            "X-DashScope-SSE": "enable"
        },
        body: JSON.stringify(payload)
    };

    let accumulatedText = '';
    let finalLang = '';

    const messageListener = (request, sender, sendResponse) => {
        if (request.type === 'asrStreamChunk') {
            const choice = request.payload?.output?.choices?.[0];
            if (!choice) return;

            const textChunk = choice.message?.content?.[0]?.text || '';
            if (textChunk) {
                accumulatedText += textChunk;
                onChunk(accumulatedText);
            }
            
            const lang = choice.message?.annotations?.find(a => a.type === 'audio_info')?.language || '';
            if (lang) finalLang = lang;
            
            if (choice.finish_reason === 'stop') {
                chrome.runtime.onMessage.removeListener(messageListener);
                onFinish(accumulatedText, finalLang);
            }
        } else if (request.type === 'asrStreamEnd') {
            chrome.runtime.onMessage.removeListener(messageListener);
            onFinish(accumulatedText, finalLang);
        } else if (request.type === 'asrStreamError') {
            chrome.runtime.onMessage.removeListener(messageListener);
            onError(new Error(request.error));
        }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    
    chrome.runtime.sendMessage({
        type: 'callStreamingASRAPI',
        payload: { url: API_ENDPOINT, options: apiOptions }
    });
}

export async function callOpenAIAPI(text, options) {
  if (!options.openaiApiKey || !options.openaiBaseUrl || !options.openaiModelId) {
    throw new Error('请先配置文本后处理的 API 信息。');
  }

  const fullUrl = new URL('chat/completions', options.openaiBaseUrl.endsWith('/') ? options.openaiBaseUrl : options.openaiBaseUrl + '/').href;

  const payload = {
    url: fullUrl,
    apiKey: options.openaiApiKey,
    model: options.openaiModelId,
    text: text,
    systemPrompt: options.openaiSystemPrompt
  };

  const response = await chrome.runtime.sendMessage({
    type: 'callOpenAIAPI',
    payload: payload
  });

  if (response.success) {
    const content = response.data?.choices?.[0]?.message?.content;
    if (content) {
      return content.trim();
    } else {
      throw new Error('API 未能返回有效文本');
    }
  } else {
    throw new Error(response.error || '请求失败');
  }
}

export async function callConsoleAPI(text, options) {
  if (!options.consoleApiKey || !options.consoleBaseUrl || !options.consoleModelId) {
    throw new Error('请先配置控制台命令的 API 信息。');
  }

  const fullUrl = new URL('chat/completions', options.consoleBaseUrl.endsWith('/') ? options.consoleBaseUrl : options.consoleBaseUrl + '/').href;

  const payload = {
    url: fullUrl,
    apiKey: options.consoleApiKey,
    model: options.consoleModelId,
    text: text,
    systemPrompt: options.consoleSystemPrompt
  };

  const response = await chrome.runtime.sendMessage({
    type: 'callConsoleAPI',
    payload: payload
  });

  if (response.success) {
    const content = response.data?.choices?.[0]?.message?.content;
    if (content) {
      let command = content.trim();
      const matchJson = command.match(/```json\s*([\s\S]*?)\s*```/);
      if (matchJson && matchJson[1]) {
        command = matchJson[1].trim();
      } else {
          const matchGeneric = command.match(/```\s*([\s\S]*?)\s*```/);
          if (matchGeneric && matchGeneric[1]) {
              command = matchGeneric[1].trim();
          }
      }
      if ((command.startsWith('`') && command.endsWith('`'))) {
        command = command.substring(1, command.length - 1);
      }
      return command;
    } else {
      throw new Error('API 未能返回有效命令');
    }
  } else {
    throw new Error(response.error || '请求失败');
  }
}