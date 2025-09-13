'use strict';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callFreeASRAPI(audioBlob, options) {
  const base64 = await blobToBase64(audioBlob);

  const payload = {
      audio_file: {
          data: base64,
          name: 'recording.wav',
          type: 'audio/wav',
          size: audioBlob.size
      },
      context: options.context || '',
      language: options.language || 'auto',
      enable_itn: !!options.enable_itn
  };

  const response = await chrome.runtime.sendMessage({
    type: 'callASRAPI', // The background script handler is generic
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
      // Handle cases like "中文 / Chinese" by taking the first part.
      lang = lang.split(' / ')[0].trim();
      return [text, lang];
    } else {
      throw new Error('API 未能返回有效文本');
    }
  } else {
    const errorMessage = response.data?.error || response.data?.details || response.error || '请求失败';
    throw new Error(errorMessage);
  }
}

async function callDashScopeASRAPI(audioBlob, options) {
  if (!options.apiKey) {
    // This function must be defined in cs-ui.js
    toast('请点击浏览器右上角的扩展图标，设置您的阿里云百炼 API Key。');
    throw new Error('未提供阿里云百炼 API Key');
  }

  const base64 = await blobToBase64(audioBlob);
  const audioDataURI = `data:audio/wav;base64,${base64}`;

  const system_parts = [];
  if (options.language && options.language !== 'auto') {
    system_parts.push(`asr language:${options.language}`);
  }
  if (options.context) {
    system_parts.push(options.context);
  }
  const system_prompt = system_parts.join('\n');

  const messages = [];
  if (system_prompt) {
    messages.push({ role: "system", content: [{ text: system_prompt }] });
  }
  messages.push({ role: "user", content: [{ audio: audioDataURI }] });

  const payload = {
    model: "qwen3-asr-flash",
    input: {
      messages: messages
    },
    parameters: {
      asr_options: {
        enable_lid: options.language === 'auto',
        enable_itn: !!options.enable_itn
      }
    }
  };

  const response = await chrome.runtime.sendMessage({
    type: 'callASRAPI',
    payload: {
      url: API_ENDPOINT,
      options: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${options.apiKey}`
        },
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
